<template>
  <header class="app-header">
    <div class="container app-header__inner">
      <NuxtLink to="/" class="brand-link">
        <span class="brand-link__mark">Dex</span>
        <span class="brand-link__text">
          <strong>Pokédex Online</strong>
          <small>Static Nuxt Edition</small>
        </span>
      </NuxtLink>

      <nav class="app-nav">
        <NuxtLink to="/" class="nav-link">
          全国図鑑
        </NuxtLink>
        <NuxtLink to="/region/national" class="nav-link">
          地域図鑑
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>
