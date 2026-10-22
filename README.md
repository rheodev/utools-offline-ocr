# utools-offline-ocr

[简体中文](README.md) · [English](README.en.md)

适用于 uTools 的离线中英文 OCR 插件，基于 PaddleOCR 与 ONNX Runtime Web，图片在本地处理，无需上传。

面向 Windows / macOS，将横排印刷图片中的文字转为可编辑、可复制的文本。

## 功能

- **多种输入**：选择、拖放、粘贴单张图片，或通过 uTools 框选截图。
- **识别与编辑**：左侧预览原图，右侧编辑结果并一键复制。
- **任务控制**：取消、重新识别、清空；复用模型会话，长图分块处理。
- **本地运行**：模型与运行资源随插件交付，不上传图片、不保存识别历史。
- **双语界面**：支持简体中文与英文，可自动选择或手动切换并保存偏好。
- **图片支持**：PNG、JPG、WebP、BMP；单张不超过 20 MB / 2000 万像素。

## 界面预览

截图待补充：左侧为图片预览，右侧为文字编辑区。

<!-- 添加真实截图后，在这里插入仓库内的相对图片链接。 -->

## 构建与安装

构建环境需要 **Node.js 22.12 或以上**。依赖安装与离线资源准备需要联网；插件用户无需安装 Node.js 或 Python。

在项目根目录执行：

```sh
npm ci
npm run assets:prepare
npm run check
npm run build
```

资源准备脚本下载固定版本的 PP-OCRv4 检测、识别模型、配套字典与 ONNX Runtime Web，验证模型 SHA-256 和运行库 npm SRI，并生成本地资源清单。模型和运行库不纳入 Git。

构建完成后：

1. 在 uTools「开发者工具」中选择 `dist/plugin.json` 导入。
2. 修改源码后重新构建，并在 uTools 中重新加载插件。
3. 如需分发，可通过 uTools 开发者工具打包为离线安装包。

正式构建会检查模型、字典、WASM、资源清单和许可文件。仅有源码、`public/plugin.json` 或界面预览目录无法完成离线 OCR。

## 使用

| 入口 | 操作 |
| --- | --- |
| `离线文字识别` / `离线OCR` | 打开主界面，选择、拖放或粘贴图片 |
| `离线截图识别` | 框选屏幕区域并识别 |
| uTools 图片匹配 | 粘贴图片后选择「离线识别图片文字」 |
| uTools 文件匹配 | 选择单个图片文件后选择「离线识别图片文件」 |

界面右上角可选择「自动 / 简体中文 / English」。自动模式读取 `navigator.language`：中文环境显示简体中文，其他语言显示英文；这不保证与 uTools 的界面语言一致。切换语言会即时更新界面、进度与错误提示，保留已识别文本。插件会在本地保存语言偏好。

也可通过 `Offline OCR` 和 `Capture OCR` 英文指令打开插件或截图识别；图片与文件匹配入口采用中英双语标签。

识别完成后可编辑文本并复制，也可取消任务、重新识别或清空。macOS 首次截图需按系统提示为 uTools 授予屏幕录制权限。

## 开发

```sh
npm run dev
```

浏览器可调试文件选择、拖放、粘贴和文字编辑；识别需要先准备完整离线资源，截图与宿主入口需在 uTools 内测试。

| 命令 | 用途 |
| --- | --- |
| `npm run check` | 类型检查与自动化测试 |
| `npm run assets:check` | 校验本地离线资源 |
| `npm run build` | 构建并校验正式插件，输出 `dist/` |
| `npm run build:ui` | 仅构建界面，输出 `dist-preview/` |
| `npm run preview` | 预览 `dist-preview/` |

`dist-preview/` 用于界面调试，不是正式插件包。

### 导入已有离线资源

可在另一台机器运行资源准备脚本，再将准备好的 `public/` 目录复制到构建机：

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

`--from` 检查导入资源并重新生成清单。请使用本项目脚本准备的相同版本资源，不要混用模型、字典或运行库文件；依赖仍需提前安装。

## 技术栈与目录

Vue 3 · TypeScript · Vite · PaddleOCR PP-OCRv4 轻量模型 · ONNX Runtime Web 1.20.1 · WASM · Web Worker

```text
src/App.vue             图片输入、预览、文本编辑与状态反馈
src/ocr/                Worker 生命周期、模型推理与横排文字后处理
public/plugin.json      uTools 指令与平台配置
public/preload.js       本地文件、剪贴板、截图与资源桥接
public/package.json     将插件目录指定为 CommonJS
scripts/                资源准备、完整性校验与构建验证
tests/                  后处理、任务生命周期、桥接与资源校验测试
```

Worker 以内联 Blob 启动。uTools 内由 preload 读取本地模型与运行库字节，再传给 Worker；浏览器调试从同源目录加载资源。WASM 固定单线程，不要求宿主开启跨源隔离。

## 适用范围与验证

当前面向**横排印刷中英文**，使用轴对齐后处理；不提供倾斜矫正、复杂分栏、表格还原、公式、手写或 PDF 识别。

自动化测试覆盖后处理、取消重试、资源校验和模拟宿主桥接，不代表真实 OCR 精度或 Windows / macOS 实机验收。发布前需在两平台的实际 uTools 内验证：

- 断网冷启动、文件/粘贴/截图/图片匹配入口及离线包重装。
- 中英文、小字、深色背景、空白图和长图的准确率与耗时。
- 取消后重试、反复进入插件、编辑复制、截图取消及 macOS 权限流程。

## 第三方许可

模型与组件的来源和许可证见 [第三方说明](public/licenses/THIRD-PARTY.md) 及 [许可目录](public/licenses/)。
