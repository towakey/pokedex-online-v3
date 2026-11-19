<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'
import { useTranslation } from '~/composables/useTranslation'
import type { GuessEntry } from '~/composables/usePokedex'

interface GuessQuestion {
  key: string
  text: string
  matches: (pokemon: GuessEntry) => boolean
}

const RESULT_LIMIT = 5
const GUESS_DISPLAY_LIMIT = 24

const appConfig = useSiteAppConfig()
const { t, getRegionLabel } = useTranslation()
const { loadGuess, buildPokemonDetailPath } = usePokedex()

const allPokemon = ref<GuessEntry[]>([])
const questions = ref<GuessQuestion[]>([])
const candidates = ref<GuessEntry[]>([])
const usedQuestionKeys = ref<Set<string>>(new Set())
const answerLog = ref<Array<{ question: string; answer: string }>>([])
const loading = ref(true)
const loadFailed = ref(false)

const buildQuestions = (entries: GuessEntry[]): GuessQuestion[] => {
  const types = new Set<string>()
  const generations = new Set<number>()
  const regions = new Set<string>()
  const eggGroups = new Set<string>()

  for (const pokemon of entries) {
    pokemon.types.forEach((type) => types.add(type))
    generations.add(pokemon.generation)
    pokemon.regions.forEach((region) => regions.add(region))
    pokemon.eggGroups?.forEach((group) => eggGroups.add(group))
  }

  const list: GuessQuestion[] = []
  for (const type of [...types].sort()) {
    list.push({ key: `type:${type}`, text: `タイプは「${type}」ですか？`, matches: (pokemon) => pokemon.types.includes(type) })
  }
  for (const generation of [...generations].sort()) {
    list.push({ key: `gen:${generation}`, text: `第${generation}世代のポケモンですか？`, matches: (pokemon) => pokemon.generation === generation })
  }
  for (const region of [...regions].sort()) {
    const label = getRegionLabel(region)
    list.push({ key: `region:${region}`, text: `${label}地方の図鑑に登場しますか？`, matches: (pokemon) => pokemon.regions.includes(region) })
  }
  for (const group of [...eggGroups].sort()) {
    list.push({ key: `egg:${group}`, text: `タマゴグループは「${group}」ですか？`, matches: (pokemon) => pokemon.eggGroups?.includes(group) ?? false })
  }
  list.push(
    { key: 'dual-type', text: 'タイプは2つありますか？', matches: (pokemon) => pokemon.types.length >= 2 },
    { key: 'can-evolve', text: '進化することができますか？', matches: (pokemon) => pokemon.canEvolve },
    { key: 'is-evolved', text: '進化した姿ですか？', matches: (pokemon) => pokemon.isEvolved },
    { key: 'has-variants', text: '別の姿やフォルムがありますか？', matches: (pokemon) => pokemon.hasVariants },
    { key: 'height', text: '身長は1m以上ですか？', matches: (pokemon) => (pokemon.height ?? 0) >= 1 },
    { key: 'weight', text: '体重は100kg以上ですか？', matches: (pokemon) => (pokemon.weight ?? 0) >= 100 },
    { key: 'stat-total', text: '種族値の合計は600以上ですか？', matches: (pokemon) => (pokemon.statTotal ?? 0) >= 600 }
  )
  return list
}

const currentQuestion = computed(() => {
  let best: GuessQuestion | undefined
  let bestScore = 0

  for (const question of questions.value) {
    if (usedQuestionKeys.value.has(question.key)) {
      continue
    }

    let yes = 0
    for (const pokemon of candidates.value) {
      if (question.matches(pokemon)) {
        yes++
      }
    }
    const no = candidates.value.length - yes
    if (yes === 0 || no === 0) {
      continue
    }

    const score = Math.min(yes, no)
    if (score > bestScore) {
      best = question
      bestScore = score
    }
  }

  return best
})

const phase = computed(() => {
  if (loading.value) {
    return 'loading'
  }
  if (loadFailed.value) {
    return 'error'
  }
  if (candidates.value.length === 0) {
    return 'empty'
  }
  if (candidates.value.length <= RESULT_LIMIT || !currentQuestion.value) {
    return 'result'
  }
  return 'question'
})

const answer = (value: 'yes' | 'no' | 'unknown') => {
  const question = currentQuestion.value
  if (!question) {
    return
  }

  usedQuestionKeys.value = new Set([...usedQuestionKeys.value, question.key])
  answerLog.value.push({ question: question.text, answer: value })

  if (value !== 'unknown') {
    const expected = value === 'yes'
    candidates.value = candidates.value.filter((pokemon) => question.matches(pokemon) === expected)
  }
}

const reset = () => {
  candidates.value = allPokemon.value
  usedQuestionKeys.value = new Set()
  answerLog.value = []
}

const answerLabel = (value: string) => ({ yes: 'はい', no: 'いいえ', unknown: 'わからない' })[value] ?? value

