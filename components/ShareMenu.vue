<script setup lang="ts">
interface ShareMenuProps {
  title: string
  text: string
  url?: string
  clipboardText?: string
  language?: 'jpn' | 'eng'
  trigger?: 'icon' | 'button'
  tone?: 'light' | 'secondary'
  align?: 'left' | 'right'
  buttonLabel?: string
  ariaLabel?: string
  buttonClass?: string
}

interface ShareOption {
  key: 'native' | 'twitter' | 'bluesky' | 'mastodon' | 'line' | 'copy'
  label: string
}

const props = withDefaults(defineProps<ShareMenuProps>(), {
  url: '',
  clipboardText: '',
  language: 'jpn',
  trigger: 'button',
  tone: 'secondary',
  align: 'right',
  buttonLabel: '共有',
  ariaLabel: '共有する',
  buttonClass: ''
})

const emit = defineEmits<{
  copied: []
  error: [error: unknown]
}>()

const menuRef = ref<HTMLDetailsElement | null>(null)
const isEnglish = computed(() => props.language === 'eng')
const labels = computed(() => ({
  system: isEnglish.value ? 'System Share' : 'システム共有',
  twitter: 'X / Twitter',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  line: 'LINE',
  copy: isEnglish.value ? 'Copy' : 'コピー',
  mastodonPrompt: isEnglish.value ? 'Enter your Mastodon instance URL' : 'マストドンのインスタンスURLを入力してください'
}))
const canNativeShare = computed(() => import.meta.client && typeof navigator !== 'undefined' && typeof navigator.share === 'function')
const shareOptions = computed<ShareOption[]>(() => {
  const options: ShareOption[] = []

  if (canNativeShare.value) {
    options.push({ key: 'native', label: labels.value.system })
  }

  options.push(
    { key: 'twitter', label: labels.value.twitter },
    { key: 'bluesky', label: labels.value.bluesky },
    { key: 'mastodon', label: labels.value.mastodon },
    { key: 'line', label: labels.value.line },
    { key: 'copy', label: labels.value.copy }
  )

  return options
})
const triggerClasses = computed(() => {
  if (props.trigger === 'icon') {
    return [
      'icon-button',
      props.tone === 'light' ? 'icon-button--light' : 'share-menu__icon-button',
      'share-menu__trigger',
      props.buttonClass
    ]
  }

  return [
    'button-primary',
    props.tone === 'secondary' ? 'button-primary--secondary' : '',
    'share-menu__trigger',
    'share-menu__button',
    props.buttonClass
  ]
})

const closeMenu = () => {
  if (menuRef.value) {
    menuRef.value.open = false
  }
}

const handleDocumentClick = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    closeMenu()
  }
}

const getShareText = (): string => String(props.text ?? '').trim()
const getShareUrl = (): string => String(props.url ?? '').trim()
const getClipboardText = (): string => {
  const explicitText = String(props.clipboardText ?? '').trim()
  if (explicitText) {
    return explicitText
  }

  return [getShareText(), getShareUrl()].filter(Boolean).join(' ')
}

const normalizeMastodonInstance = (value: string): string => {
  const normalized = String(value ?? '').trim().replace(/\/+$/, '')
  if (!normalized) {
    return ''
  }

  return /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`
}

const openPopup = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer,width=550,height=420')
}

const copyText = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const fallback = document.createElement('textarea')
  fallback.value = text
  fallback.setAttribute('readonly', 'true')
  fallback.style.position = 'fixed'
  fallback.style.opacity = '0'
  fallback.style.pointerEvents = 'none'
  document.body.appendChild(fallback)
  fallback.select()
  const didCopy = document.execCommand('copy')
  document.body.removeChild(fallback)

  if (!didCopy) {
    throw new Error('Clipboard copy failed')
  }
}

const handleShare = async (network: ShareOption['key']) => {
  if (!import.meta.client) {
    return
  }

  closeMenu()

  const text = getShareText()
  const url = getShareUrl()

  try {
    switch (network) {
      case 'native': {
        if (!navigator.share) {
          return
        }

        await navigator.share(url
          ? {
              title: props.title,
              text,
              url
            }
          : {
              title: props.title,
              text
            })
        return
      }
      case 'twitter': {
        const params = new URLSearchParams()
        if (text) {
          params.set('text', text)
        }
        if (url) {
          params.set('url', url)
        }
        openPopup(`https://twitter.com/intent/tweet?${params.toString()}`)
        return
      }
      case 'bluesky': {
        const composedText = [text, url].filter(Boolean).join('\n')
        openPopup(`https://bsky.app/intent/compose?text=${encodeURIComponent(composedText)}`)
        return
      }
      case 'mastodon': {
        const instance = normalizeMastodonInstance(window.prompt(labels.value.mastodonPrompt) ?? '')
        if (!instance) {
          return
        }
        const composedText = [text, url].filter(Boolean).join('\n')
        openPopup(`${instance}/share?text=${encodeURIComponent(composedText)}`)
        return
      }
      case 'line': {
        const composedText = [text, url].filter(Boolean).join(' ')
        openPopup(`https://line.me/R/msg/text/?${encodeURIComponent(composedText)}`)
        return
      }
      case 'copy': {
        await copyText(getClipboardText())
        emit('copied')
        return
      }
    }
  }
  catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return
    }

    console.error('Share failed:', error)
    emit('error', error)
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <details ref="menuRef" class="share-menu" :class="[`share-menu--${align}`, `share-menu--${trigger}`]">
    <summary :class="triggerClasses" :aria-label="ariaLabel">
      <svg viewBox="0 0 24 24" class="share-menu__trigger-icon" aria-hidden="true">
        <path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zm5 16H5V5h7V3H5c-1.11 0-2 .89-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7z" />
      </svg>
      <span v-if="trigger === 'button'">{{ buttonLabel }}</span>
    </summary>

    <div class="share-menu__panel">
      <button
        v-for="option in shareOptions"
        :key="option.key"
        type="button"
        class="share-menu__item"
        @click="handleShare(option.key)"
      >
        <span class="share-menu__item-label">{{ option.label }}</span>
      </button>
    </div>
  </details>
</template>

<style scoped>
.share-menu {
  position: relative;
  display: inline-flex;
}

.share-menu__trigger {
  cursor: pointer;
  user-select: none;
}

.share-menu__trigger::-webkit-details-marker {
  display: none;
}

.share-menu__trigger::marker {
  content: '';
}

.share-menu__trigger-icon {
  display: block;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.share-menu__button {
  gap: 0.45rem;
  white-space: nowrap;
}

.share-menu__icon-button {
  background: white;
  color: var(--primary-strong);
  border: 1px solid var(--border);
}

.share-menu__panel {
  position: absolute;
  top: calc(100% + 8px);
  z-index: 80;
  display: grid;
  gap: 4px;
  min-width: 176px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.share-menu--right .share-menu__panel {
  right: 0;
}

.share-menu--left .share-menu__panel {
  left: 0;
}

.share-menu__item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  text-align: left;
}

.share-menu__item:hover {
  background: var(--primary-soft);
  color: var(--primary-strong);
}

.share-menu__item-label {
  font-weight: 600;
}

@media (max-width: 720px) {
  .share-menu__panel {
    min-width: 164px;
  }
}
</style>
