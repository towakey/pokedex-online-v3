/// <reference lib="webworker" />
// ポケモン認識ワーカー: YOLO-World(検出) + DINOv2(特徴) + ベクトルDB照合
// ml/export_models.py / ml/build_index.py が生成する ONNX と embeddings を読み込む
import * as ort from 'onnxruntime-web'

interface InitMessage {
  type: 'init'
  urls: {
    detector: string
    embedder: string
    embeddingsBin: string
    embeddingsJson: string
    ortBase: string
  }
  numThreads: number
}

interface DetectMessage {
  type: 'detect'
  seq: number
  bitmap: ImageBitmap
}

interface EmbedMessage {
  type: 'embed'
  trackId: number
  bitmap: ImageBitmap
  box: { x: number, y: number, w: number, h: number }
}

type IncomingMessage = InitMessage | DetectMessage | EmbedMessage

const DETECTOR_SIZE = 640
const EMBEDDER_SIZE = 224
const RGB_MEAN = [0.485, 0.456, 0.406] as const
const RGB_STD = [0.229, 0.224, 0.225] as const

let detector: ort.InferenceSession | null = null
let embedder: ort.InferenceSession | null = null
let dbVectors: Float32Array | null = null
let dbDim = 0
let numClasses = 0

const post = (message: Record<string, unknown>) => {
  ;(self as unknown as Worker).postMessage(message)
}

const createSession = async (url: string, providers: string[]) => {
  return await ort.InferenceSession.create(url, {
    executionProviders: providers,
    graphOptimizationLevel: 'all'
  })
}

const init = async (message: InitMessage) => {
  ort.env.wasm.wasmPaths = message.urls.ortBase
  ort.env.wasm.numThreads = message.numThreads

  post({ type: 'progress', stage: 'detector', value: 0.1 })
  let backend: 'webgpu' | 'wasm' = 'webgpu'
  try {
    detector = await createSession(message.urls.detector, ['webgpu'])
    embedder = await createSession(message.urls.embedder, ['webgpu'])
  }
  catch {
    backend = 'wasm'
    detector = await createSession(message.urls.detector, ['wasm'])
    embedder = await createSession(message.urls.embedder, ['wasm'])
  }

  post({ type: 'progress', stage: 'embeddings', value: 0.6 })
  const [indexResponse, binResponse] = await Promise.all([
    fetch(message.urls.embeddingsJson),
    fetch(message.urls.embeddingsBin)
  ])
  if (!indexResponse.ok || !binResponse.ok) {
    throw new Error('embeddings の取得に失敗しました')
  }
  const index = await indexResponse.json() as { dim: number }
  dbDim = index.dim
  dbVectors = new Float32Array(await binResponse.arrayBuffer())

  post({ type: 'ready', backend })
}

const bitmapToTensor = (bitmap: ImageBitmap, box: { x: number, y: number, w: number, h: number } | null, size: number, mean: readonly number[], std: readonly number[]) => {
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  if (box) {
    const sx = Math.max(0, Math.floor(box.x))
    const sy = Math.max(0, Math.floor(box.y))
    const sw = Math.min(bitmap.width - sx, Math.ceil(box.w))
    const sh = Math.min(bitmap.height - sy, Math.ceil(box.h))
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, size, size)
  }
  else {
    // letterbox: 縦横比を維持して中央に配置
    const scale = Math.min(size / bitmap.width, size / bitmap.height)
    const dw = bitmap.width * scale
    const dh = bitmap.height * scale
    ctx.fillStyle = '#727272'
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(bitmap, (size - dw) / 2, (size - dh) / 2, dw, dh)
  }
  const { data } = ctx.getImageData(0, 0, size, size)
  const plane = size * size
  const tensor = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    const offset = i * 4
    tensor[i] = (data[offset]! / 255 - mean[0]!) / std[0]!
    tensor[plane + i] = (data[offset + 1]! / 255 - mean[1]!) / std[1]!
    tensor[plane * 2 + i] = (data[offset + 2]! / 255 - mean[2]!) / std[2]!
  }
  return new ort.Tensor('float32', tensor, [1, 3, size, size])
}

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value))

