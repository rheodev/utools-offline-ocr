<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Icon from './components/Icon.vue'
import { useI18n } from './i18n/useI18n'
import { errorMessage, type LocalizedMessage } from './i18n/messages'
import { OcrClient } from './ocr/client'
import { MAX_FILE_BYTES, validateDimensions } from './ocr/processing'
import type { PluginAction } from './types'

const { preference, t, format } = useI18n()
const client = new OcrClient()
const fileInput = ref<HTMLInputElement | null>(null)
const editor = ref<HTMLTextAreaElement | null>(null)
const imageUrl = ref('')
const imageName = ref('')
const dimensions = ref('')
const text = ref('')
const busy = ref(false)
const capturing = ref(false)
const error = ref<LocalizedMessage | null>(null)
const status = ref<LocalizedMessage>({ key: 'status.waiting' })
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

function pickFile() { fileInput.value?.click() }

async function recognize() {
  if (!currentBlob || busy.value) return
  const run = ++generation
  busy.value = true
  error.value = null
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
    status.value = { key: result.text ? 'status.done' : 'status.empty' }
  } catch (reason) {
    if (run !== generation) return
    if (reason instanceof Error && reason.name === 'AbortError') status.value = { key: 'status.cancelled' }
    else { error.value = errorMessage(reason); status.value = { key: 'status.failed' } }
  } finally {
    if (run === generation) busy.value = false
  }
}

async function openImage(blob: Blob, name: string) {
  const run = ++generation
  if (busy.value) client.cancel()
  busy.value = false
  error.value = null
  status.value = { key: imageUrl.value ? 'status.retry' : 'status.waiting' }
  if (blob.size === 0 || blob.size > MAX_FILE_BYTES) {
    error.value = { key: 'error.imageSize' }
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
    if (run === generation) error.value = reason instanceof DOMException ? { key: 'error.invalidImage' } : errorMessage(reason)
  }
}

async function openFiles(files: FileList | File[]) {
  if (files.length !== 1) { error.value = { key: 'error.singleImage' }; return }
  const file = files[0]
  if (!/\.(png|jpe?g|webp|bmp)$/i.test(file.name) && !/^image\/(png|jpeg|webp|bmp)$/i.test(file.type)) {
    error.value = { key: 'error.imageType' }
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
    throw new Error('error.dataUrl')
  }
  const blob = await (await fetch(dataUrl)).blob()
  await openImage(blob, name)
}

async function capture() {
  if (!window.ocrHost || capturing.value) return
  capturing.value = true
  error.value = null
  try {
    const data = await window.ocrHost.capture()
    if (data) await openDataUrl(data, t('file.capture'))
  } catch (reason) { error.value = errorMessage(reason) }
  finally { capturing.value = false }
}

async function pasteImage() {
  error.value = null
  try {
    if (window.ocrHost) {
      const data = window.ocrHost.clipboardImage()
      if (!data) throw new Error('error.clipboardEmpty')
      await openDataUrl(data, t('file.clipboard'))
    } else {
      if (!navigator.clipboard?.read) throw new Error('error.pasteShortcut')
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find(type => /^image\/(png|jpeg|webp|bmp)$/.test(type))
        if (type) { await openImage(await item.getType(type), t('file.clipboard')); return }
      }
      throw new Error('error.clipboardEmpty')
    }
  } catch (reason) {
    error.value = reason instanceof DOMException && reason.name === 'NotAllowedError'
      ? { key: 'error.clipboardDenied' } : errorMessage(reason)
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
    error.value = { key: 'error.copy' }
  }
}

function cancel() {
  generation++
  client.cancel()
  busy.value = false
  status.value = { key: 'status.cancelledRetry' }
}

function clear() {
  cancel()
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = ''
  imageName.value = ''
  dimensions.value = ''
  text.value = ''
  error.value = null
  currentBlob = null
  elapsed.value = null
  copied.value = false
  status.value = { key: 'status.waiting' }
}

