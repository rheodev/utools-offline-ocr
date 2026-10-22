// 按 uTools 规范使用 .js 和 CommonJS，由同目录 package.json 指定模块类型。
const fs = require('node:fs/promises')
const path = require('node:path')
const { clipboard } = require('electron')

const MAX_FILE_BYTES = 20 * 1024 * 1024
const ASSETS = [
  'models/det.onnx',
  'models/rec.onnx',
  'models/keys.txt',
  'vendor/ort/ort.wasm.min.mjs',
  'vendor/ort/ort-wasm-simd-threaded.mjs',
  'vendor/ort/ort-wasm-simd-threaded.wasm',
]

let enterListener
let pendingAction
utools.onPluginEnter((action) => {
  if (enterListener) enterListener(action)
  else pendingAction = action
})

window.ocrHost = {
  onEnter(listener) {
    enterListener = listener
    if (pendingAction) {
      const action = pendingAction
      pendingAction = undefined
      queueMicrotask(() => { if (enterListener === listener) listener(action) })
    }
    return () => { if (enterListener === listener) enterListener = undefined }
  },
  async capture() {
    utools.hideMainWindow()
    try {
      return await utools.screenCapture()
    } catch {
      return null
    } finally {
      utools.showMainWindow()
    }
  },
  clipboardImage() {
    const image = clipboard.readImage()
    return image.isEmpty() ? null : image.toDataURL()
  },
  copyText(text) {
    if (typeof text !== 'string') throw new Error('无效文本')
    clipboard.writeText(text)
  },
  async readImageFile(filePath) {
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) throw new Error('无效文件路径')
    const mime = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.webp': 'image/webp', '.bmp': 'image/bmp',
    }[path.extname(filePath).toLowerCase()]
    if (!mime) throw new Error('请选择 PNG、JPG、WebP 或 BMP 图片')
    const handle = await fs.open(filePath, 'r')
    try {
      const stat = await handle.stat()
      if (!stat.isFile() || stat.size === 0 || stat.size > MAX_FILE_BYTES) {
        throw new Error('图片文件为空或超过 20 MB')
      }
      // 有上限地读取，避免文件在 stat 后增长造成无界内存分配。
      const bytes = Buffer.alloc(stat.size + 1)
      const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0)
      if (bytesRead !== stat.size) throw new Error('图片文件发生变化，请重新选择')
      return { name: path.basename(filePath), dataUrl: `data:${mime};base64,${bytes.subarray(0, bytesRead).toString('base64')}` }
    } finally {
      await handle.close()
    }
  },
  async loadAssets() {
    const pairs = await Promise.all(ASSETS.map(async (name) => {
      const bytes = await fs.readFile(path.join(__dirname, name))
      return [name, Uint8Array.from(bytes)]
    }))
    return Object.fromEntries(pairs)
  },
}
