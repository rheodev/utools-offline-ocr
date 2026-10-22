import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkAssets } from './check-assets.mjs'

const directory = fileURLToPath(new URL('../dist/', import.meta.url))
try {
  await checkAssets(directory)
  const plugin = JSON.parse(await readFile(join(directory, 'plugin.json'), 'utf8'))
  if (!plugin.preload?.endsWith('.js')) throw new Error('uTools preload 必须使用 .js 文件')
  const pluginPackage = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
  if (pluginPackage.type !== 'commonjs') throw new Error('插件目录必须显式声明 CommonJS，避免继承开发项目的 ESM 配置')
  for (const name of [plugin.main, plugin.logo, plugin.preload]) {
    if (typeof name !== 'string' || name.startsWith('/') || name.includes('..')) throw new Error('插件资源必须使用本地相对路径')
    await stat(join(directory, name))
  }
  const html = await readFile(join(directory, plugin.main), 'utf8')
  if (/\b(?:src|href)=["'](?:https?:|\/)/.test(html)) throw new Error('入口页面包含远程资源或绝对路径')
  const worker = (await readdir(join(directory, 'assets'))).find(name => /^ocr\.worker-.*\.js$/.test(name))
  if (!worker) throw new Error('缺少 OCR Worker')
  console.log('插件构建校验通过：本地入口、Worker、模型、字典、WASM 和许可文件完整。')
} catch (error) {
  console.error(`插件构建校验失败：${error.message}`)
  process.exitCode = 1
}
