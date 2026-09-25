<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  active?: boolean
  rootMargin?: string
}>(), {
  active: true,
  rootMargin: '240px 0px'
})

const emit = defineEmits<{
  visible: []
}>()

const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const disconnect = () => {
  observer?.disconnect()
  observer = null
}

const connect = () => {
  disconnect()

  if (!import.meta.client || !props.active || !sentinel.value) {
    return
  }

  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      emit('visible')
    }
  }, { rootMargin: props.rootMargin })

  observer.observe(sentinel.value)
}

onMounted(connect)

watch(() => [props.active, props.rootMargin], connect)

onBeforeUnmount(disconnect)
</script>

<template>
  <div ref="sentinel" class="infinite-scroll-sentinel" aria-hidden="true" />
</template>
