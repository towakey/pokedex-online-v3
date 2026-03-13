<script setup lang="ts">
import { useSiteAppConfig } from '~/composables/useSiteAppConfig'

const appConfig = useSiteAppConfig()
const { normalizeRegionSlug } = usePokedex()
const route = useRoute()
await navigateTo(`${appConfig.navigation.pokedex}/${normalizeRegionSlug(String(route.params.region ?? ''))}`, {
  redirectCode: 301,
  replace: true
})
</script>
