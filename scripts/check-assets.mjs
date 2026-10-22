import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MODELS, ORT_VERSION, REQUIRED_ASSETS } from './assets-manifest.mjs'
import { sha256, validateAsset } from './asset-utils.mjs'

export async function checkAssets(directory) {
  let lock
  try { lock = JSON.parse(await readFile(join(directory, 'models/assets-lock.json'), 'utf8')) }
  catch { throw new Error('缺少离线资源清单，请先运行 npm run assets:prepare') }
  if (lock.schema !== 1 || lock.runtime !== ORT_VERSION || lock.model !== 'PP-OCRv4-mobile') throw new Error('离线资源版本不匹配')
  let total = 0
  for (const name of REQUIRED_ASSETS) {
    const expected = lock.files?.[name]
    if (!expected?.sha256) throw new Error(`清单缺少 ${name}`)
    const bytes = await readFile(join(directory, name))
    validateAsset(name, bytes, MODELS.find(model => model.name === name)?.sha256)
    if (sha256(bytes) !== expected.sha256 || bytes.length !== expected.bytes) throw new Error(`${name} 与离线资源清单不一致`)
    total += bytes.length
  }
  for (const name of ['THIRD-PARTY.md', 'Apache-2.0.txt', 'Vue-MIT.txt', 'ONNX-Runtime-MIT.txt']) {
    if ((await stat(join(directory, 'licenses', name))).size < 50) throw new Error(`缺少许可文件 ${name}`)
  }
  return total
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = fileURLToPath(new URL('../public/', import.meta.url))
  try { console.log(`离线资源校验通过，合计 ${(await checkAssets(directory) / 1024 / 1024).toFixed(1)} MB`) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
