<script setup lang="ts">
definePageMeta({
  middleware: () => navigateTo('/search/tag', { redirectCode: 301 })
})
</script>