async function handleAction(action: PluginAction) {
  try {
    if (action.code === 'capture') await capture()
    else if (action.type === 'img' && typeof action.payload === 'string') await openDataUrl(action.payload, t('file.incoming'))
    else if (action.type === 'files' && Array.isArray(action.payload)) {
      if (action.payload.length !== 1 || !action.payload[0].isFile) throw new Error('error.singleFile')
      const file = await window.ocrHost!.readImageFile(action.payload[0].path)
      await openDataUrl(file.dataUrl, file.name)
    }
  } catch (reason) { error.value = errorMessage(reason) }
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
        <div><h1>{{ t('app.title') }}</h1><p>{{ t('app.tagline') }}</p></div>
      </div>
      <div class="header-options">
        <label class="language-picker"><span class="visually-hidden">{{ t('language.label') }}</span>
          <select v-model="preference">
            <option value="auto">{{ t('language.auto') }}</option>
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
          </select>
        </label>
        <span class="privacy"><span class="status-dot"></span>{{ t('app.privacy') }}</span>
      </div>
    </header>

    <div class="toolbar">
      <div class="input-actions">
        <button class="button primary" :disabled="busy || capturing" @click="pickFile"><Icon name="image" />{{ t('action.choose') }}</button>
        <button class="button" :disabled="busy || capturing || !hasHost" :title="t(hasHost ? 'image.captureHint' : 'image.hostRequired')" @click="capture"><Icon name="capture" />{{ t('action.capture') }}</button>
        <button class="button" :disabled="busy || capturing" @click="pasteImage"><Icon name="paste" />{{ t('action.paste') }}</button>
      </div>
      <button v-if="imageUrl" class="text-button" :disabled="capturing" @click="clear">{{ t('action.clear') }}</button>
      <input ref="fileInput" class="visually-hidden" type="file" accept=".png,.jpg,.jpeg,.webp,.bmp" :aria-label="t('image.chooseLabel')" @change="onFileChange" />
    </div>

    <div v-if="error" class="error-message" role="alert"><span>{{ format(error) }}</span><button class="icon-button" :aria-label="t('error.dismiss')" @click="error = null"><Icon name="close" /></button></div>

    <div class="workspace" :class="{ 'is-dragging': dragging }">
      <section class="image-pane" aria-labelledby="image-heading">
        <header class="pane-header"><h2 id="image-heading">{{ t('image.heading') }}</h2><button v-if="imageUrl" class="text-button" :aria-pressed="originalSize" @click="originalSize = !originalSize">{{ t(originalSize ? 'image.fit' : 'image.original') }}</button><span v-else class="pane-label">PNG / JPG / WebP / BMP</span></header>
        <div v-if="!imageUrl" class="drop-zone">
          <div class="image-illustration"><Icon name="image" /><span class="illustration-line"></span><span class="illustration-line short"></span></div>
          <h3>{{ t('image.emptyTitle') }}</h3>
          <p>{{ t('image.emptyHint') }}</p>
          <span class="paste-hint">{{ t('image.pasteBefore') }} <kbd>Ctrl / ⌘</kbd> <kbd>V</kbd> {{ t('image.pasteAfter') }}</span>
        </div>
        <div v-else class="image-viewer" :class="{ 'original-size': originalSize }"><img :src="imageUrl" :alt="t('image.alt', { name: imageName })" draggable="false" /></div>
        <footer class="pane-footer"><span class="file-name" :title="imageName">{{ imageName || t('image.limit') }}</span><span v-if="dimensions" class="dimensions">{{ dimensions }}</span></footer>
      </section>

      <section class="text-pane" aria-labelledby="text-heading" :aria-busy="busy">
        <header class="pane-header"><h2 id="text-heading">{{ t('text.heading') }}</h2><button class="button copy-button" :class="{ copied }" :disabled="!text || busy" @click="copy"><Icon :name="copied ? 'check' : 'copy'" />{{ t(copied ? 'action.copied' : 'action.copy') }}</button></header>
        <div class="editor-wrap">
          <textarea ref="editor" v-model="text" :aria-label="t('text.label')" :readonly="busy" :placeholder="busy ? '' : t('text.placeholder')" spellcheck="false" @input="copied = false"></textarea>
          <div v-if="busy" class="recognizing" role="status"><span class="loading-mark"><i></i><i></i><i></i></span><strong>{{ t('text.extracting') }}</strong><span>{{ format(status) }}</span><button class="button" @click="cancel">{{ t('action.cancel') }}</button></div>
        </div>
        <footer class="pane-footer"><span>{{ t(characterCount === 1 ? 'text.countOne' : 'text.count', { count: characterCount }) }}</span><button v-if="imageUrl && !busy" class="text-button" @click="recognize">{{ t('action.retry') }}<Icon name="arrow" /></button></footer>
      </section>
      <div v-if="dragging" class="drop-overlay"><Icon name="image" /><strong>{{ t('image.drop') }}</strong></div>
    </div>

    <footer class="app-footer">
      <span class="status" role="status" aria-live="polite"><span class="status-dot" :class="{ working: busy, failed: error }"></span>{{ busy ? t('status.busy') : format(status) }}<span v-if="elapsed !== null" class="elapsed">{{ t('text.elapsed', { seconds: (elapsed / 1000).toFixed(1) }) }}</span></span>
      <span class="language">{{ t('text.scope') }}</span>
    </footer>
  </main>
</template>