const breadcrumbItems = computed(() => [
  { label: t('common.home'), to: appConfig.navigation.home },
  { label: t('common.pokemonGuess') }
])

useSiteSeo({
  title: () => t('common.pokemonGuess'),
  description: () => '質問に「はい」「いいえ」で答えて、思い浮かべたポケモンを当てるゲーム'
})

onMounted(async () => {
  try {
    const entries = await loadGuess()
    allPokemon.value = entries
    questions.value = buildQuestions(entries)
    candidates.value = entries
  }
  catch {
    loadFailed.value = true
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="container page-stack">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <section class="hero surface hero--compact">
      <div class="hero__content">
        <span class="eyebrow">{{ t('common.pokemonGuess') }}</span>
        <h1 class="hero__title hero__title--detail">
          {{ t('common.pokemonGuess') }}
        </h1>
        <p>ポケモンを1匹思い浮かべてください。質問に「はい」「いいえ」で答えると当てます。</p>
      </div>
    </section>

    <section v-if="phase === 'loading'" class="surface guess-panel">
      <p>読み込み中…</p>
    </section>

    <section v-else-if="phase === 'error'" class="surface guess-panel">
      <p>データを読み込めませんでした。</p>
    </section>

    <section v-else-if="phase === 'question'" class="surface guess-panel">
      <p class="guess-panel__meta">
        質問 {{ answerLog.length + 1 }} / 残り候補 {{ candidates.length }} 件
      </p>
      <h2 class="guess-panel__question">
        {{ currentQuestion?.text }}
      </h2>
      <div class="guess-panel__actions">
        <button type="button" class="button-primary" @click="answer('yes')">
          はい
        </button>
        <button type="button" class="button-primary" @click="answer('no')">
          いいえ
        </button>
        <button type="button" class="button-primary button-primary--secondary" @click="answer('unknown')">
          わからない
        </button>
      </div>
    </section>

    <section v-else-if="phase === 'result'" class="surface guess-panel">
      <h2 class="guess-panel__question">
        {{ candidates.length <= 5 ? '思い浮かべたポケモンはこの中にいますか？' : `候補は ${candidates.length} 件まで絞り込みました` }}
      </h2>
      <div class="pokemon-grid">
        <PokemonCard
          v-for="pokemon in candidates.slice(0, GUESS_DISPLAY_LIMIT)"
          :key="pokemon.id"
          :pokemon="pokemon"
        />
      </div>
      <details v-if="candidates.length > GUESS_DISPLAY_LIMIT" class="guess-remaining">
        <summary>ほか {{ candidates.length - GUESS_DISPLAY_LIMIT }} 件をすべて表示</summary>
        <ul class="guess-remaining__list">
          <li v-for="pokemon in candidates.slice(GUESS_DISPLAY_LIMIT)" :key="pokemon.id">
            <NuxtLink :to="buildPokemonDetailPath(appConfig.site.defaultArea, pokemon.dex, pokemon.id)">
              No.{{ String(pokemon.dex).padStart(4, '0') }} {{ pokemon.name }}
            </NuxtLink>
          </li>
        </ul>
      </details>
      <div class="guess-panel__actions">
        <button type="button" class="button-primary" @click="reset">
          もう一度
        </button>
      </div>
    </section>

    <section v-else-if="phase === 'empty'" class="surface guess-panel">
      <h2 class="guess-panel__question">
        条件に合うポケモンが見つかりませんでした
      </h2>
      <p>回答を変えてもう一度試してみてください。</p>
      <div class="guess-panel__actions">
        <button type="button" class="button-primary" @click="reset">
          もう一度
        </button>
      </div>
    </section>

    <section v-if="answerLog.length" class="surface guess-log">
      <h2 class="guess-log__title">
        回答履歴
      </h2>
      <ul class="guess-log__list">
        <li v-for="(entry, index) in answerLog" :key="index">
          {{ entry.question }} → {{ answerLabel(entry.answer) }}
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.guess-panel {
  display: grid;
  gap: 16px;
  padding: 24px;
  text-align: center;
  justify-items: center;
}

.guess-panel__meta {
  color: var(--text-soft);
  font-size: 0.9rem;
}

.guess-panel__question {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0;
}

.guess-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.guess-panel .pokemon-grid {
  width: 100%;
}

.guess-remaining {
  width: 100%;
  text-align: left;
}

.guess-remaining__list {
  margin: 12px 0 0;
  padding-left: 1.2em;
  columns: 2;
  font-size: 0.9rem;
}

.guess-remaining__list a {
  color: var(--primary-strong);
  font-weight: 600;
}

.guess-log {
  padding: 18px 24px;
}

.guess-log__title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 8px;
}

.guess-log__list {
  margin: 0;
  padding-left: 1.2em;
  font-size: 0.9rem;
}
</style>
