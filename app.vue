<script setup lang="ts">
useHead({
  meta: [
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'Pokédex' }
  ],
  link: [
    {
      rel: 'icon',
      type: 'image/png',
      href: '/icon.png'
    },
    {
      rel: 'apple-touch-icon',
      href: '/apple-touch-icon.png'
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
