<script setup lang="ts">
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'

const appConfig = useSiteAppConfig()
const { buildPokemonDetailPath, parsePokemonDexNumber } = usePokedex()
const route = useRoute()
const rawId = String(route.params.id ?? '').trim()
const dex = parsePokemonDexNumber(rawId)
await navigateTo(buildPokemonDetailPath(appConfig.site.defaultArea, Number.isFinite(dex) && dex > 0 ? dex : rawId, rawId.includes('_') ? rawId : undefined), {
  redirectCode: 301,
  replace: true
})
</script>
