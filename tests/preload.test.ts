import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const preloadUrl = new URL('../public/preload.js', import.meta.url)
const source = await readFile(preloadUrl, 'utf8')

test('在 type: module 项目中仍通过 CommonJS 加载配置指定的 preload', async () => {
  const plugin = JSON.parse(await readFile(new URL('../public/plugin.json', import.meta.url), 'utf8'))
  assert.equal(plugin.preload, 'preload.js')
  const configuredPath = fileURLToPath(new URL(`../public/${plugin.preload}`, import.meta.url))
  execFileSync(process.execPath, ['--input-type=commonjs', '-e', `
    const assert = require('node:assert/strict')
    const Module = require('node:module')
    const originalLoad = Module._load
    Module._load = function (name, ...args) {
      if (name === 'electron') return { clipboard: {} }
      return originalLoad.call(this, name, ...args)
    }
    global.window = {}
    global.utools = { onPluginEnter() {} }
    require(process.argv[1])
    assert.equal(typeof window.ocrHost.capture, 'function')
  `, configuredPath], { stdio: 'pipe' })
})

function hostFixture() {
  let callback: (action: unknown) => void
  const events: string[] = []
  const fs = {
    readFile: async () => Buffer.from([1, 2, 3]),
    open: async () => ({
      stat: async () => ({ isFile: () => true, size: 3 }),
      read: async (bytes: Buffer) => { bytes.set([1, 2, 3]); return { bytesRead: 3 } },
      close: async () => { events.push('closed') },
    }),
  }
  const utools = {
    onPluginEnter: (fn: typeof callback) => { callback = fn },
    hideMainWindow: () => { events.push('hide') },
    screenCapture: async (): Promise<string> => { throw new Error('cancel') },
    showMainWindow: () => { events.push('show') },
  }
  const window: { ocrHost?: Record<string, (...args: any[]) => any> } = {}
  vm.runInNewContext(source, {
    require: (name: string) => name === 'node:fs/promises' ? fs : name === 'node:path' ? path : { clipboard: { readImage: () => ({ isEmpty: () => true }), writeText: () => {} } },
    window, utools, __dirname: '/plugin', Buffer, Uint8Array, queueMicrotask,
  })
  return { host: window.ocrHost!, enter: (action: unknown) => callback!(action), events }
}

test('preload 缓存提前到达的 uTools 入口，订阅后只投递一次', async () => {
  const fixture = hostFixture()
  const action = { code: 'ocr', type: 'text' }
  fixture.enter(action)
  const actions: unknown[] = []
  const unsubscribe = fixture.host.onEnter((value: unknown) => actions.push(value))
  await new Promise(resolve => queueMicrotask(() => resolve(null)))
  assert.deepEqual(actions, [action])
  fixture.enter({ code: 'capture' })
  assert.equal(actions.length, 2)
  unsubscribe()
  fixture.enter(action)
  assert.equal(actions.length, 2)
})

test('取消截图仍恢复窗口，空剪贴板返回 null', async () => {
  const { host, events } = hostFixture()
  assert.equal(await host.capture(), null)
  assert.deepEqual(events, ['hide', 'show'])
  assert.equal(host.clipboardImage(), null)
})

test('图片文件桥接拒绝相对路径和非图片扩展，读取后关闭句柄', async () => {
  const { host, events } = hostFixture()
  await assert.rejects(host.readImageFile('relative.png'), { message: 'error.invalidPath' })
  await assert.rejects(host.readImageFile('/tmp/test.txt'), { message: 'error.imageType' })
  const image = await host.readImageFile('/tmp/测试.PNG')
  assert.equal(image.name, '测试.PNG')
  assert.equal(image.dataUrl, 'data:image/png;base64,AQID')
  assert.deepEqual(events, ['closed'])
})
