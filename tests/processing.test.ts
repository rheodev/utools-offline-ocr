import test from 'node:test'
import assert from 'node:assert/strict'
import { arrangeBlocks, decodeCTC, detectionSize, findTextRegions, makeTiles, normalize, parseDictionary, validateDimensions } from '../src/ocr/processing.ts'
import type { TextBlock } from '../src/types.ts'

test('CTC 去掉连续重复与 blank，保留 blank 分隔的重复字和英文空格', () => {
  const dictionary = ['', '中', 'A', ' ']
  const indices = [1, 1, 0, 1, 3, 2, 2, 0]
  const logits = new Float32Array(indices.length * dictionary.length).fill(0.01)
  indices.forEach((index, step) => { logits[step * dictionary.length + index] = 0.97 })
  const result = decodeCTC(logits, indices.length, dictionary.length, dictionary)
  assert.equal(result.text, '中中 A')
  assert.ok(Math.abs(result.score - 0.97) < 0.00001)
})

test('全 blank 返回空文本和零置信度；拒绝模型字典尺寸不匹配', () => {
  assert.deepEqual(decodeCTC(new Float32Array([1, 0, 1, 0]), 2, 2, ['', 'A']), { text: '', score: 0 })
  assert.throws(() => decodeCTC(new Float32Array(6), 2, 3, ['', 'A']), /不匹配/)
})

test('字典处理 BOM、CRLF 与尾换行，并保留字符顺序', () => {
  assert.deepEqual(parseDictionary('\uFEFF中\r\nA\r\n'), ['', '中', 'A', ' '])
  assert.throws(() => parseDictionary('中\n\nA\n'), /字典无效/)
})

test('RGBA 正确转为 CHW；分别使用检测和识别归一化', () => {
  const rgba = new Uint8ClampedArray([255, 0, 128, 255, 0, 255, 0, 255])
  const rec = normalize(rgba, 'recognition')
  assert.deepEqual([...rec.subarray(0, 4)], [1, -1, -1, 1])
  assert.ok(Math.abs(rec[4] - (128 / 127.5 - 1)) < 0.000001)
  const det = normalize(rgba, 'detection')
  assert.ok(Math.abs(det[0] - (1 - 0.485) / 0.229) < 0.000001)
  assert.ok(Math.abs(det[2] - (0 - 0.456) / 0.224) < 0.000001)
})

test('检测缩放保留 32 的倍数，并限制最大边', () => {
  assert.deepEqual(detectionSize(1536, 768), { width: 960, height: 480 })
  assert.deepEqual(detectionSize(10, 10), { width: 32, height: 32 })
})

test('长截图和宽图片分块没有空隙，覆盖末端且不超过边界', () => {
  for (const [width, height] of [[400, 6000], [6000, 400], [2200, 2200], [100, 80]]) {
    const tiles = makeTiles(width, height)
    assert.equal(Math.min(...tiles.map(t => t.x)), 0)
    assert.equal(Math.min(...tiles.map(t => t.y)), 0)
    assert.equal(Math.max(...tiles.map(t => t.x + t.width)), width)
    assert.equal(Math.max(...tiles.map(t => t.y + t.height)), height)
    for (const tile of tiles) {
      assert.ok(tile.width > 0 && tile.height > 0 && tile.width <= 1536 && tile.height <= 1536)
      assert.ok(tile.x >= 0 && tile.y >= 0 && tile.x + tile.width <= width && tile.y + tile.height <= height)
    }
    for (let y = 0; y < height; y += 73) for (let x = 0; x < width; x += 67) {
      assert.ok(tiles.some(t => x >= t.x && x < t.x + t.width && y >= t.y && y < t.y + t.height))
    }
  }
  assert.throws(() => makeTiles(100, 100, 64, 64), /无效/)
})

test('拒绝异常尺寸与超大图片', () => {
  for (const size of [[0, 10], [-1, 10], [1.5, 10], [Infinity, 10], [5000, 5000], [30_001, 1]]) {
    assert.throws(() => validateDimensions(size[0], size[1]))
  }
})

test('检测后处理过滤噪点和低置信度区域，扩张文本框并限制边界', () => {
  const width = 40, height = 24
  const heatmap = new Float32Array(width * height)
  for (let y = 0; y < 5; y++) for (let x = 0; x < 12; x++) heatmap[y * width + x] = 0.95
  for (let y = 15; y < 20; y++) for (let x = 25; x < 35; x++) heatmap[y * width + x] = 0.4
  heatmap[10 * width + 20] = 0.99
  const boxes = findTextRegions(heatmap, width, height)
  assert.equal(boxes.length, 1)
  assert.equal(boxes[0].x, 0)
  assert.equal(boxes[0].y, 0)
  assert.ok(boxes[0].width > 12 && boxes[0].height > 5)
  assert.ok(boxes[0].x + boxes[0].width <= width)
  assert.throws(() => findTextRegions(heatmap, 1, 1), /不匹配/)
})

function block(text: string, x: number, y: number, score = 0.9): TextBlock {
  return { text, x, y, width: 100, height: 20, score }
}

test('文字按行和从左到右排序，只对空间重叠的文本去重', () => {
  const result = arrangeBlocks([
    block('第二行', 0, 60), block('右侧', 120, 12), block('左侧', 0, 10),
    block('左侧', 2, 11, 0.7), block('左侧', 0, 90),
  ])
  assert.equal(result.text, '左侧 右侧\n第二行\n左侧')
  assert.equal(result.blocks.length, 4)
  assert.deepEqual(arrangeBlocks([]), { blocks: [], text: '' })
})
