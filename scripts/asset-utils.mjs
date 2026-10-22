import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'

export function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex') }

export function validateAsset(name, bytes, expectedHash) {
  if (!bytes?.length) throw new Error(`${name} 为空`)
  if (expectedHash && sha256(bytes) !== expectedHash) throw new Error(`${name} SHA-256 校验失败`)
  if (name.endsWith('.onnx') && bytes.length < 1_000_000) throw new Error(`${name} 不是完整的模型文件`)
  if (name.endsWith('.wasm') && !Buffer.from(bytes).subarray(0, 4).equals(Buffer.from([0, 97, 115, 109]))) {
    throw new Error(`${name} 不是有效的 WASM 文件`)
  }
  if (name.endsWith('.mjs') && (bytes.length < 1000 || /^\s*</.test(Buffer.from(bytes).toString('utf8', 0, 100)))) {
    throw new Error(`${name} 不是有效的 JavaScript 模块`)
  }
  if (name.endsWith('keys.txt')) {
    const keys = Buffer.from(bytes).toString('utf8').replace(/\r/g, '').trimEnd().split('\n')
    if (keys.length !== 6623 || keys.some(key => !key.length)) throw new Error('字典必须包含 PP-OCRv4 对应的 6623 个字符')
  }
}

// 只从已通过 npm SRI 校验的 tarball 中读取白名单文件，不提取任意路径。
export function readTarFiles(tarGzip, requested) {
  const tar = gunzipSync(tarGzip, { maxOutputLength: 200 * 1024 * 1024 })
  const files = new Map()
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break
    const name = header.subarray(0, 100).toString().split('\0')[0]
    const size = parseInt(header.subarray(124, 136).toString().replace(/\0/g, '').trim(), 8)
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw new Error('运行库压缩包格式错误')
    if (requested.includes(name)) files.set(name, tar.subarray(offset + 512, offset + 512 + size))
    offset += 512 + Math.ceil(size / 512) * 512
  }
  for (const name of requested) if (!files.has(name)) throw new Error(`运行库中缺少 ${name}`)
  return files
}
