# 离线文字识别

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
用户已确认：Vue 3、TypeScript、Vite；PaddleOCR 轻量模型、ONNX Runtime Web/WASM、Web Worker。

## Product Purpose
在 Windows 与 macOS 的 uTools 内，将图片中的中英文转为可编辑、可复制的文字。

## Capabilities and Constraints
- 输入：截图、剪贴板图片、单个图片文件。
- 输出：可编辑文本，保留基本换行，一键复制。
- 模型和运行资源随插件交付，运行时不联网、不上传图片、不记录识别历史。
- 第一版覆盖横排印刷文字；不含 PDF、表格还原、公式与手写识别。
- 首先验证跨平台加载与实际识别，性能和准确率不作未经测试的承诺。
