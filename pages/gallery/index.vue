<script setup lang="ts">
import { computed, ref } from 'vue'
import { galleryItems, type GalleryItem } from '~/data/galleryItems'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'

const appConfig = useSiteAppConfig()
const selectedItem = ref<GalleryItem | null>(null)

const breadcrumbs = computed(() => [
  {
    label: 'ホーム',
    to: appConfig.navigation.home
  },
  {
    label: 'ギャラリー',
    to: appConfig.navigation.gallery
  }
])

const openItem = (item: GalleryItem) => {
  selectedItem.value = item
}

const closeDialog = () => {
  selectedItem.value = null
}

useSiteSeo({
  title: 'ギャラリー',
  description: 'ポケモンのある風景の写真ギャラリーです。'
})
</script>

<template>
  <div class="container page-stack">
    <nav class="breadcrumbs" aria-label="パンくずリスト">
      <ol class="breadcrumbs__list">
        <li v-for="(item, index) in breadcrumbs" :key="item.to" class="breadcrumbs__item">
          <NuxtLink v-if="index < breadcrumbs.length - 1" :to="item.to" class="breadcrumbs__link">
            {{ item.label }}
          </NuxtLink>
          <span v-else class="breadcrumbs__current">{{ item.label }}</span>
        </li>
      </ol>
    </nav>

    <section class="hero hero--compact surface">
      <div class="hero__content">
        <span class="eyebrow">Gallery</span>
        <h1 class="hero__title">ギャラリー</h1>
        <p class="hero__description">
          
        </p>
        <div class="pill-row">
          <span class="command-chip">{{ galleryItems.length }} items</span>
          <NuxtLink :to="appConfig.navigation.home" class="pill-link">
            ホームへ戻る
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="surface section-card page-stack">
      <div class="section-header">
        <div>
          <span class="eyebrow">Photo Grid</span>
          <h2 class="section-title">写真一覧</h2>
        </div>
        <p class="section-caption">
          画像を選ぶと拡大表示できます。
        </p>
      </div>

      <div class="gallery-grid">
        <button
          v-for="item in galleryItems"
          :key="item.id"
          type="button"
          class="gallery-card"
          :aria-label="`ギャラリー画像 ${item.id} を開く`"
          @click="openItem(item)"
        >
          <img
            :src="item.src"
            :alt="`ギャラリー画像 ${item.id}`"
            class="gallery-card__image"
            loading="lazy"
          >
          <span class="gallery-card__badge">#{{ item.id }}</span>
        </button>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="selectedItem"
        class="gallery-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="`ギャラリー画像 ${selectedItem.id}`"
        @click.self="closeDialog"
      >
        <div class="gallery-dialog__card surface">
          <div class="gallery-dialog__actions">
            <button type="button" class="icon-button gallery-dialog__close" aria-label="閉じる" @click="closeDialog">
              <svg viewBox="0 0 24 24" class="icon-button__svg icon-button__svg--close" aria-hidden="true">
                <path fill="currentColor" d="M18.3 5.71 12 12.01l-6.3-6.3-1.41 1.41 6.3 6.3-6.3 6.29 1.41 1.42 6.3-6.3 6.29 6.3 1.42-1.42-6.3-6.29 6.3-6.3z" />
              </svg>
            </button>
          </div>

          <img
            :src="selectedItem.src"
            :alt="`ギャラリー画像 ${selectedItem.id}`"
            class="gallery-dialog__image"
          >

          <div class="gallery-dialog__body">
            <p class="gallery-dialog__description">{{ selectedItem.description }}</p>
            <a
              v-if="selectedItem.xLink"
              :href="selectedItem.xLink"
              target="_blank"
              rel="noopener noreferrer"
              class="gallery-dialog__link"
            >
              X で見る
            </a>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.gallery-card {
  position: relative;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: white;
  box-shadow: var(--shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.gallery-card:hover {
  transform: translateY(-3px);
  border-color: #90caf9;
  box-shadow: var(--shadow-strong);
}

.gallery-card__image {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
}

.gallery-card__badge {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: white;
  font-size: 0.82rem;
  font-weight: 700;
}

.gallery-dialog {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.68);
}

.gallery-dialog__card {
  width: min(960px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
}

.gallery-dialog__actions {
  position: sticky;
  top: 0;
  display: flex;
  justify-content: flex-end;
  padding: 12px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.72));
  backdrop-filter: blur(8px);
}

.gallery-dialog__close {
  background: rgba(15, 23, 42, 0.8);
  color: white;
}

.gallery-dialog__image {
  display: block;
  width: 100%;
  max-height: 68vh;
  object-fit: contain;
  background: #f8fbff;
}

.gallery-dialog__body {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.gallery-dialog__description {
  margin: 0;
  line-height: 1.8;
  white-space: pre-wrap;
}

.gallery-dialog__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  min-height: 42px;
  padding: 0 16px;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-weight: 700;
}

.gallery-dialog__link:hover {
  background: #d6eafc;
}

@media (max-width: 960px) {
  .gallery-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .gallery-grid {
    grid-template-columns: 1fr;
  }

  .gallery-dialog {
    padding: 12px;
  }

  .gallery-dialog__body {
    padding: 16px;
  }
}
</style>
