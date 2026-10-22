export const ORT_VERSION = '1.20.1'
const revision = '4e4644045a07c403b1ad40ca97340ecb4a8dc2c1'
const modelBase = `https://huggingface.co/SWHL/RapidOCR/resolve/${revision}/PP-OCRv4`

export const MODELS = [
  {
    name: 'models/det.onnx',
    url: `${modelBase}/ch_PP-OCRv4_det_infer.onnx`,
    sha256: 'd2a7720d45a54257208b1e13e36a8479894cb74155a5efe29462512d42f49da9',
  },
  {
    name: 'models/rec.onnx',
    url: `${modelBase}/ch_PP-OCRv4_rec_infer.onnx`,
    sha256: '48fc40f24f6d2a207a2b1091d3437eb3cc3eb6b676dc3ef9c37384005483683b',
  },
  {
    name: 'models/keys.txt',
    url: 'https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/fbba2178d7093f1dffca65a5b963ec277f1a6125/ppocr/utils/ppocr_keys_v1.txt',
  },
]

export const RUNTIME_FILES = [
  'ort.wasm.min.mjs',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
]
export const REQUIRED_ASSETS = [...MODELS.map(model => model.name), ...RUNTIME_FILES.map(file => `vendor/ort/${file}`)]
