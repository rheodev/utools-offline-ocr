import test from 'node:test'
import assert from 'node:assert/strict'
import { OcrClient } from '../src/ocr/client.ts'
import { errorMessage, translate, type LocalizedMessage } from '../src/i18n/messages.ts'

function setup(workerError?: string) {
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const name of ['window', 'Worker', 'createImageBitmap']) originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  const workers: FakeWorker[] = []
  let closeCount = 0
  class FakeWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null
    onerror: ((event: unknown) => void) | null = null
    onmessageerror: (() => void) | null = null
    terminated = false
    hold = false
    constructor() { workers.push(this) }
    postMessage(message: { type: string }) {
      queueMicrotask(() => {
        if (this.terminated) return
        if (message.type === 'init') this.onmessage?.({ data: { type: 'ready' } })
        else {
          this.onmessage?.({ data: { type: 'progress', message: { key: 'progress.tile', params: { current: 1, total: 3 } } } })
          if (workerError) this.onmessage?.({ data: { type: 'error', message: { key: workerError } } })
          else if (!this.hold) this.complete()
        }
      })
    }
    complete() { this.onmessage?.({ data: { type: 'result', result: { text: '真实回传', blocks: [], elapsed: 1 } } }) }
    terminate() { this.terminated = true }
  }
  const host = { loadAssets: async () => ({}) }
  Object.defineProperty(globalThis, 'window', { value: { ocrHost: host }, configurable: true })
  Object.defineProperty(globalThis, 'Worker', { value: FakeWorker, configurable: true })
  Object.defineProperty(globalThis, 'createImageBitmap', { value: async () => ({ width: 200, height: 80, close() { closeCount++ } }), configurable: true })
  return {
    workers, host, closes: () => closeCount,
    client: () => new OcrClient(async () => new FakeWorker() as unknown as Worker),
    restore() { for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name) } },
  }
}

test('识别复用同一个 Worker 与模型，完成后释放图片', async () => {
  const fixture = setup()
  const client = fixture.client()
  try {
    let loads = 0
    fixture.host.loadAssets = async () => { loads++; return {} }
    assert.equal((await client.recognize(new Blob(['image']), () => {})).text, '真实回传')
    await client.recognize(new Blob(['image']), () => {})
    assert.equal(fixture.workers.length, 1)
    assert.equal(loads, 1)
    assert.equal(fixture.closes(), 2)
  } finally { client.cancel(); fixture.restore() }
})

test('取消资源加载后可马上重试，旧请求不会覆盖新请求的 busy 状态', async () => {
  const fixture = setup()
  const client = fixture.client()
  try {
    let release: (value: {}) => void = () => {}
    const delayed = new Promise<{}>(resolve => { release = resolve })
    let loads = 0
    fixture.host.loadAssets = () => ++loads === 1 ? delayed : Promise.resolve({})
    const first = client.recognize(new Blob(['first']), () => {}).catch(error => error)
    await new Promise(resolve => setTimeout(resolve, 0))
    client.cancel()
    const second = client.recognize(new Blob(['second']), () => {})
    fixture.workers[1].hold = true
    release({})
    const cancelled = await first
    assert.equal(cancelled.name, 'AbortError')
    await assert.rejects(client.recognize(new Blob(['third']), () => {}), { message: 'error.busy' })
    await new Promise(resolve => setTimeout(resolve, 0))
    fixture.workers[1].complete()
    assert.equal((await second).text, '真实回传')
    assert.equal(fixture.workers[0].terminated, true)
  } finally { client.cancel(); fixture.restore() }
})

test('资源缺失时返回可恢复错误并销毁 Worker', async () => {
  const fixture = setup()
  const client = fixture.client()
  try {
    fixture.host.loadAssets = async () => { throw new Error('ENOENT') }
    await assert.rejects(client.recognize(new Blob(['image']), () => {}), { message: 'error.assets' })
    assert.equal(fixture.workers[0].terminated, true)
    fixture.host.loadAssets = async () => ({})
    assert.equal((await client.recognize(new Blob(['image']), () => {})).text, '真实回传')
  } finally { client.cancel(); fixture.restore() }
})


test('Worker 的结构化进度可在切换语言后重新渲染', async () => {
  const fixture = setup()
  const client = fixture.client()
  try {
    const progress: LocalizedMessage[] = []
    await client.recognize(new Blob(['image']), message => progress.push(message))
    assert.equal(progress[0].key, 'progress.loading')
    const tile = progress.find(message => message.key === 'progress.tile')!
    assert.equal(translate('en', tile), 'Recognizing image region 1 / 3…')
    assert.equal(translate('zh-CN', tile), '正在识别第 1 / 3 个图片区域…')
  } finally { client.cancel(); fixture.restore() }
})

test('Worker 错误经过客户端仍保留可翻译的标识，并销毁失效 Worker', async () => {
  const fixture = setup('error.dictionaryMismatch')
  const client = fixture.client()
  try {
    await assert.rejects(client.recognize(new Blob(['image']), () => {}), error => {
      const message = errorMessage(error)
      assert.equal(message.key, 'error.dictionaryMismatch')
      assert.match(translate('en', message), /do not match/)
      assert.match(translate('zh-CN', message), /不匹配/)
      return true
    })
    assert.equal(fixture.workers[0].terminated, true)
  } finally { client.cancel(); fixture.restore() }
})
