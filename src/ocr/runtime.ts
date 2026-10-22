export interface Tensor {
  data: Float32Array
  dims: readonly number[]
  dispose(): void
}

export interface Session {
  inputNames: readonly string[]
  outputNames: readonly string[]
  run(feeds: Record<string, Tensor>): Promise<Record<string, Tensor>>
  release(): Promise<void>
}

// 运行库由离线资源提供；这里只声明本插件使用的稳定接口。
export interface OrtRuntime {
  env: { wasm: { numThreads: number; proxy: boolean; wasmPaths: { mjs: string; wasm: string }; initTimeout: number } }
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => Tensor
  InferenceSession: { create(model: Uint8Array, options: { executionProviders: string[]; graphOptimizationLevel: string }): Promise<Session> }
}
