import type { AssetMap, OcrResult, WorkerRequest, WorkerResponse } from '../types'
import { validateDimensions } from './processing.ts'

const ASSET_NAMES = [
  'models/det.onnx', 'models/rec.onnx', 'models/keys.txt',
  'vendor/ort/ort.wasm.min.mjs', 'vendor/ort/ort-wasm-simd-threaded.mjs', 'vendor/ort/ort-wasm-simd-threaded.wasm',
]

async function loadAssets(): Promise<AssetMap> {
  if (window.ocrHost) return window.ocrHost.loadAssets()
  const pairs = await Promise.all(ASSET_NAMES.map(async name => {
    const response = await fetch(new URL(`${import.meta.env.BASE_URL}${name}`, document.baseURI))
    if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error('Missing asset')
    return [name, new Uint8Array(await response.arrayBuffer())] as const
  }))
  return Object.fromEntries(pairs)
}

export class OcrClient {
  private worker?: Worker
  private ready = false
  private rejectPending?: (error: Error) => void
  private timeout?: ReturnType<typeof setTimeout>
  private busy = false
  private operation = 0
  private createWorker: () => Promise<Worker>

  constructor(createWorker?: () => Promise<Worker>) {
    this.createWorker = createWorker ?? (async () => {
      const { default: InlineWorker } = await import('./ocr.worker?worker&inline')
      return new InlineWorker({ name: 'offline-ocr' })
    })
  }

  cancel() {
    this.operation++
    this.busy = false
    this.worker?.terminate()
    this.worker = undefined
    this.ready = false
    clearTimeout(this.timeout)
    this.rejectPending?.(new DOMException('识别已取消', 'AbortError'))
    this.rejectPending = undefined
  }

  private request<T extends 'ready' | 'result'>(request: WorkerRequest, expected: T, progress: (message: string) => void): Promise<Extract<WorkerResponse, { type: T }>> {
    return new Promise((resolve, reject) => {
      const worker = this.worker!
      const finish = () => {
        clearTimeout(this.timeout)
        worker.onmessage = null
        worker.onerror = null
        worker.onmessageerror = null
        this.rejectPending = undefined
      }
      const fail = (error: Error) => { finish(); reject(error) }
      const armTimeout = () => {
        clearTimeout(this.timeout)
        this.timeout = setTimeout(() => fail(new Error('识别耗时过长，请裁剪图片后重试')), 120_000)
      }
      this.rejectPending = fail
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'progress') { progress(event.data.message); armTimeout() }
        else if (event.data.type === 'error') fail(new Error(event.data.message))
        else if (event.data.type === expected) {
          finish()
          resolve(event.data as Extract<WorkerResponse, { type: T }>)
        }
      }
      worker.onerror = event => { event.preventDefault(); fail(new Error('识别引擎无法启动，请重新安装插件或升级 uTools')) }
      worker.onmessageerror = () => fail(new Error('图片传输失败，请重新选择图片'))
      armTimeout()
      try {
        const transfers = request.type === 'init'
          ? Object.values(request.assets).map(bytes => bytes.buffer)
          : [request.bitmap]
        worker.postMessage(request, transfers)
      } catch (error) {
        fail(error instanceof Error ? error : new Error('识别请求失败'))
      }
    })
  }

  async recognize(blob: Blob, progress: (message: string) => void): Promise<OcrResult> {
    if (this.busy) throw new Error('正在识别另一张图片')
    this.busy = true
    const operation = ++this.operation
    let bitmap: ImageBitmap | undefined
    let worker: Worker | undefined
    try {
      worker = this.worker
      if (!worker) {
        worker = await this.createWorker()
        if (operation !== this.operation) {
          worker.terminate()
          throw new DOMException('识别已取消', 'AbortError')
        }
        this.worker = worker
      }
      if (!this.ready) {
        progress('首次识别，正在加载本地引擎…')
        let assets: AssetMap
        try { assets = await loadAssets() }
        catch { throw new Error('识别资源不完整，请重新安装插件') }
        if (this.worker !== worker) throw new DOMException('识别已取消', 'AbortError')
        await this.request({ type: 'init', assets }, 'ready', progress)
        this.ready = true
      }
      bitmap = await createImageBitmap(blob)
      validateDimensions(bitmap.width, bitmap.height)
      if (this.worker !== worker) throw new DOMException('识别已取消', 'AbortError')
      const result = await this.request({ type: 'recognize', bitmap }, 'result', progress)
      return result.result
    } catch (error) {
      if (this.worker === worker) this.cancel()
      throw error
    } finally {
      bitmap?.close()
      if (operation === this.operation) this.busy = false
    }
  }
}
