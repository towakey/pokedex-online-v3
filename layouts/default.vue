<template>
  <div class="app-shell">
    <AppHeader />
    <AppSidebar />
    <main class="page-shell">
      <div class="page-shell__inner">
        <slot />
      </div>
    </main>
  </div>
</template>
