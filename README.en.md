# utools-offline-ocr

[简体中文](README.md) · [English](README.en.md)

Offline Chinese & English OCR for uTools, powered by PaddleOCR and ONNX Runtime Web. Local processing, no uploads.

Built for uTools on Windows and macOS. Extract editable, copyable text from images of horizontal printed text.

## Features

- **Multiple inputs**: select, drag and drop, or paste a single image, or capture a screen region through uTools.
- **Preview and edit**: view the original image on the left, edit recognized text on the right, and copy it with one click.
- **Task controls**: cancel, retry, and clear; reuse model sessions and process long images in tiles.
- **Local processing**: models and runtime assets ship with the plugin. Images are never uploaded, and recognition history is not saved.
- **Bilingual interface**: Simplified Chinese and English, with automatic detection, manual switching, and saved preferences.
- **Image support**: PNG, JPG, WebP, and BMP; up to 20 MB and 20 million pixels per image.

## Preview

Screenshot to be added: image preview on the left, text editor on the right.

<!-- Add a relative link to a real screenshot stored in the repository here. -->

## Build and install

Building requires **Node.js 22.12 or later**. Installing dependencies and preparing offline assets require internet access. Plugin users do not need Node.js or Python.

Run from the project root:

```sh
npm ci
npm run assets:prepare
npm run check
npm run build
```

The asset script downloads pinned PP-OCRv4 detection and recognition models, the matching dictionary, and ONNX Runtime Web. It verifies model SHA-256 hashes and the runtime's npm SRI, then generates a local asset manifest. Models and runtime files are excluded from Git.

After building:

1. Import `dist/plugin.json` in the uTools developer tools.
2. Rebuild and reload the plugin in uTools after changing the source.
3. To distribute the plugin, package it as an offline installer using the uTools developer tools.

Production builds check models, the dictionary, WASM, the asset manifest, and license files. Source files alone, `public/plugin.json`, or the UI preview directory cannot provide offline OCR.

## Usage

Choose **Auto / 简体中文 / English** in the upper-right corner. Auto mode reads `navigator.language`: Chinese locales use Simplified Chinese; all other locales use English. This may differ from the uTools interface language. Switching immediately updates the interface, progress, and errors while preserving recognized text. The language preference is saved locally.

Use `Offline OCR` to open the interface or `Capture OCR` to capture a screen region. Image and file matching entries have bilingual labels.

| Entry | Action |
| --- | --- |
| `离线文字识别` / `离线OCR` | Open the interface, then select, drop, or paste an image |
| `离线截图识别` | Capture a screen region and recognize its text |
| uTools image matching | Paste an image and choose `离线识别图片文字` |
| uTools file matching | Select one image file and choose `离线识别图片文件` |

Edit and copy the result after recognition. You can also cancel, retry, or clear the task. On macOS, grant uTools screen recording permission when prompted for the first capture.

## Development

```sh
npm run dev
```

Use a browser to develop file selection, drag and drop, pasting, and text editing. Recognition requires the complete offline assets. Test screen capture and host entry points inside uTools.

| Command | Purpose |
| --- | --- |
| `npm run check` | Run type checking and automated tests |
| `npm run assets:check` | Validate local offline assets |
| `npm run build` | Build and validate the production plugin in `dist/` |
| `npm run build:ui` | Build only the UI into `dist-preview/` |
| `npm run preview` | Preview `dist-preview/` |

`dist-preview/` is for UI development and is not a production plugin package.

### Import prepared offline assets

Run the asset preparation script on another machine, then copy its prepared `public/` directory to the build machine:

```sh
npm run assets:prepare -- --from /path/to/prepared-public
npm run build
```

```text
public/
  models/
    det.onnx
    rec.onnx
    keys.txt
    assets-lock.json
  vendor/ort/
    ort.wasm.min.mjs
    ort-wasm-simd-threaded.mjs
    ort-wasm-simd-threaded.wasm
  licenses/
    ONNX-Runtime-MIT.txt
```

`--from` validates imported assets and regenerates the manifest. Use matching versions prepared by this project's script; do not mix models, dictionaries, or runtime files. Dependencies must already be installed.

## Stack and structure

Vue 3 · TypeScript · Vite · PaddleOCR PP-OCRv4 lightweight models · ONNX Runtime Web 1.20.1 · WASM · Web Worker

```text
src/App.vue             Image input, preview, text editing, and status feedback
src/ocr/                Worker lifecycle, inference, and horizontal text processing
public/plugin.json      uTools commands and platform configuration
public/preload.js       Local file, clipboard, capture, and asset bridge
public/package.json     Declares the plugin directory as CommonJS
scripts/                Asset preparation, integrity checks, and build validation
tests/                  Text processing, task lifecycle, bridge, and asset tests
```

The Worker starts from an inline Blob. Inside uTools, preload reads local model and runtime bytes and passes them to the Worker. Browser development loads assets from the same origin. WASM runs in a single thread and does not require host cross-origin isolation.

## Scope and validation

The current pipeline targets **horizontal printed Chinese and English**, using axis-aligned post-processing. Skew correction, complex columns, table reconstruction, formulas, handwriting, and PDF input are not supported.

Automated tests cover post-processing, cancellation and retries, asset validation, and a simulated host bridge. They do not establish real-world OCR accuracy or verify Windows/macOS compatibility on actual devices. Before releasing, test in uTools on both platforms:

- Offline cold starts, file/paste/capture/image-matching entry points, and offline package reinstallation.
- Accuracy and latency with Chinese and English, small text, dark backgrounds, blank images, and long images.
- Retry after cancellation, repeated plugin entry, editing and copying, capture cancellation, and macOS permission flows.

## Third-party licenses

See the [third-party notices](public/licenses/THIRD-PARTY.md) (in Chinese) and the [license directory](public/licenses/) for model and component sources and licenses.
