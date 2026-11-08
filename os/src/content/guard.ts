// A real prompt-injection classifier running in the browser (apps/Guard.tsx): yzdvai/tiny-injection-guard, an
// English-only ELECTRA-small model (Apache-2.0, 14 MB as int8 ONNX), through transformers.js. The model comes
// from the Hugging Face hub the first time, then the browser caches it. transformers.js and the ONNX runtime are
// served from this site, and only downloaded when the app is opened.
import ortWasm from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm?url'
import ortMjs from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs?url'

export const MODEL = 'yzdvai/tiny-injection-guard'
export const MODEL_URL = `https://huggingface.co/${MODEL}`
/** the cut-off the model's author tuned (config.json: injection_threshold) */
export const THRESHOLD = 0.945

/** P(injection) for a text, and how long the model took */
type Classify = (text: string) => Promise<{ p: number; ms: number }>
let loading: Promise<Classify> | null = null

/** Loads the model once; `onProgress` gets 0–1 while the weights download. */
export function loadGuard(onProgress: (p: number) => void): Promise<Classify> {
  loading ??= (async () => {
    const { AutoTokenizer, AutoModelForSequenceClassification, env } = await import('@huggingface/transformers')
    // our own copy of the runtime (Vite bundles it anyway) rather than jsDelivr's; older Safari needs a different
    // build, which transformers.js still fetches from the CDN
    if (!/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
      const onnx = env.backends.onnx as { wasm?: { wasmPaths?: unknown } }
      if (onnx.wasm) onnx.wasm.wasmPaths = { wasm: new URL(ortWasm, location.href).href, mjs: new URL(ortMjs, location.href).href }
    }
    const progress = (e: { status: string; file?: string; progress?: number }) => {
      if (e.status === 'progress' && e.file?.endsWith('.onnx') && e.progress !== undefined) onProgress(e.progress / 100)
    }
    const [tok, model] = await Promise.all([
      AutoTokenizer.from_pretrained(MODEL),
      AutoModelForSequenceClassification.from_pretrained(MODEL, { dtype: 'q8', progress_callback: progress }),
    ])
    onProgress(1)
    return async (text: string) => {
      const start = performance.now()
      const { logits } = await model(await tok(text, { truncation: true, max_length: 512 }))
      const [benign, injection] = logits.data as Float32Array
      return { p: 1 / (1 + Math.exp(benign - injection)), ms: Math.round(performance.now() - start) }
    }
  })()
  loading.catch(() => (loading = null)) // a failed download can be retried
  return loading
}
