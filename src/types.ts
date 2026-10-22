export interface TextBlock {
  text: string
  score: number
  x: number
  y: number
  width: number
  height: number
}

export interface OcrResult {
  blocks: TextBlock[]
  text: string
  elapsed: number
}

export type AssetMap = Record<string, Uint8Array<ArrayBuffer>>

export type WorkerRequest =
  | { type: 'init'; assets: AssetMap }
  | { type: 'recognize'; bitmap: ImageBitmap }

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'progress'; message: string }
  | { type: 'result'; result: OcrResult }
  | { type: 'error'; message: string }

export interface PluginAction {
  code: string
  type: string
  payload: string | { path: string; name: string; isFile: boolean }[]
}

export interface OcrHost {
  onEnter(listener: (action: PluginAction) => void): () => void
  capture(): Promise<string | null>
  clipboardImage(): string | null
  copyText(text: string): void
  readImageFile(path: string): Promise<{ name: string; dataUrl: string }>
  loadAssets(): Promise<AssetMap>
}

declare global {
  interface Window { ocrHost?: OcrHost }
}
