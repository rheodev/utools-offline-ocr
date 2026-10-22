---
name: 离线文字识别
description: 以图片和可编辑文字为核心的紧凑桌面工具界面
colors:
  primary: "#17644d"
  primary-hover: "#104e3b"
  primary-soft: "#e9f2ed"
  background: "#f5f6f3"
  surface: "#ffffff"
  subtle: "#f9faf7"
  text: "#28342f"
  muted: "#65726b"
  border: "#dde3dc"
  error: "#a13a2c"
  error-background: "#fff1ed"
  error-border: "#eac4b9"
  working: "#ad7a22"
  selection: "#cce7d9"
  scrollbar: "#bcc8bf"
  illustration-border: "#bdcec2"
  illustration-line: "#cad8cf"
  illustration-shadow: "#233c2a09"
  dark-background: "#1d2521"
  dark-surface: "#252f29"
  dark-subtle: "#202923"
  dark-text: "#e4eae4"
  dark-muted: "#a7b6ab"
  dark-border: "#3d4b41"
  dark-primary: "#8bceb0"
  dark-primary-hover: "#a4dcc3"
  dark-primary-soft: "#293f33"
  dark-primary-text: "#16392a"
  dark-error: "#ffb4a5"
  dark-error-background: "#3b2c27"
  dark-error-border: "#7a4a3f"
  dark-selection: "#385e49"
  dark-scrollbar: "#667e6d"
  dark-illustration-border: "#5b7564"
  dark-illustration-line: "#58715f"
typography:
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei, PingFang SC, sans-serif"
    fontSize: "19px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  title-compact:
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.4
  drop-target:
    fontSize: "16px"
    fontWeight: 550
  empty-title:
    fontSize: "15px"
    fontWeight: 550
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei, PingFang SC, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.9
  section:
    fontSize: "13px"
    fontWeight: 600
  placeholder:
    fontSize: "13px"
    lineHeight: 2
  control:
    fontSize: "12px"
    lineHeight: 1.5
  metadata:
    fontSize: "11px"
    lineHeight: 1.7
  key-hint:
    fontSize: "10px"
    lineHeight: 1.7
rounded:
  flat: "0"
  scan-bar: "2px"
  key-hint: "4px"
  small: "6px"
  button: "7px"
  logo: "9px"
  workspace: "10px"
  status-dot: "50%"
spacing:
  extra-small: "4px"
  small: "8px"
  control-gap: "12px"
  medium: "16px"
  large: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.button}"
    padding: "7px 12px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.control}"
    rounded: "{rounded.button}"
    padding: "7px 12px"
    height: "36px"
  button-copy:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "4px 9px"
    height: "30px"
  language-select:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.control}"
    rounded: "{rounded.small}"
    padding: "4px 6px"
    height: "32px"
  text-editor:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.flat}"
    padding: "22px"
---

## Overview

紧凑的操作型界面。主要内容是原始图片与可编辑文字，操作按钮集中在上方。此文档从现有 CSS 与组件提取；国际化界面已完成 Chromium 浏览器交互验证、中英文多窗口宽度检查及浅色、深色截图复核，尚未完成真实 uTools 宿主验收。

## Colors

绿色用于主要操作、焦点和完成状态；浅灰绿背景衬托白色工作区。跟随系统深浅主题，浅色与深色值均记录在前置配置中，与 `src/style.css` 的媒体查询对应。

- 主色及浅底用于主要操作、焦点、复制成功和拖放反馈。
- 正文、次要文字、背景、表面及边框共同区分信息层级。
- 错误文字、背景和边框成组使用；识别中的状态点使用工作状态色。
- 文字选择、滚动条、插画边框、线条和阴影均有独立颜色记录。深色主题的主按钮使用专用深色文字。

## Typography

中文与英文使用操作系统字体，避免离线字体下载。标题、分栏标签、正文和辅助文字形成紧凑层级。数字尺寸和耗时使用等宽数字。

- 标题使用 `title`，窄窗口使用 `title-compact`。
- 空状态标题与拖放提示分别使用 `empty-title` 和 `drop-target`。
- 编辑正文使用 `body`，分栏标题和占位提示分别使用 `section`、`placeholder`。
- 按钮、语言选择及说明文字使用 `control` 的字号；行高按组件声明保留。
- 文件、字数和状态等辅助信息使用 `metadata` 的字号；格式提示和快捷键使用 `key-hint`。

## Layout

桌面布局为等宽双栏，图片在左、编辑器在右，工作区共享边框。宽度不超过 680px 时改为纵向排列。外侧间距为 24px，窄窗口为 16px，上方间距为 18px。最小页面宽度为 360px。

标题区、工具栏和页脚允许换行，适应英文文案。语言选择与本地处理说明位于标题区右侧，空间不足时自然换行；窄窗口隐藏页脚的识别范围说明，保留语言选择。浏览器检查覆盖 360、680、681、800、1024px，中英文均无横向页面溢出。

## Elevation & Depth

通过背景层级和细边框区分区域。阴影仅用于空状态纸张插画；实际阴影值记录在设计附属配置的 `extensions.shadows` 中。

## Shapes

按钮和错误提示共用 `button` 圆角；工作区使用 `workspace`，Logo 与拖放覆盖层使用 `logo`，语言选择、空状态插画、拖放区和滚动条使用 `small`。快捷键使用 `key-hint`，扫描条使用 `scan-bar`，编辑器无圆角，状态点为圆形。使用统一线宽的内联 SVG 图标。

## Components

主按钮选择图片，次按钮截图和粘贴；复制与编辑器相邻。忙碌、错误、空结果与复制成功均有文字提示。编辑器保留正常文字粘贴，不截获无图片的粘贴事件。

- **按钮**：主按钮使用主色，次按钮使用表面色和边框；悬停更换背景或边框，禁用时降低不透明度并恢复默认光标。复制成功使用主色浅底。
- **语言选择**：使用文字型原生下拉框，默认透明无边框、使用次要文字色，与本地处理说明垂直居中；悬停显示浅底与正文色，展开选项使用表面色与正文色。支持自动、简体中文和 English，有可访问名称与键盘焦点；切换即时更新界面、进度及错误提示，保留结果与用户文件名。
- **编辑器**：无边框、不可手动调整大小；识别时只读并显示进度与取消操作。文字选择、光标、占位文字和内嵌焦点均使用现有配色。
- **焦点与动态**：按钮、编辑器、下拉框共用主色焦点描边；按钮使用背景与边框过渡，进度使用扫描动画。精确参数见附属配置，减少动态效果偏好会关闭动画与过渡。

## Do's and Don'ts

- 保留可见键盘焦点、编辑光标、文字选择反馈与减少动态效果支持。
- 不为工具界面增加宣传区域、虚构识别结果或远程字体。
- 不将构建实现细节放进正常操作流程；资源错误提供重新安装的恢复说明。
