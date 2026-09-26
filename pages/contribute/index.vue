<script setup lang="ts">
import { computed } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTranslation } from '~/composables/useTranslation'

const REPO_URL = 'https://github.com/towakey/pokedex'
const ISSUES_URL = `${REPO_URL}/issues`
const PULLS_URL = `${REPO_URL}/pulls`

const appConfig = useSiteAppConfig()
const { t } = useTranslation()

const breadcrumbItems = computed(() => [
  { label: t('common.home'), to: appConfig.navigation.home },
  { label: t('common.contribute') }
])

const includes = computed(() => [
  t('contribute.includes1'),
  t('contribute.includes2'),
  t('contribute.includes3'),
  t('contribute.includes4'),
  t('contribute.includes5')
])

const steps = computed(() => [
  t('contribute.step1'),
  t('contribute.step2'),
  t('contribute.step3')
])

const tips = computed(() => [
  t('contribute.tips1'),
  t('contribute.tips2'),
  t('contribute.tips3')
])

useSiteSeo({
  title: () => t('contribute.title'),
  description: () => t('contribute.heroDescription')
})
</script>

<template>
  <div class="container page-stack">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <section class="hero surface hero--compact">
      <div class="hero__content">
        <span class="eyebrow">{{ t('contribute.eyebrow') }}</span>
        <h1 class="hero__title hero__title--detail">
          {{ t('contribute.title') }}
        </h1>
        <p class="hero__description">
          {{ t('contribute.heroDescription') }}
        </p>
        <div class="pill-row">
          <a :href="REPO_URL" target="_blank" rel="noopener noreferrer" class="button-primary repo-button">
            <svg viewBox="0 0 16 16" class="repo-button__icon" aria-hidden="true">
              <path fill="currentColor" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
            </svg>
            <span>{{ t('contribute.viewRepo') }}</span>
          </a>
        </div>
      </div>
    </section>

    <section class="surface section-card contribute-section">
      <div class="section-header">
        <div>
          <span class="eyebrow">towakey/pokedex</span>
          <h2 class="section-title">{{ t('contribute.aboutTitle') }}</h2>
        </div>
      </div>
      <p class="section-text">{{ t('contribute.aboutBody') }}</p>
      <p class="section-note">{{ t('contribute.aboutNote') }}</p>
    </section>

    <section class="surface section-card contribute-section">
      <div class="section-header">
        <div>
          <h2 class="section-title">{{ t('contribute.includesTitle') }}</h2>
        </div>
      </div>
      <ul class="contribute-list">
        <li v-for="item in includes" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section class="surface section-card contribute-section">
      <div class="section-header">
        <div>
          <h2 class="section-title">{{ t('contribute.howTitle') }}</h2>
        </div>
      </div>
      <ol class="contribute-steps">
        <li v-for="(step, index) in steps" :key="index">
          <span class="contribute-steps__number" aria-hidden="true">{{ index + 1 }}</span>
          <span>{{ step }}</span>
        </li>
      </ol>
      <p class="section-text">{{ t('contribute.howIssue') }}</p>
      <div class="pill-row">
        <a :href="ISSUES_URL" target="_blank" rel="noopener noreferrer" class="pill-link">
          {{ t('contribute.openIssue') }}
        </a>
        <a :href="PULLS_URL" target="_blank" rel="noopener noreferrer" class="pill-link">
          {{ t('contribute.openPr') }}
        </a>
      </div>
    </section>

    <section class="surface section-card contribute-section">
      <div class="section-header">
        <div>
          <h2 class="section-title">{{ t('contribute.tipsTitle') }}</h2>
        </div>
      </div>
      <ul class="contribute-list">
        <li v-for="tip in tips" :key="tip">{{ tip }}</li>
      </ul>
    </section>

    <section class="surface section-card contribute-section">
      <div class="section-header">
        <div>
          <h2 class="section-title">{{ t('contribute.useTitle') }}</h2>
        </div>
      </div>
      <p class="section-text">{{ t('contribute.useBody') }}</p>
    </section>

    <AdSenseCard
      slot-type="banner"
      width="100%"
      :height="90"
      label-type="sponsored"
    />
  </div>
</template>

<style scoped>
.repo-button {
  gap: 8px;
  text-decoration: none;
}

.repo-button__icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.contribute-section {
  display: grid;
  gap: 14px;
}

.section-text {
  margin: 0;
  color: var(--text);
  line-height: 1.8;
}

.section-note {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.85rem;
  line-height: 1.6;
}

.contribute-list {
  margin: 0;
  padding-left: 1.2em;
  display: grid;
  gap: 8px;
  color: var(--text);
  line-height: 1.7;
}

.contribute-steps {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.contribute-steps li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--text);
  line-height: 1.7;
}

.contribute-steps__number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 0;
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-size: 0.85rem;
  font-weight: 700;
}
</style>
