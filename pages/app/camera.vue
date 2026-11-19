<script setup lang="ts">
// WEB版カメラ認識: /app/camera
// COOP/COEP によるマルチスレッド化のため、このページへの遷移・このページからの遷移は
// <a href>（再読み込み）で行う（SPA遷移だと crossOriginIsolated が切り替わらない）
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTranslation } from '~/composables/useTranslation'
import { useLanguagePreference } from '~/composables/useLanguagePreference'
import { updateTracks, voteForLabel, type Track } from '~/utils/cameraTracker'

const appConfig = useSiteAppConfig()
const { t } = useTranslation()
const { language } = useLanguagePreference()
const { buildPokemonDetailPath } = usePokedex()
const recognition = useCameraRecognition()

const videoEl = ref<HTMLVideoElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const cameraError = ref<'' | 'unsupported' | 'insecure' | 'denied' | 'other'>('')
const facingMode = ref<'environment' | 'user'>('environment')
const debug = ref(false)
const fps = ref(0)
const running = ref(false)

const isLoading = computed(() => recognition.status.value === 'loading')
const modelError = computed(() => recognition.status.value === 'error' ? recognition.errorMessage.value : '')

let stream: MediaStream | null = null
let rafId = 0
let tracks: Track[] = []
let hitAreas: Array<{ x: number, y: number, w: number, h: number, url: string }> = []
let lastDetectAt = 0
let lastStatsAt = 0
let frameCount = 0
let pendingEmbeds = new Set<number>()

const appBaseURL = (useRuntimeConfig().public.appBaseURL || '/').replace(/\/$/, '')
const isolated = import.meta.client ? globalThis.crossOriginIsolated : true
const repoUrl = 'https://github.com/towakey/pokedex-online-v3'
const homeUrl = `${appBaseURL}/`

const localizedName = (index: number | null): string => {
  if (index === null) {
    return '？'
  }
  const row = recognition.rows.value[index]
  if (!row) {
    return '？'
  }
  return row.names?.[language.value] ?? row.name
}

const detailUrl = (index: number): string => {
  const row = recognition.rows.value[index]
  return row ? `${appBaseURL}${buildPokemonDetailPath('global', row.dex, row.id).replace(/^\//, '')}` : homeUrl
}

const stopStream = () => {
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
}

const startCamera = async (mode: 'environment' | 'user') => {
  cameraError.value = ''
  stopStream()
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } }
    })
  }
  catch (error) {
    cameraError.value = (error instanceof DOMException && error.name === 'NotAllowedError') ? 'denied' : 'other'
    return
  }
  facingMode.value = mode
  const video = videoEl.value!
  video.srcObject = stream
  await video.play()
}

const switchCamera = async () => {
  await startCamera(facingMode.value === 'environment' ? 'user' : 'environment')
}

const drawOverlay = (canvas: HTMLCanvasElement, video: HTMLVideoElement) => {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }
  const cw = canvas.width
  const ch = canvas.height
  ctx.clearRect(0, 0, cw, ch)
  hitAreas = []

  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) {
    return
  }
  // object-fit: cover と同じ変換で枠を表示領域に写像する
  const scale = Math.max(cw / vw, ch / vh)
  const offsetX = (cw - vw * scale) / 2
  const offsetY = (ch - vh * scale) / 2
  const toView = (box: { x: number, y: number, w: number, h: number }) => ({
    x: box.x * scale + offsetX,
    y: box.y * scale + offsetY,
    w: box.w * scale,
    h: box.h * scale
  })

  const fontSize = Math.max(13, Math.round(cw / 48))
  ctx.font = `600 ${fontSize}px "Segoe UI", sans-serif`
  ctx.textBaseline = 'middle'

  for (const track of tracks) {
    const box = toView(track.box)
    const named = track.labelIndex !== null
    const confident = named && !track.gapWarn
    const color = confident ? '#22c55e' : named ? '#eab308' : '#94a3b8'
    const percent = named ? ` ${Math.round(track.labelScore * 100)}%` : ''
    const label = `${localizedName(track.labelIndex)}${percent}`

    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.strokeRect(box.x, box.y, box.w, box.h)

    const labelHeight = Math.max(44, fontSize * 1.8)
    const labelWidth = Math.max(ctx.measureText(label).width + 20, 44)
    const labelY = box.y - labelHeight >= 0 ? box.y - labelHeight : box.y + box.h
    ctx.fillStyle = color
    ctx.fillRect(box.x, labelY, labelWidth, labelHeight)
    ctx.fillStyle = '#0f172a'
    ctx.fillText(label, box.x + 10, labelY + labelHeight / 2)

    if (named) {
      hitAreas.push({ x: box.x, y: Math.min(labelY, box.y), w: Math.max(box.w, labelWidth), h: box.h + labelHeight, url: detailUrl(track.labelIndex!) })
    }
  }
}

