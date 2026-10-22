<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Icon from './components/Icon.vue'
import { OcrClient } from './ocr/client'
import { MAX_FILE_BYTES, validateDimensions } from './ocr/processing'
import type { PluginAction } from './types'

const client = new OcrClient()
const fileInput = ref<HTMLInputElement | null>(null)
const editor = ref<HTMLTextAreaElement | null>(null)
const imageUrl = ref('')
const imageName = ref('')
const dimensions = ref('')
const text = ref('')
const busy = ref(false)
const capturing = ref(false)
const error = ref('')
const status = ref('等待添加图片')
const copied = ref(false)
const dragging = ref(false)
const originalSize = ref(false)
const elapsed = ref<number | null>(null)
const hasHost = Boolean(window.ocrHost)
const logoUrl = new URL(`${import.meta.env.BASE_URL}logo.png`, document.baseURI).href
const characterCount = computed(() => [...text.value].filter(c => !/\s/u.test(c)).length)
let currentBlob: Blob | null = null
let generation = 0
let dragDepth = 0
let copyTimer: ReturnType<typeof setTimeout> | undefined
let unsubscribe: (() => void) | undefined

function message(error: unknown) { return error instanceof Error ? error.message : '操作失败，请重试' }

function pickFile() { fileInput.value?.click() }

async function recognize() {
  if (!currentBlob || busy.value) return
  const run = ++generation
  busy.value = true
  error.value = ''
  copied.value = false
  text.value = ''
  elapsed.value = null
  try {
    const result = await client.recognize(currentBlob, progress => {
      if (run === generation) status.value = progress
    })
    if (run !== generation) return
    text.value = result.text
    elapsed.value = result.elapsed
    status.value = result.text ? '识别完成，可直接编辑文字' : '未发现清晰文字，请换一张图片或裁剪后重试'
  } catch (reason) {
    if (run !== generation) return
    if (reason instanceof Error && reason.name === 'AbortError') status.value = '已取消识别'
    else { error.value = message(reason); status.value = '识别未完成' }
  } finally {
    if (run === generation) busy.value = false
  }
}

async function openImage(blob: Blob, name: string) {
  const run = ++generation
  if (busy.value) client.cancel()
  busy.value = false
  error.value = ''
  status.value = imageUrl.value ? '等待重新识别' : '等待添加图片'
  if (blob.size === 0 || blob.size > MAX_FILE_BYTES) {
    error.value = '图片为空或超过 20 MB，请选择其他图片'
    return
  }
  const url = URL.createObjectURL(blob)
  try {
    const preview = new Image()
    preview.src = url
    await preview.decode()
    validateDimensions(preview.naturalWidth, preview.naturalHeight)
    if (run !== generation) { URL.revokeObjectURL(url); return }
    if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
    imageUrl.value = url
    imageName.value = name
    dimensions.value = `${preview.naturalWidth} × ${preview.naturalHeight}`
    originalSize.value = false
    currentBlob = blob
    await recognize()
  } catch (reason) {
    URL.revokeObjectURL(url)
    if (run === generation) error.value = reason instanceof DOMException ? '无法读取图片，请选择有效的图片文件' : message(reason)
  }
}

async function openFiles(files: FileList | File[]) {
  if (files.length !== 1) { error.value = '请一次添加一张图片'; return }
  const file = files[0]
  if (!/\.(png|jpe?g|webp|bmp)$/i.test(file.name) && !/^image\/(png|jpeg|webp|bmp)$/i.test(file.type)) {
    error.value = '请选择 PNG、JPG、WebP 或 BMP 图片'
    return
  }
  await openImage(file, file.name)
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) await openFiles(input.files)
  input.value = ''
}

async function openDataUrl(dataUrl: string, name: string) {
  if (!/^data:image\/(png|jpeg|webp|bmp);base64,/i.test(dataUrl) || dataUrl.length > MAX_FILE_BYTES * 1.4) {
    throw new Error('图片格式无效或超过 20 MB')
  }
  const blob = await (await fetch(dataUrl)).blob()
  await openImage(blob, name)
}

