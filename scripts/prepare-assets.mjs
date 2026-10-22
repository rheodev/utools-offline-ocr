import { mkdir, readFile, rename, writeFile, copyFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MODELS, ORT_VERSION, REQUIRED_ASSETS, RUNTIME_FILES } from './assets-manifest.mjs'
import { readTarFiles, sha256, validateAsset } from './asset-utils.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const publicDir = join(root, 'public')
const localIndex = process.argv.indexOf('--from')
const localSource = localIndex >= 0 ? process.argv[localIndex + 1] : undefined
if (localIndex >= 0 && !localSource) throw new Error('用法：npm run assets:prepare -- --from /path/to/offline-assets')

async function download(url) {
  console.log(`下载 ${url}`)
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000), redirect: 'follow' })
  if (!response.ok) throw new Error(`下载失败：HTTP ${response.status} ${url}`)
  const declaredSize = Number(response.headers.get('content-length') || 0)
  if (declaredSize > 120 * 1024 * 1024) throw new Error('下载文件过大')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > 120 * 1024 * 1024) throw new Error('下载文件过大')
  return bytes
}

async function save(name, bytes) {
  const expected = MODELS.find(model => model.name === name)?.sha256
  validateAsset(name, bytes, expected)
  const destination = join(publicDir, name)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(`${destination}.tmp`, bytes)
  await rename(`${destination}.tmp`, destination)
}

async function prepare() {
  if (localSource) {
    for (const name of REQUIRED_ASSETS) await save(name, await readFile(join(resolve(localSource), name)))
    await mkdir(join(publicDir, 'licenses'), { recursive: true })
    await copyFile(join(resolve(localSource), 'licenses/ONNX-Runtime-MIT.txt'), join(publicDir, 'licenses/ONNX-Runtime-MIT.txt'))
  } else {
    for (const model of MODELS) {
      let valid = false
      try { validateAsset(model.name, await readFile(join(publicDir, model.name)), model.sha256); valid = true } catch {}
      if (!valid) await save(model.name, await download(model.url))
      console.log(`已就绪 ${model.name}`)
    }
    // 在构建机下载固定版本的运行库，插件本身没有 npm 或联网依赖。
    const metadata = JSON.parse((await download(`https://registry.npmjs.org/onnxruntime-web/${ORT_VERSION}`)).toString())
    if (metadata.version !== ORT_VERSION || !metadata.dist?.integrity?.startsWith('sha512-')) throw new Error('运行库元数据不匹配')
    const tarball = await download(`https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-${ORT_VERSION}.tgz`)
    const integrity = `sha512-${createHash('sha512').update(tarball).digest('base64')}`
    if (integrity !== metadata.dist.integrity) throw new Error('运行库 npm SRI 校验失败')
    const names = RUNTIME_FILES.map(name => `package/dist/${name}`)
    const files = readTarFiles(tarball, names)
    for (const name of RUNTIME_FILES) await save(`vendor/ort/${name}`, files.get(`package/dist/${name}`))
    const license = await download(`https://raw.githubusercontent.com/microsoft/onnxruntime/v${ORT_VERSION}/LICENSE`)
    await mkdir(join(publicDir, 'licenses'), { recursive: true })
    await writeFile(join(publicDir, 'licenses/ONNX-Runtime-MIT.txt'), license)
  }
  const files = {}
  for (const name of REQUIRED_ASSETS) {
    const bytes = await readFile(join(publicDir, name))
    files[name] = { sha256: sha256(bytes), bytes: bytes.length }
  }
  await writeFile(join(publicDir, 'models/assets-lock.json'), JSON.stringify({ schema: 1, model: 'PP-OCRv4-mobile', runtime: ORT_VERSION, files }, null, 2) + '\n')
  console.log('离线资源准备完成。运行 npm run build 生成可导入 uTools 的 dist/plugin.json。')
}

prepare().catch(error => {
  console.error(`离线资源准备失败：${error.message}`)
  console.error('请在可联网的构建环境重试，或使用 --from 导入已准备好的资源目录。')
  process.exitCode = 1
})