const tick = async () => {
  const video = videoEl.value
  const canvas = canvasEl.value
  if (!video || !canvas || !running.value) {
    return
  }
  rafId = requestAnimationFrame(tick)

  const now = performance.now()
  const cfg = recognition.config.value
  const ready = recognition.status.value === 'ready' && video.readyState >= 2 && video.videoWidth > 0

  if (ready && now - lastDetectAt >= cfg.detect_interval_ms) {
    lastDetectAt = now
    const bitmap = await createImageBitmap(video)
    const boxes = await recognition.detect(bitmap)
    if (boxes) {
      // letterbox(640) → 動画ピクセル座標へ戻す
      const size = 640
      const scale = Math.min(size / video.videoWidth, size / video.videoHeight)
      const padX = (size - video.videoWidth * scale) / 2
      const padY = (size - video.videoHeight * scale) / 2
      const mapped = boxes
        .filter((box) => box.score >= cfg.display_threshold)
        .map((box) => ({
          x: (box.x - padX) / scale,
          y: (box.y - padY) / scale,
          w: box.w / scale,
          h: box.h / scale,
          score: box.score
        }))
      tracks = updateTracks(tracks, mapped, cfg.track_iou_threshold)

      // 枠ごとに N フレーム周期で特徴照合（同時1件まで）
      for (const track of tracks) {
        if (track.framesSeen % cfg.embed_every_n_frames === 0 && !pendingEmbeds.has(track.id)) {
          pendingEmbeds.add(track.id)
          const cropBitmap = await createImageBitmap(video)
          const trackId = track.id
          recognition.embed(trackId, cropBitmap, track.box).then((matches) => {
            pendingEmbeds.delete(trackId)
            const current = tracks.find((item) => item.id === trackId)
            if (!current || matches.length === 0) {
              return
            }
            const [top1, top2] = matches
            if (top1!.score >= cfg.match_threshold) {
              current.votes.push({ index: top1!.index, score: top1!.score })
              current.gapWarn = top2 !== undefined && top1!.score - top2.score < cfg.top2_gap_warn
            }
            const voted = voteForLabel(current.votes, cfg.vote_window)
            if (voted) {
              current.labelIndex = voted.index
              current.labelScore = voted.score
            }
          })
          break
        }
      }
    }
  }

  if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
  }
  drawOverlay(canvas, video)

  frameCount += 1
  if (now - lastStatsAt >= 1000) {
    fps.value = Math.round(frameCount * 1000 / (now - lastStatsAt))
    frameCount = 0
    lastStatsAt = now
  }
}

const onCanvasClick = (event: MouseEvent) => {
  const canvas = canvasEl.value
  if (!canvas) {
    return
  }
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const hit = hitAreas.find((area) => x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h)
  if (hit) {
    window.location.href = hit.url
  }
}

const onVisibilityChange = () => {
  if (document.hidden) {
    running.value = false
    cancelAnimationFrame(rafId)
    videoEl.value?.pause()
  }
  else {
    resume()
  }
}

const resume = () => {
  if (running.value || !stream) {
    return
  }
  running.value = true
  videoEl.value?.play()
  rafId = requestAnimationFrame(tick)
}

useSiteSeo({
  title: () => t('camera.title'),
  description: () => t('camera.description')
})

