# 第三方组件与模型

- Vue 3：Copyright (c) 2018-present, Yuxi (Evan) You，MIT，许可见 Vue-MIT.txt。
  源码：https://github.com/vuejs/core
- ONNX Runtime Web 1.20.1：Copyright (c) Microsoft Corporation，MIT，许可见 ONNX-Runtime-MIT.txt（由资源准备脚本下载）。
  源码：https://github.com/microsoft/onnxruntime/tree/v1.20.1
- PaddleOCR PP-OCRv4 轻量检测、识别模型及字典：Copyright (c) PaddlePaddle Authors，Apache License 2.0，许可见 Apache-2.0.txt。
  源码：https://github.com/PaddlePaddle/PaddleOCR
  ONNX 转换文件：https://huggingface.co/SWHL/RapidOCR/tree/4e4644045a07c403b1ad40ca97340ecb4a8dc2c1/PP-OCRv4

插件中的横排文字后处理为独立实现，使用轴对齐连通域，不包含 PaddleOCR 的完整旋转文本处理流水线。
