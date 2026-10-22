import type { TextBlock } from '../types.ts'

export interface Rect { x: number; y: number; width: number; height: number }

export const MAX_IMAGE_PIXELS = 20_000_000
export const MAX_FILE_BYTES = 20 * 1024 * 1024

export function validateDimensions(width: number, height: number) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new Error('图片尺寸无效，请换一张图片')
  }
  if (width * height > MAX_IMAGE_PIXELS || width > 30_000 || height > 30_000) {
    throw new Error('图片尺寸过大，请裁剪后重试（最多 2000 万像素）')
  }
}

// 保留相邻切片的重叠区，避免文字刚好落在切片边缘被截断。
export function makeTiles(width: number, height: number, size = 1536, overlap = 128): Rect[] {
  validateDimensions(width, height)
  if (size <= overlap || overlap < 0) throw new Error('无效的分块尺寸')
  const offsets = (length: number) => {
    const result = [0]
    while (result[result.length - 1] + size < length) {
      const next = Math.min(result[result.length - 1] + size - overlap, length - size)
      if (next <= result[result.length - 1]) break
      result.push(next)
    }
    return result
  }
  return offsets(height).flatMap(y => offsets(width).map(x => ({
    x, y, width: Math.min(size, width - x), height: Math.min(size, height - y),
  })))
}

export function detectionSize(width: number, height: number) {
  const scale = Math.min(1, 960 / Math.max(width, height))
  return {
    width: Math.max(32, Math.round(width * scale / 32) * 32),
    height: Math.max(32, Math.round(height * scale / 32) * 32),
  }
}

// RGBA → RGB CHW；检测使用 ImageNet 归一化，识别使用 [-1, 1]。
export function normalize(data: Uint8ClampedArray, mode: 'detection' | 'recognition') {
  const pixels = data.length / 4
  const output = new Float32Array(pixels * 3)
  const mean = mode === 'detection' ? [0.485, 0.456, 0.406] : [0.5, 0.5, 0.5]
  const std = mode === 'detection' ? [0.229, 0.224, 0.225] : [0.5, 0.5, 0.5]
  for (let i = 0; i < pixels; i++) {
    for (let c = 0; c < 3; c++) output[c * pixels + i] = (data[i * 4 + c] / 255 - mean[c]) / std[c]
  }
  return output
}

/**
 * 面向横排文字的 DB 后处理：8 邻域连通域、置信度过滤、轴对齐文本框扩张。
 * 第一版不做旋转文本的最小外接四边形/透视校正。
 */
export function findTextRegions(probabilities: Float32Array, width: number, height: number): Rect[] {
  if (probabilities.length !== width * height) throw new Error('检测模型输出尺寸不匹配')
  const visited = new Uint8Array(probabilities.length)
  const queue = new Int32Array(probabilities.length)
  const regions: Rect[] = []
  for (let seed = 0; seed < probabilities.length; seed++) {
    if (visited[seed] || probabilities[seed] < 0.3) continue
    let head = 0, tail = 1, sum = 0
    queue[0] = seed
    visited[seed] = 1
    let minX = width, maxX = 0, minY = height, maxY = 0
    while (head < tail) {
      const index = queue[head++]
      const x = index % width, y = Math.floor(index / width)
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      sum += probabilities[index]
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          const next = ny * width + nx
          if (!visited[next] && probabilities[next] >= 0.3) {
            visited[next] = 1
            queue[tail++] = next
          }
        }
      }
    }
    const w = maxX - minX + 1, h = maxY - minY + 1
    if (Math.min(w, h) < 3 || tail < 8 || sum / tail < 0.6) continue
    const pad = w * h * 1.5 / (2 * (w + h))
    const x = Math.max(0, Math.floor(minX - pad)), y = Math.max(0, Math.floor(minY - pad))
    regions.push({ x, y, width: Math.min(width, Math.ceil(maxX + pad + 1)) - x, height: Math.min(height, Math.ceil(maxY + pad + 1)) - y })
    if (regions.length > 1000) throw new Error('文字区域过多，请分区域截图识别')
  }
  return regions
}

export function parseDictionary(text: string) {
  const characters = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n')
  if (characters[characters.length - 1] === '') characters.pop()
  if (!characters.length || characters.some(c => c === '')) throw new Error('识别字典无效')
  return ['', ...characters, ' ']
}

export function decodeCTC(data: Float32Array, steps: number, classes: number, dictionary: string[]) {
  if (classes !== dictionary.length || data.length !== steps * classes) {
    throw new Error('识别模型与字典不匹配，请重新安装插件')
  }
  let previous = -1, total = 0, count = 0, text = ''
  for (let t = 0; t < steps; t++) {
    let best = 0, score = -Infinity
    for (let c = 0; c < classes; c++) {
      const value = data[t * classes + c]
      if (value > score) { best = c; score = value }
    }
    if (best !== 0 && best !== previous) { text += dictionary[best]; total += score; count++ }
    previous = best
  }
  return { text, score: count ? total / count : 0 }
}

function intersectionOverSmaller(a: Rect, b: Rect) {
  const w = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const h = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return w * h / Math.min(a.width * a.height, b.width * b.height)
}

export function arrangeBlocks(blocks: TextBlock[]) {
  // 切片交叠产生的重复文本仅在空间也重合时去重，保留真实重复行。
  const unique: TextBlock[] = []
  for (const block of [...blocks].sort((a, b) => b.score - a.score)) {
    const duplicate = unique.some(other => intersectionOverSmaller(block, other) > 0.65 &&
      (other.text === block.text || other.text.includes(block.text) || block.text.includes(other.text)))
    if (!duplicate) unique.push(block)
  }
  const rows: { center: number; height: number; blocks: TextBlock[] }[] = []
  for (const block of unique.sort((a, b) => a.y - b.y || a.x - b.x)) {
    const center = block.y + block.height / 2
    const row = rows.find(row => Math.abs(row.center - center) < Math.min(row.height, block.height) * 0.45)
    if (row) row.blocks.push(block)
    else rows.push({ center, height: block.height, blocks: [block] })
  }
  const sorted = rows.sort((a, b) => a.center - b.center).map(row => row.blocks.sort((a, b) => a.x - b.x))
  return { blocks: sorted.flat(), text: sorted.map(row => row.map(b => b.text).join(' ')).join('\n') }
}