const iou = (a: { x: number, y: number, w: number, h: number }, b: { x: number, y: number, w: number, h: number }) => {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  return intersection / (a.w * a.h + b.w * b.h - intersection + 1e-8)
}

const detect = async (message: DetectMessage) => {
  const started = performance.now()
  const tensor = bitmapToTensor(message.bitmap, null, DETECTOR_SIZE, [0, 0, 0], [1, 1, 1])
  const results = await detector!.run({ [detector!.inputNames[0]!]: tensor })
  const output = results[detector!.outputNames[0]!]!
  const raw = output.data as Float32Array
  const anchors = output.dims[2]!
  // outputMetadata.dimensions は onnxruntime-web では欠けることがあるため、
  // クラス数は実出力の dims から毎回求める（[1, 4+numClasses, anchors] 形式）
  numClasses = (output.dims[1] ?? 4) - 4
  const candidates: Array<{ x: number, y: number, w: number, h: number, score: number, cls: number }> = []
  for (let i = 0; i < anchors; i++) {
    let bestScore = 0
    let bestClass = 0
    for (let c = 0; c < numClasses; c++) {
      let score = raw[(4 + c) * anchors + i]!
      if (score > 1 || score < 0) {
        score = sigmoid(score)
      }
      if (score > bestScore) {
        bestScore = score
        bestClass = c
      }
    }
    if (bestScore < 0.05) {
      continue
    }
    const cx = raw[i]!
    const cy = raw[anchors + i]!
    const w = raw[anchors * 2 + i]!
    const h = raw[anchors * 3 + i]!
    candidates.push({ x: cx - w / 2, y: cy - h / 2, w, h, score: bestScore, cls: bestClass })
  }

  candidates.sort((a, b) => b.score - a.score)
  const picked: typeof candidates = []
  for (const candidate of candidates) {
    if (picked.every((box) => iou(box, candidate) < 0.45)) {
      picked.push(candidate)
    }
    if (picked.length >= 10) {
      break
    }
  }

  post({ type: 'detections', seq: message.seq, boxes: picked, ms: performance.now() - started })
  message.bitmap.close()
}

const embed = async (message: EmbedMessage) => {
  const started = performance.now()
  const tensor = bitmapToTensor(message.bitmap, message.box, EMBEDDER_SIZE, RGB_MEAN, RGB_STD)
  const results = await embedder!.run({ [embedder!.inputNames[0]!]: tensor })
  const output = results[embedder!.outputNames[0]!]!
  const vec = Float32Array.from(output.data as Float32Array)
  let norm = 0
  for (const v of vec) {
    norm += v * v
  }
  norm = Math.sqrt(norm) + 1e-8
  for (let i = 0; i < vec.length; i++) {
    vec[i]! /= norm
  }

  const count = dbVectors!.length / dbDim
  const scores = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const offset = i * dbDim
    let dot = 0
    for (let d = 0; d < dbDim; d++) {
      dot += dbVectors![offset + d]! * vec[d]!
    }
    scores[i] = dot
  }
  const order = Array.from(scores.keys()).sort((a, b) => scores[b]! - scores[a]!)
  const matches = order.slice(0, 3).map((index) => ({ index, score: scores[index]! }))

  post({ type: 'match', trackId: message.trackId, matches, ms: performance.now() - started })
  message.bitmap.close()
}

self.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const message = event.data
  const run = message.type === 'init'
    ? init(message)
    : message.type === 'detect'
      ? detect(message)
      : embed(message)
  run.catch((error: unknown) => {
    post({ type: 'error', stage: message.type, message: error instanceof Error ? error.message : String(error) })
  })
}
