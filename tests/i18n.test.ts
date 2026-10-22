import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { messages, translate, errorMessage, type MessageKey } from '../src/i18n/messages.ts'
import { LANGUAGE_STORAGE_KEY, readPreference, resolveLocale, savePreference } from '../src/i18n/preferences.ts'

test('自动模式识别中文地区变体，其他语言回退英文；手动选择优先', () => {
  for (const language of ['zh', 'zh-CN', 'zh-TW', 'zh-Hant', 'ZH-hk', 'zh_CN']) {
    assert.equal(resolveLocale('auto', language), 'zh-CN')
  }
  for (const language of ['en', 'en-US', 'fr-FR', '', 'zho']) {
    assert.equal(resolveLocale('auto', language), 'en')
  }
  assert.equal(resolveLocale('en', 'zh-CN'), 'en')
  assert.equal(resolveLocale('zh-CN', 'en-US'), 'zh-CN')
})

test('偏好保存后可恢复；切回自动后重新跟随环境语言', () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  assert.equal(readPreference(storage), 'auto')
  savePreference(storage, 'en')
  assert.equal(readPreference(storage), 'en')
  assert.equal(resolveLocale(readPreference(storage), 'zh-CN'), 'en')
  savePreference(storage, 'auto')
  assert.equal(resolveLocale(readPreference(storage), 'zh-CN'), 'zh-CN')
  assert.equal(resolveLocale(readPreference(storage), 'en-US'), 'en')
  storage.setItem(LANGUAGE_STORAGE_KEY, 'invalid-value')
  assert.equal(readPreference(storage), 'auto')
})

test('存储读写或访问权限失败时保持可用', () => {
  const denied = { getItem(): string { throw new Error('denied') }, setItem() { throw new Error('denied') } }
  assert.equal(readPreference(denied), 'auto')
  assert.doesNotThrow(() => savePreference(denied, 'zh-CN'))
})

test('两种语言的所有文案及插值参数保持一致', () => {
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages['zh-CN']).sort())
  for (const key of Object.keys(messages.en) as MessageKey[]) {
    const placeholders = (value: string) => value.match(/\{\w+\}/g)?.sort() ?? []
    assert.ok(messages.en[key].length > 0, key)
    assert.deepEqual(placeholders(messages.en[key]), placeholders(messages['zh-CN'][key]), key)
    assert.doesNotMatch(messages.en[key], /\p{Script=Han}/u, key)
  }
})

test('同一条进度、错误和计数可即时翻译，插值不修改识别内容', () => {
  const progress = { key: 'progress.textTile' as const, params: { current: 2, total: 5, tile: 1, tiles: 3 } }
  assert.equal(translate('en', progress), 'Extracting text 2 / 5 (region 1 / 3)…')
  assert.equal(translate('zh-CN', progress), '正在提取文字 2 / 5（区域 1 / 3）…')
  const error = errorMessage(new Error('error.assets'))
  assert.match(translate('en', error), /Reinstall/)
  assert.match(translate('zh-CN', error), /重新安装/)
  assert.equal(translate('en', { key: 'text.countOne', params: { count: 1 } }), '1 character')
  assert.equal(translate('en', { key: 'text.count', params: { count: 0 } }), '0 characters')
  assert.equal(translate('en', { key: 'image.alt', params: { name: '中文{count}.png' } }), 'Image to recognize: 中文{count}.png')
})

test('跨 preload 环境的错误可翻译，未知错误使用本地化兜底', () => {
  const crossRealmError = vm.runInNewContext("new Error('error.invalidPath')")
  assert.equal(errorMessage(crossRealmError).key, 'error.invalidPath')
  for (const error of [new Error('ENOENT /private/user/file'), null, '未知错误', new Error('toString')]) {
    assert.deepEqual(errorMessage(error), { key: 'error.operation' })
  }
  assert.equal(errorMessage(new Error('WASM failure'), 'error.recognition').key, 'error.recognition')
})
