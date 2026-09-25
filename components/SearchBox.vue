<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useTranslation } from '~/composables/useTranslation'
import type { SearchSuggestionItem } from '~/types/search'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  suggestions?: SearchSuggestionItem[]
  suggestionLimit?: number
}>(), {
  placeholder: '',
  suggestions: () => [],
  suggestionLimit: 8
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [item: SearchSuggestionItem]
}>()

const { t } = useTranslation()
const displayPlaceholder = computed(() => props.placeholder || t('common.searchPlaceholder'))
const isFocused = ref(false)
const highlightedIndex = ref(-1)
const root = ref<HTMLElement | null>(null)

const visibleSuggestions = computed(() => {
  if (!isFocused.value || !props.modelValue.trim()) {
    return []
  }

  return props.suggestions.slice(0, props.suggestionLimit)
})

const closeSuggestions = () => {
  isFocused.value = false
  highlightedIndex.value = -1
}

const emitValue = (value: string) => {
  emit('update:modelValue', value)
  highlightedIndex.value = -1
}

const selectSuggestion = async (item: SearchSuggestionItem) => {
  emitValue(item.label)
  emit('select', item)
  closeSuggestions()

  if (item.to) {
    await navigateTo(item.to)
  }
}

const handleKeydown = async (event: KeyboardEvent) => {
  if (visibleSuggestions.value.length === 0) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    highlightedIndex.value = (highlightedIndex.value + 1) % visibleSuggestions.value.length
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlightedIndex.value = highlightedIndex.value <= 0
      ? visibleSuggestions.value.length - 1
      : highlightedIndex.value - 1
    return
  }

  if (event.key === 'Enter' && highlightedIndex.value >= 0) {
    event.preventDefault()
    await selectSuggestion(visibleSuggestions.value[highlightedIndex.value])
    return
  }

  if (event.key === 'Escape') {
    closeSuggestions()
  }
}

const handleDocumentPointerDown = (event: PointerEvent) => {
  if (!root.value?.contains(event.target as Node)) {
    closeSuggestions()
  }
}

onMounted(() => {
  if (import.meta.client) {
    document.addEventListener('pointerdown', handleDocumentPointerDown)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener('pointerdown', handleDocumentPointerDown)
  }
})

const handleFocus = async () => {
  isFocused.value = true
  await nextTick()
}
</script>

<template>
  <div ref="root" class="search-box-wrap">
    <label class="search-box">
      <span class="search-box__icon">⌕</span>
      <input
        :value="modelValue"
        :placeholder="displayPlaceholder"
        type="search"
        class="search-box__input"
        autocomplete="off"
        role="combobox"
        :aria-expanded="visibleSuggestions.length > 0"
        aria-autocomplete="list"
        aria-controls="search-box-suggestions"
        @focus="handleFocus"
        @input="emitValue(($event.target as HTMLInputElement).value)"
        @keydown="handleKeydown"
      >
    </label>

    <ul
      v-if="visibleSuggestions.length > 0"
      id="search-box-suggestions"
      class="search-suggestions"
      role="listbox"
    >
      <li v-for="(item, index) in visibleSuggestions" :key="item.id" role="presentation">
        <button
          type="button"
          class="search-suggestions__item"
          :class="{ 'search-suggestions__item--active': index === highlightedIndex }"
          role="option"
          @mousedown.prevent="selectSuggestion(item)"
        >
          <img v-if="item.imageSrc" :src="item.imageSrc" :alt="item.label" class="search-suggestions__image">
          <span class="search-suggestions__text">
            <strong>{{ item.label }}</strong>
            <small v-if="item.description">{{ item.description }}</small>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