async function capture() {
  if (!window.ocrHost || capturing.value) return
  capturing.value = true
  error.value = ''
  try {
    const data = await window.ocrHost.capture()
    if (data) await openDataUrl(data, '屏幕截图.png')
  } catch (reason) { error.value = message(reason) }
  finally { capturing.value = false }
}

async function pasteImage() {
  error.value = ''
  try {
    if (window.ocrHost) {
      const data = window.ocrHost.clipboardImage()
      if (!data) throw new Error('剪贴板中没有图片，请先复制图片')
      await openDataUrl(data, '剪贴板图片.png')
    } else {
      if (!navigator.clipboard?.read) throw new Error('请直接在窗口中按 Ctrl / ⌘ + V 粘贴图片')
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find(type => /^image\/(png|jpeg|webp|bmp)$/.test(type))
        if (type) { await openImage(await item.getType(type), '剪贴板图片.png'); return }
      }
      throw new Error('剪贴板中没有图片，请先复制图片')
    }
  } catch (reason) {
    error.value = reason instanceof DOMException && reason.name === 'NotAllowedError'
      ? '无法读取剪贴板，请在窗口中按 Ctrl / ⌘ + V 粘贴图片' : message(reason)
  }
}

function onPaste(event: ClipboardEvent) {
  const files = [...(event.clipboardData?.items ?? [])]
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => item.getAsFile()).filter((file): file is File => file !== null)
  if (!files.length) return // 保留编辑器里的正常文字粘贴。
  event.preventDefault()
  void openFiles(files)
}

function dragEnter(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault()
  dragDepth++
  dragging.value = true
}

function dragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (!dragDepth) dragging.value = false
}

function drop(event: DragEvent) {
  event.preventDefault()
  dragDepth = 0
  dragging.value = false
  if (event.dataTransfer?.files.length) void openFiles(event.dataTransfer.files)
}

async function copy() {
  if (!text.value || busy.value) return
  try {
    if (window.ocrHost) window.ocrHost.copyText(text.value)
    else await navigator.clipboard.writeText(text.value)
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 1800)
  } catch {
    editor.value?.focus()
    editor.value?.select()
    error.value = '无法自动复制，文字已选中，请按 Ctrl / ⌘ + C 复制'
  }
}

function cancel() {
  generation++
  client.cancel()
  busy.value = false
  status.value = '已取消识别，可点击重新识别'
}

function clear() {
  cancel()
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = ''
  imageName.value = ''
  dimensions.value = ''
  text.value = ''
  error.value = ''
  currentBlob = null
  elapsed.value = null
  copied.value = false
  status.value = '等待添加图片'
}

async function handleAction(action: PluginAction) {
  try {
    if (action.code === 'capture') await capture()
    else if (action.type === 'img' && typeof action.payload === 'string') await openDataUrl(action.payload, '传入的图片.png')
    else if (action.type === 'files' && Array.isArray(action.payload)) {
      if (action.payload.length !== 1 || !action.payload[0].isFile) throw new Error('请选择一个图片文件')
      const file = await window.ocrHost!.readImageFile(action.payload[0].path)
      await openDataUrl(file.dataUrl, file.name)
    }
  } catch (reason) { error.value = message(reason) }
}

onMounted(() => {
  window.addEventListener('paste', onPaste)
  unsubscribe = window.ocrHost?.onEnter(action => { void handleAction(action) })
})

onUnmounted(() => {
  unsubscribe?.()
  window.removeEventListener('paste', onPaste)
  client.cancel()
  clearTimeout(copyTimer)
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
})
</script>

