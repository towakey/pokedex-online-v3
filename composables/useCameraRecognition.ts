// 認識ワーカーとの送受信とベクトルDBメタ情報の保持
export interface EmbeddingRow {
  id: string
  dex: number
  name: string
  names?: Record<string, string>
}

interface WorkerBox {
  x: number
  y: number
  w: number
  h: number
  score: number
  cls: number
}

interface WorkerMatch {
  index: number
  score: number
}

export interface CameraRecognitionConfig {
  match_threshold: number
  display_threshold: number
  top2_gap_warn: number
  detect_interval_ms: number
  embed_every_n_frames: number
  track_iou_threshold: number
  vote_window: number
  debug_default: boolean
}

const DEFAULT_CONFIG: CameraRecognitionConfig = {
  match_threshold: 0.65,
  display_threshold: 0.5,
  top2_gap_warn: 0.05,
  detect_interval_ms: 100,
  embed_every_n_frames: 5,
  track_iou_threshold: 0.35,
  vote_window: 5,
  debug_default: false
}

export const useCameraRecognition = () => {
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const progress = ref(0)
  const backend = ref<'webgpu' | 'wasm' | ''>('')
  const errorMessage = ref('')
  const rows = ref<EmbeddingRow[]>([])
  const config = ref<CameraRecognitionConfig>(DEFAULT_CONFIG)
  const lastDetectMs = ref(0)
  const lastEmbedMs = ref(0)

  let worker: Worker | null = null
  let detectSeq = 0
  const detectWaiters = new Map<number, (boxes: WorkerBox[]) => void>()
  const embedWaiters = new Map<number, (matches: WorkerMatch[]) => void>()
  let inflightDetect = false

  const onMessage = (event: MessageEvent) => {
    const message = event.data
    if (message.type === 'progress') {
      progress.value = message.value
    }
    else if (message.type === 'detections') {
      inflightDetect = false
      lastDetectMs.value = message.ms
      detectWaiters.get(message.seq)?.(message.boxes)
      detectWaiters.delete(message.seq)
    }
    else if (message.type === 'match') {
      lastEmbedMs.value = message.ms
      embedWaiters.get(message.trackId)?.(message.matches)
      embedWaiters.delete(message.trackId)
    }
    else if (message.type === 'error') {
      errorMessage.value = String(message.message)
      status.value = 'error'
      // 待機中の呼び出しを解放しないとUIが処理中のまま固まる
      inflightDetect = false
      detectWaiters.forEach(resolve => resolve([]))
      detectWaiters.clear()
      embedWaiters.forEach(resolve => resolve([]))
      embedWaiters.clear()
    }
  }

  const init = async () => {
    if (!import.meta.client || worker) {
      return
    }
    status.value = 'loading'
    errorMessage.value = ''
    try {
      const appBaseURL = (useRuntimeConfig().public.appBaseURL || '/').replace(/\/$/, '')
      const configResponse = await fetch(`${appBaseURL}/models/config.json`)
      if (configResponse.ok) {
        config.value = { ...DEFAULT_CONFIG, ...(await configResponse.json()) }
      }
      const indexResponse = await fetch(`${appBaseURL}/models/embeddings.v1.json`)
      if (!indexResponse.ok) {
        throw new Error('embeddings.v1.json の取得に失敗しました')
      }
      rows.value = ((await indexResponse.json()) as { rows: EmbeddingRow[] }).rows

      worker = new Worker(
        new URL('../workers/recognition.worker.ts', import.meta.url),
        { type: 'module' }
      )
      worker.onmessage = onMessage
      worker.onerror = () => {
        errorMessage.value = '認識ワーカーでエラーが発生しました'
        status.value = 'error'
      }
      const numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1
      await new Promise<void>((resolve, reject) => {
        const handler = (event: MessageEvent) => {
          if (event.data.type === 'ready') {
            backend.value = event.data.backend
            resolve()
          }
          else if (event.data.type === 'error') {
            reject(new Error(String(event.data.message)))
          }
        }
        worker!.addEventListener('message', handler)
        // ワーカー自体が起動できない場合（スクリプト取得失敗・COEPブロック等）は
        // message が返らず待ち続けるため、error イベントでも reject する
        worker!.addEventListener('error', () => reject(new Error('認識ワーカーの起動に失敗しました')), { once: true })
        worker!.postMessage({
          type: 'init',
          urls: {
            detector: `${appBaseURL}/models/detector.v1.onnx`,
            embedder: `${appBaseURL}/models/embedder.v1.onnx`,
            embeddingsBin: `${appBaseURL}/models/embeddings.v1.bin`,
            embeddingsJson: `${appBaseURL}/models/embeddings.v1.json`,
            ortBase: `${appBaseURL}/ort/`
          },
          numThreads
        })
      })
      progress.value = 1
      status.value = 'ready'
    }
    catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
      status.value = 'error'
    }
  }

  let inflightPromise: Promise<unknown> | null = null

  // 同時に1回だけ検出を実行。実行中は前回結果を返す。
  // wait=true の呼び出しは実行中の検出が終わるまで待つ（画像モードなど結果を落とせない用途向け）
  const detect = async (bitmap: ImageBitmap, wait = false): Promise<WorkerBox[] | null> => {
    while (wait && inflightDetect) {
      await inflightPromise
    }
    if (!worker || inflightDetect) {
      bitmap.close()
      return null
    }
    inflightDetect = true
    const seq = ++detectSeq
    inflightPromise = new Promise<WorkerBox[]>((resolve) => {
      detectWaiters.set(seq, resolve)
      worker!.postMessage({ type: 'detect', seq, bitmap }, [bitmap])
    })
    return await inflightPromise
  }

  const embed = async (trackId: number, bitmap: ImageBitmap, box: WorkerBox): Promise<WorkerMatch[]> => {
    if (!worker) {
      bitmap.close()
      return []
    }
    return await new Promise<WorkerMatch[]>((resolve) => {
      embedWaiters.set(trackId, resolve)
      worker!.postMessage({ type: 'embed', trackId, bitmap, box }, [bitmap])
    })
  }

  const dispose = () => {
    worker?.terminate()
    worker = null
    detectWaiters.clear()
    embedWaiters.clear()
    status.value = 'idle'
  }

  return { status, progress, backend, errorMessage, rows, config, lastDetectMs, lastEmbedMs, init, detect, embed, dispose }
}
