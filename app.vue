<script setup lang="ts">
useHead({
  link: [
    {
      rel: 'icon',
      type: 'image/png',
      href: '/icon.png'
    },
    {
      rel: 'manifest',
      href: '/manifest.webmanifest'
    }
  ],
  script: [
    {
      innerHTML: `(function(){try{var stored=localStorage.getItem('pokedex-theme');var theme=stored==='light'||stored==='dark'?stored:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=theme;}catch(e){}})();`,
      tagPriority: 'critical'
    }
  ]
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
