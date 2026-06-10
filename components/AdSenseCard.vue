<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAdSense } from '~/composables/useAdSense'

interface Props {
  slotType?: string
  adClient?: string
  adSlot?: string
  adFormat?: string
  adLayout?: string
  adLayoutKey?: string
  fullWidthResponsive?: string
  width?: string | number
  height?: string | number
  showLabel?: boolean
  labelType?: 'advertisement' | 'sponsored' | 'promotion'
  labelText?: string
  cardClass?: string
  forceTestMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  slotType: 'rectangle',
  adFormat: 'auto',
  width: '100%',
  height: 'auto',
  showLabel: true,
  labelType: 'advertisement',
  cardClass: '',
  forceTestMode: false,
  fullWidthResponsive: undefined,
  adClient: undefined,
  adSlot: undefined,
  adLayout: undefined,
  adLayoutKey: undefined,
  labelText: undefined
})

const {
  config,
  initializeConfig,
  ensureAdScriptLoaded,
  getSlot,
  getLabel,
  clientId,
  isTestMode
} = useAdSense()

const adElement = ref<HTMLElement | null>(null)
const rootElement = ref<HTMLElement | null>(null)
const isAdLoaded = ref(false)
const adError = ref(false)
const initialized = ref(false)
const isNearViewport = ref(false)
let viewportObserver: IntersectionObserver | null = null

const normalizedSizeValue = (value: string | number): string => typeof value === 'number' ? `${value}px` : value

const cardStyle = computed(() => ({
  width: '100%',
  maxWidth: normalizedSizeValue(props.width)
}))

const reservedMinHeight = computed(() => {
  const value = normalizedSizeValue(props.height)
  return value === 'auto' ? '250px' : value
})

const containerStyle = computed(() => ({
  minHeight: reservedMinHeight.value
}))

const adStyle = computed(() => ({
  display: 'block',
  width: normalizedSizeValue(props.width),
  height: normalizedSizeValue(props.height)
}))

const actualClient = computed(() => props.adClient || clientId.value)
const actualSlot = computed(() => props.adSlot || getSlot(props.slotType))
const actualLabel = computed(() => props.labelText || getLabel(props.labelType))
const actualTestMode = computed(() => props.forceTestMode || isTestMode.value)
const actualFullWidthResponsive = computed(() => props.fullWidthResponsive || config.value.settings.fullWidthResponsive)
const actualAdFormat = computed(() => props.adFormat || config.value.settings.adFormat)
const shouldShowPlaceholder = computed(() => actualTestMode.value || !String(actualClient.value ?? '').trim() || !String(actualSlot.value ?? '').trim())

const placeholderMessage = computed(() => {
  if (actualTestMode.value) {
    return 'AdSense test mode'
  }

  if (!String(actualClient.value ?? '').trim()) {
    return 'AdSense client is not configured'
  }

  if (!String(actualSlot.value ?? '').trim()) {
    return 'AdSense slot is not configured'
  }

  return 'Advertisement'
})

const initializeAd = async () => {
  if (!import.meta.client || initialized.value || shouldShowPlaceholder.value || !isNearViewport.value) {
    return
  }

  await nextTick()

  if (!adElement.value) {
    return
  }

  const loaded = await ensureAdScriptLoaded(actualClient.value)
  if (!loaded) {
    adError.value = true
    return
  }

  try {
    if (adElement.value.dataset.adInitialized === 'true') {
      initialized.value = true
      isAdLoaded.value = true
      return
    }

    ;((window as typeof window & { adsbygoogle?: unknown[] }).adsbygoogle = (window as typeof window & { adsbygoogle?: unknown[] }).adsbygoogle || []).push({})
    adElement.value.dataset.adInitialized = 'true'
    initialized.value = true
    isAdLoaded.value = true
    adError.value = false
  }
  catch {
    adError.value = true
  }
}

onMounted(async () => {
  await initializeConfig()

  if (typeof IntersectionObserver === 'undefined' || !rootElement.value) {
    isNearViewport.value = true
    await initializeAd()
    return
  }

  viewportObserver = new IntersectionObserver(async (entries) => {
    if (entries.some(entry => entry.isIntersecting)) {
      isNearViewport.value = true
      viewportObserver?.disconnect()
      viewportObserver = null
      await initializeAd()
    }
  }, { rootMargin: '200px 0px' })
  viewportObserver.observe(rootElement.value)
})

onBeforeUnmount(() => {
  viewportObserver?.disconnect()
  viewportObserver = null
})

watch(
  () => [actualClient.value, actualSlot.value, actualAdFormat.value, actualFullWidthResponsive.value, actualTestMode.value],
  async () => {
    if (!import.meta.client) {
      return
    }

    initialized.value = false
    isAdLoaded.value = false
    adError.value = false
    await initializeAd()
  }
)
</script>

<template>
  <section ref="rootElement" :class="['adsense-card', cardClass, { 'adsense-card--error': adError }]" :style="cardStyle">
    <header v-if="showLabel" class="adsense-card__header">
      {{ actualLabel }}
    </header>

    <div class="adsense-card__body" :style="containerStyle">
      <div v-if="shouldShowPlaceholder || adError" class="adsense-card__placeholder">
        <span class="adsense-card__placeholder-label">{{ actualLabel }}</span>
        <strong class="adsense-card__placeholder-message">{{ placeholderMessage }}</strong>
      </div>

      <ins
        v-else
        ref="adElement"
        class="adsbygoogle adsense-card__ins"
        :style="adStyle"
        :data-ad-client="actualClient"
        :data-ad-slot="actualSlot"
        :data-ad-format="actualAdFormat"
        :data-full-width-responsive="actualFullWidthResponsive"
        :data-ad-layout="adLayout"
        :data-ad-layout-key="adLayoutKey"
      />
    </div>
  </section>
</template>

<style scoped>
.adsense-card {
  display: grid;
  gap: 0;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.72);
  overflow: hidden;
}

.adsense-card--error {
  border-color: rgba(239, 68, 68, 0.25);
}

.adsense-card__header {
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  font-size: 0.75rem;
  line-height: 1.2;
  text-align: center;
  color: rgba(15, 23, 42, 0.72);
}

.adsense-card__body {
  display: grid;
  place-items: center;
  padding: 0.75rem;
}

.adsense-card__placeholder {
  display: grid;
  place-items: center;
  gap: 0.35rem;
  width: 100%;
  min-height: inherit;
  padding: 1rem;
  border: 1px dashed rgba(148, 163, 184, 0.35);
  border-radius: 0.75rem;
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.92), rgba(241, 245, 249, 0.92));
  color: #334155;
  text-align: center;
}

.adsense-card__placeholder-label {
  font-size: 0.75rem;
  opacity: 0.8;
}

.adsense-card__placeholder-message {
  font-size: 0.95rem;
  line-height: 1.4;
}

.adsense-card__ins {
  max-width: 100%;
  overflow: hidden;
}

@media (max-width: 720px) {
  .adsense-card__body {
    padding: 0.65rem;
  }
}
</style>
