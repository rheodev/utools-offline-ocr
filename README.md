# uTools 离线文字识别

Windows / macOS 的 uTools 插件。将横排印刷图片中的中英文转为可编辑、可复制的文字。

## 功能

- 选择、拖放或粘贴单张图片，也可通过 uTools 框选截图。
- 左侧预览原图，右侧编辑识别结果并一键复制。
- 支持取消、重新识别、清空；模型会话复用，长图分块识别。
- 图片上限 20 MB / 2000 万像素；支持 PNG、JPG、WebP、BMP。
- 运行时只使用插件附带的本地资源，不上传图片，不保存历史。

技术栈：Vue 3、TypeScript、Vite、ONNX Runtime Web 1.20.1、Web Worker。当前以 PP-OCRv4 轻量检测和识别模型作为基线；横排文字使用轴对齐后处理，不提供倾斜矫正、复杂分栏、表格或手写识别。

## 开发与构建

需要 Node.js 22.12 或以上。依赖安装和离线资源准备在**可联网的构建机**完成一次；最终用户使用插件不需要 Node.js、Python 或网络。

```sh
npm install
npm run assets:prepare
npm run check
npm run build
```

`assets:prepare` 下载约 15.6 MB 的两个模型、配套字典及固定版本 ONNX Runtime。模型检查固定 SHA-256，运行库检查 npm SRI，随后生成本地资源清单。最终体积以实际资源为准。

构建成功后，在 uTools「开发者工具」中选择 `dist/plugin.json` 导入。修改完成后重新构建并重新加载插件；可通过开发者工具打包为离线安装包。**仅有源码、`public/plugin.json` 或界面预览目录无法完成离线 OCR。**

可用指令：

- `离线文字识别` / `离线OCR`：打开主界面。
- `离线截图识别`：框选屏幕并识别。
- 在 uTools 粘贴图片或选择一个图片文件后，选择对应的离线识别匹配指令。

macOS 首次截图需按系统提示为 uTools 授予屏幕录制权限。

## 界面调试

```sh
npm run dev
```

普通浏览器可测试文件选择、拖放、粘贴和文字编辑；uTools 截图与宿主入口需要在 uTools 内测试。要在浏览器中识别，也需要先准备完整离线资源。

只构建界面以检查编译：

```sh
npm run build:ui
npm run preview
```

输出为 `dist-preview/`，不是正式插件。正式 `npm run build` 会拒绝缺少模型、字典、WASM、资源清单或许可文件的构建。

## 已有资源的离线导入

可在另一台机器准备资源，再将其 `public` 目录复制过来：

```sh
npm run assets:prepare -- --from /path/to/prepared-public
npm run build
```

资源目录结构：

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

`--from` 会检查模型和资源格式并重新记录清单。请使用由本项目准备脚本生成的相同版本资源，不要混用不同版本的模型、字典、运行库 JS 与 WASM。

## 代码结构

```text
public/plugin.json         uTools 指令与平台配置
public/preload.js          本地文件、剪贴板、截图和资源桥接，按 CommonJS 原样交付
public/package.json        指定插件目录为 CommonJS，避免继承开发项目的 ESM 配置
src/App.vue                图片输入、预览、编辑和状态反馈
src/ocr/client.ts          Worker 生命周期、取消和超时处理
src/ocr/ocr.worker.ts      本地引擎初始化、检测和识别流水线
src/ocr/processing.ts      归一化、横排检测后处理、CTC 和文字排序
scripts/                   资源准备、完整性校验、正式构建验证
tests/                     后处理、异步生命周期、桥接与资源校验测试
```

Worker 以内联 Blob 形式启动；uTools 中由 preload 读取本地模型与运行库字节，再转移给 Worker，避免依赖 `file://` 的 fetch 行为。浏览器调试时从同源静态目录读取资源。WASM 固定单线程，不要求宿主开启跨源隔离。

## 验收范围

自动化测试覆盖后处理、取消重试、资源校验和模拟宿主桥接，不代表真实 OCR 精度或跨平台验收。

发布前需在 Windows 与 macOS 的实际 uTools 内完成：

1. 准备完整模型和运行库，正式构建、导入插件。
2. 断网冷启动，测试文件、粘贴、截图及图片匹配入口。
3. 使用实际中英文图片测试小字、深色背景、空白图与长图，记录耗时和准确率。
4. 测试取消后重试、反复进入插件、编辑和复制，以及截图取消和 macOS 权限流程。
5. 重新安装离线包后复测，确认无需首次下载。

第三方模型和组件来源、许可证见 `public/licenses/`。
