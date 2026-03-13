<script setup lang="ts">
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'

const appConfig = useSiteAppConfig()
const { buildPokemonDetailPath } = usePokedex()
const route = useRoute()
await navigateTo(buildPokemonDetailPath(appConfig.site.defaultArea, String(route.params.id ?? '')), {
  redirectCode: 301,
  replace: true
})
</script>
