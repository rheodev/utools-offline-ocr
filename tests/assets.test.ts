import test from 'node:test'
import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { readTarFiles, sha256, validateAsset } from '../scripts/asset-utils.mjs'

test('资源校验拒绝下载错误页、Git LFS 指针和不匹配的校验值', () => {
  assert.throws(() => validateAsset('det.onnx', Buffer.from('version https://git-lfs.github.com/spec/v1')), /完整/)
  assert.throws(() => validateAsset('engine.wasm', Buffer.from('<html>404</html>')), /WASM/)
  assert.throws(() => validateAsset('engine.mjs', Buffer.alloc(2000, '<')), /JavaScript/)
  assert.throws(() => validateAsset('keys.txt', Buffer.from('中\nA\n')), /6623/)
  assert.throws(() => validateAsset('a', Buffer.from('abc'), 'wrong'), /校验失败/)
  validateAsset('a', Buffer.from('abc'), sha256(Buffer.from('abc')))
})

test('运行库 tarball 只返回白名单文件，并拒绝缺失或截断条目', () => {
  const payload = Buffer.from('test module')
  const header = Buffer.alloc(512)
  header.write('package/dist/runtime.mjs')
  header.write(payload.length.toString(8).padStart(11, '0'), 124)
  const archive = gzipSync(Buffer.concat([header, payload, Buffer.alloc(512 - payload.length), Buffer.alloc(1024)]))
  const files = readTarFiles(archive, ['package/dist/runtime.mjs'])
  assert.equal(files.get('package/dist/runtime.mjs')?.toString(), 'test module')
  assert.throws(() => readTarFiles(archive, ['package/missing.mjs']), /缺少/)
  assert.throws(() => readTarFiles(gzipSync(header), ['package/dist/runtime.mjs']), /格式错误/)
})
