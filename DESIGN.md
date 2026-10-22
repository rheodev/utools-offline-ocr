---
name: 离线文字识别
description: 以图片和可编辑文字为核心的紧凑桌面工具界面
colors:
  primary: "#17644d"
  primary-hover: "#104e3b"
  background: "#f5f6f3"
  surface: "#ffffff"
  subtle: "#f9faf7"
  text: "#28342f"
  muted: "#65726b"
  border: "#dde3dc"
  error: "#a13a2c"
typography:
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei, PingFang SC, sans-serif"
    fontSize: "19px"
    fontWeight: 650
    lineHeight: 1.4
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei, PingFang SC, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.9
rounded:
  button: "7px"
  workspace: "10px"
spacing:
  small: "8px"
  medium: "16px"
  large: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "7px 12px"
    height: "36px"
---

## Overview

紧凑的操作型界面。主要内容是原始图片与可编辑文字，操作按钮集中在上方。此文档从已实现的 CSS 提取，尚未完成浏览器视觉验收。

## Colors

绿色用于主要操作、焦点和完成状态；浅灰绿背景衬托白色工作区。跟随系统深浅主题，暗色值以 `src/style.css` 中的媒体查询为准。

## Typography

中文与英文使用操作系统字体，避免离线字体下载。标题、分栏标签、正文和辅助文字形成紧凑层级。数字尺寸和耗时使用等宽数字。

## Layout

桌面布局为等宽双栏，图片在左、编辑器在右，工作区共享边框。宽度不超过 680px 时改为纵向排列。外侧间距为 24px，窄窗口为 16px。

## Elevation & Depth

通过背景层级和细边框区分区域。阴影仅用于空状态纸张插画。

## Shapes

按钮使用轻微圆角；工作区较大圆角。使用统一线宽的内联 SVG 图标。

## Components

主按钮选择图片，次按钮截图和粘贴；复制与编辑器相邻。忙碌、错误、空结果与复制成功均有文字提示。编辑器保留正常文字粘贴，不截获无图片的粘贴事件。

## Do's and Don'ts

- 保留可见键盘焦点、编辑光标、文字选择反馈与减少动态效果支持。
- 不为工具界面增加宣传区域、虚构识别结果或远程字体。
- 不将构建实现细节放进正常操作流程；资源错误提供重新安装的恢复说明。