onMounted(async () => {
  if (!window.isSecureContext) {
    cameraError.value = 'insecure'
    return
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraError.value = 'unsupported'
    return
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  await recognition.init()
  debug.value = recognition.config.value.debug_default
  if (recognition.status.value !== 'ready') {
    return
  }
  await startCamera('environment')
  if (stream) {
    running.value = true
    lastStatsAt = performance.now()
    rafId = requestAnimationFrame(tick)
  }
})

onBeforeUnmount(() => {
  running.value = false
  cancelAnimationFrame(rafId)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  pendingEmbeds.clear()
  tracks = []
  stopStream()
  recognition.dispose()
})
</script>

<template>
  <div class="camera-page">
    <header class="camera-page__bar">
      <a :href="homeUrl" class="camera-page__back">← {{ t('common.home') }}</a>
      <h1 class="camera-page__title">{{ t('camera.title') }}</h1>
      <button v-if="!cameraError" type="button" class="camera-page__button" @click="switchCamera">
        {{ t('camera.switchCamera') }}
      </button>
    </header>

    <div class="camera-page__stage">
      <video ref="videoEl" class="camera-page__video" playsinline muted autoplay />
      <canvas ref="canvasEl" class="camera-page__overlay" @click="onCanvasClick" />

      <div v-if="isLoading" class="camera-page__status">
        <p>{{ t('camera.loadingModels') }}</p>
        <div class="camera-page__progress">
          <div class="camera-page__progress-bar" :style="{ width: `${Math.round(recognition.progress.value * 100)}%` }" />
        </div>
      </div>

      <div v-else-if="modelError || cameraError" class="camera-page__status">
        <p>{{ cameraError ? t(`camera.error.${cameraError}`) : t('camera.error.model') }}</p>
        <p v-if="modelError" class="camera-page__status-detail">{{ modelError }}</p>
      </div>

      <div v-if="recognition.backend.value === 'wasm'" class="camera-page__badge">
        {{ t('camera.lowSpeedMode') }}
      </div>

      <div v-if="debug" class="camera-page__debug">
        fps: {{ fps }} / detect: {{ Math.round(recognition.lastDetectMs.value) }}ms / embed: {{ Math.round(recognition.lastEmbedMs.value) }}ms
        / {{ recognition.backend.value }}{{ recognition.backend.value === 'wasm' && !isolated ? ' (single thread)' : '' }}
      </div>
    </div>

    <footer class="camera-page__footer">
      <label class="camera-page__debug-toggle">
        <input v-model="debug" type="checkbox"> {{ t('camera.debugLabel') }}
      </label>
      <p class="camera-page__license">
        {{ t('camera.licenseNote') }}:
        <a :href="repoUrl" target="_blank" rel="noopener">{{ t('camera.viewSource') }}</a>
      </p>
    </footer>
  </div>
</template>

<style scoped>
.camera-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  background: #0f172a;
  color: #e2e8f0;
}

.camera-page__bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  padding-top: calc(10px + env(safe-area-inset-top));
}

.camera-page__back {
  color: #93c5fd;
  text-decoration: none;
  white-space: nowrap;
}

.camera-page__title {
  flex: 1;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  text-align: center;
}

.camera-page__button {
  padding: 8px 14px;
  border: 1px solid #475569;
  border-radius: 8px;
  background: #1e293b;
  color: #e2e8f0;
  white-space: nowrap;
}

.camera-page__stage {
  position: relative;
  flex: 1;
  overflow: hidden;
  min-height: 50vh;
}

.camera-page__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-page__overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.camera-page__status {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  background: rgba(15, 23, 42, 0.85);
}

.camera-page__status-detail {
  font-size: 0.85rem;
  opacity: 0.7;
  word-break: break-all;
}

.camera-page__progress {
  width: min(320px, 70vw);
  height: 8px;
  border-radius: 4px;
  background: #334155;
  overflow: hidden;
}

.camera-page__progress-bar {
  height: 100%;
  background: #2d89ef;
  transition: width 0.3s;
}

.camera-page__badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(234, 179, 8, 0.9);
  color: #0f172a;
  font-size: 0.8rem;
  font-weight: 600;
}

.camera-page__debug {
  position: absolute;
  left: 12px;
  bottom: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.7);
  font-size: 0.75rem;
  font-family: monospace;
}

.camera-page__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 10px 16px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  font-size: 0.8rem;
}

.camera-page__debug-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
}

.camera-page__license {
  margin: 0;
  opacity: 0.7;
}

.camera-page__license a {
  color: #93c5fd;
}
</style>
