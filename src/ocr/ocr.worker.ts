import { errorMessage } from '../i18n/messages'
import type { AssetMap, TextBlock, WorkerRequest, WorkerResponse } from '../types'
import type { OrtRuntime, Session } from './runtime'
import { arrangeBlocks, decodeCTC, detectionSize, findTextRegions, makeTiles, normalize, parseDictionary, validateDimensions } from './processing'

const scope = self as unknown as DedicatedWorkerGlobalScope
let ort: OrtRuntime
let detector: Session
let recognizer: Session
let dictionary: string[]
let running = false

function send(message: WorkerResponse) { scope.postMessage(message) }

async function initialize(assets: AssetMap) {
  const urls: string[] = []
  const blobUrl = (name: string, type: string) => {
    if (!assets[name]?.length) throw new Error('error.assets')
    const url = URL.createObjectURL(new Blob([assets[name]], { type }))
    urls.push(url)
    return url
  }
  try {
    const runtimeUrl = blobUrl('vendor/ort/ort.wasm.min.mjs', 'text/javascript')
    ort = await import(/* @vite-ignore */ runtimeUrl) as OrtRuntime
    ort.env.wasm.numThreads = 1
    ort.env.wasm.proxy = false
    ort.env.wasm.initTimeout = 60_000
    ort.env.wasm.wasmPaths = {
      mjs: blobUrl('vendor/ort/ort-wasm-simd-threaded.mjs', 'text/javascript'),
      wasm: blobUrl('vendor/ort/ort-wasm-simd-threaded.wasm', 'application/wasm'),
    }
    dictionary = parseDictionary(new TextDecoder().decode(assets['models/keys.txt']))
    const options = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }
    detector = await ort.InferenceSession.create(assets['models/det.onnx'], options)
    recognizer = await ort.InferenceSession.create(assets['models/rec.onnx'], options)
    send({ type: 'ready' })
  } finally {
    urls.forEach(url => URL.revokeObjectURL(url))
  }
}

function canvas(width: number, height: number) {
  const surface = new OffscreenCanvas(width, height)
  const context = surface.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('error.canvas')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, width, height)
  return { surface, context }
}

async function infer(session: Session, data: Float32Array, width: number, height: number) {
  const input = new ort.Tensor('float32', data, [1, 3, height, width])
  try {
    const outputs = await session.run({ [session.inputNames[0]]: input })
    try {
      const output = outputs[session.outputNames[0]]
      return { data: Float32Array.from(output.data), dims: [...output.dims] }
    } finally {
      for (const output of Object.values(outputs)) output.dispose()
    }
  } finally {
    input.dispose()
  }
}

async function recognize(bitmap: ImageBitmap) {
  const started = performance.now()
  try {
    validateDimensions(bitmap.width, bitmap.height)
    const tiles = makeTiles(bitmap.width, bitmap.height)
    const blocks: TextBlock[] = []
    for (let tileIndex = 0; tileIndex < tiles.length; tileIndex++) {
      const tile = tiles[tileIndex]
      send({ type: 'progress', message: tiles.length > 1
        ? { key: 'progress.tile', params: { current: tileIndex + 1, total: tiles.length } }
        : { key: 'progress.detecting' } })
      const size = detectionSize(tile.width, tile.height)
      const detection = canvas(size.width, size.height)
      detection.context.drawImage(bitmap, tile.x, tile.y, tile.width, tile.height, 0, 0, size.width, size.height)
      const image = detection.context.getImageData(0, 0, size.width, size.height)
      const output = await infer(detector, normalize(image.data, 'detection'), size.width, size.height)
      const [batch, channels, height, width] = output.dims
      if (output.dims.length !== 4 || batch !== 1 || channels !== 1) throw new Error('error.detector')
      const regions = findTextRegions(output.data, width, height)
      for (let i = 0; i < regions.length; i++) {
        send({ type: 'progress', message: {
          key: tiles.length > 1 ? 'progress.textTile' : 'progress.text',
          params: { current: i + 1, total: regions.length, tile: tileIndex + 1, tiles: tiles.length },
        } })
        const region = regions[i]
        const x = tile.x + region.x * tile.width / width
        const y = tile.y + region.y * tile.height / height
        const w = region.width * tile.width / width
        const h = region.height * tile.height / height
        const recWidth = Math.max(32, Math.min(2048, Math.ceil(48 * w / h)))
        const input = canvas(recWidth, 48)
        input.context.drawImage(bitmap, x, y, w, h, 0, 0, recWidth, 48)
        const rec = await infer(recognizer, normalize(input.context.getImageData(0, 0, recWidth, 48).data, 'recognition'), recWidth, 48)
        if (rec.dims.length !== 3 || rec.dims[0] !== 1) throw new Error('error.recognizer')
        const result = decodeCTC(rec.data, rec.dims[1], rec.dims[2], dictionary)
        if (result.text.trim() && result.score >= 0.5) blocks.push({ ...result, x, y, width: w, height: h })
      }
    }
    send({ type: 'result', result: { ...arrangeBlocks(blocks), elapsed: performance.now() - started } })
  } finally {
    bitmap.close()
  }
}

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  if (running) return
  running = true
  try {
    if (event.data.type === 'init') await initialize(event.data.assets)
    else {
      if (!detector || !recognizer) throw new Error('error.notReady')
      await recognize(event.data.bitmap)
    }
  } catch (error) {
    send({ type: 'error', message: errorMessage(error, 'error.recognition') })
  } finally {
    running = false
  }
}
