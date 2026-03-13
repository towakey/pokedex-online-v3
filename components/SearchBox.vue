<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
}>(), {
  placeholder: '名前・図鑑番号・タイプで検索'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <label class="search-box">
    <span class="search-box__icon">⌕</span>
    <input
      :value="modelValue"
      :placeholder="placeholder"
      type="search"
      class="search-box__input"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </label>
</template>