<template>
  <main class="app" @dragenter="dragEnter" @dragleave="dragLeave" @dragover.prevent @drop="drop">
    <header class="app-header">
      <div class="identity">
        <img :src="logoUrl" class="logo" alt="" width="34" height="34" />
        <div><h1>离线文字识别</h1><p>图片里的文字，拿来就能用。</p></div>
      </div>
      <span class="privacy"><span class="status-dot"></span>仅在本机处理</span>
    </header>

    <div class="toolbar">
      <div class="input-actions">
        <button class="button primary" :disabled="busy || capturing" @click="pickFile"><Icon name="image" />选择图片</button>
        <button class="button" :disabled="busy || capturing || !hasHost" :title="hasHost ? '框选屏幕区域识别文字' : '请在 uTools 中使用截图功能'" @click="capture"><Icon name="capture" />截图识别</button>
        <button class="button" :disabled="busy || capturing" @click="pasteImage"><Icon name="paste" />粘贴图片</button>
      </div>
      <button v-if="imageUrl" class="text-button" :disabled="capturing" @click="clear">清空</button>
      <input ref="fileInput" class="visually-hidden" type="file" accept=".png,.jpg,.jpeg,.webp,.bmp" aria-label="选择要识别的图片" @change="onFileChange" />
    </div>

    <div v-if="error" class="error-message" role="alert"><span>{{ error }}</span><button class="icon-button" aria-label="关闭错误提示" @click="error = ''"><Icon name="close" /></button></div>

    <div class="workspace" :class="{ 'is-dragging': dragging }">
      <section class="image-pane" aria-labelledby="image-heading">
        <header class="pane-header"><h2 id="image-heading">原始图片</h2><button v-if="imageUrl" class="text-button" :aria-pressed="originalSize" @click="originalSize = !originalSize">{{ originalSize ? '适应窗口' : '原始大小' }}</button><span v-else class="pane-label">PNG / JPG / WebP / BMP</span></header>
        <div v-if="!imageUrl" class="drop-zone">
          <div class="image-illustration"><Icon name="image" /><span class="illustration-line"></span><span class="illustration-line short"></span></div>
          <h3>放入一张图片</h3>
          <p>拖放到这里，或点击上方选择图片</p>
          <span class="paste-hint">也可以直接按 <kbd>Ctrl / ⌘</kbd> <kbd>V</kbd> 粘贴</span>
        </div>
        <div v-else class="image-viewer" :class="{ 'original-size': originalSize }"><img :src="imageUrl" :alt="`待识别图片：${imageName}`" draggable="false" /></div>
        <footer class="pane-footer"><span class="file-name" :title="imageName">{{ imageName || '单张图片，最大 20 MB' }}</span><span v-if="dimensions" class="dimensions">{{ dimensions }}</span></footer>
      </section>

      <section class="text-pane" aria-labelledby="text-heading" :aria-busy="busy">
        <header class="pane-header"><h2 id="text-heading">识别文字</h2><button class="button copy-button" :class="{ copied }" :disabled="!text || busy" @click="copy"><Icon :name="copied ? 'check' : 'copy'" />{{ copied ? '已复制' : '复制文字' }}</button></header>
        <div class="editor-wrap">
          <textarea ref="editor" v-model="text" aria-label="识别结果，可直接编辑" :readonly="busy" :placeholder="busy ? '' : '识别后的文字会显示在这里，\n可以直接修改、选择和复制。'" spellcheck="false" @input="copied = false"></textarea>
          <div v-if="busy" class="recognizing" role="status"><span class="loading-mark"><i></i><i></i><i></i></span><strong>正在提取文字</strong><span>{{ status }}</span><button class="button" @click="cancel">取消识别</button></div>
        </div>
        <footer class="pane-footer"><span>{{ characterCount }} 字</span><button v-if="imageUrl && !busy" class="text-button" @click="recognize">重新识别<Icon name="arrow" /></button></footer>
      </section>
      <div v-if="dragging" class="drop-overlay"><Icon name="image" /><strong>松开，识别这张图片</strong></div>
    </div>

    <footer class="app-footer">
      <span class="status" role="status" aria-live="polite"><span class="status-dot" :class="{ working: busy, failed: error }"></span>{{ busy ? '识别中，可随时取消' : status }}<span v-if="elapsed !== null" class="elapsed">{{ (elapsed / 1000).toFixed(1) }} 秒</span></span>
      <span class="language">中英文 · 横排印刷文字</span>
    </footer>
  </main>
</template>
