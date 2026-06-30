<script setup lang="ts">
import { Globe, AtSign, Package, Code, Hash, Sparkles } from '@lucide/vue'
import { BRAND_ICON } from '~/utils/brandIcons'
import type { PlatformMeta, CheckResult, PlatformCategory } from '~~/shared/platforms'

const props = defineProps<{
  platform: PlatformMeta
  result: CheckResult | undefined
}>()

const CAT_ICON: Record<PlatformCategory, any> = {
  domain: Globe,
  email: AtSign,
  registry: Package,
  code: Code,
  social: Hash,
  creator: Sparkles,
}

const brandPath = computed(() => BRAND_ICON[props.platform.id])

const state = computed(() => {
  const r = props.result
  if (!r) return { kind: 'scanning', label: 'checking' }
  if (r.available === true) return { kind: 'ok', label: 'available' }
  if (r.available === false) return { kind: 'no', label: 'taken' }
  return { kind: 'unknown', label: 'unknown' }
})

const href = computed(() => props.result?.url)
</script>

<template>
  <component
    :is="href ? 'a' : 'div'"
    :href="href"
    :target="href ? '_blank' : undefined"
    :rel="href ? 'noopener noreferrer' : undefined"
    class="row"
    :class="[state.kind, { 'is-link': !!href }]"
  >
    <svg v-if="brandPath" class="ico" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path :d="brandPath" fill="currentColor" />
    </svg>
    <component :is="CAT_ICON[platform.category]" v-else class="ico" :size="15" :stroke-width="1.75" aria-hidden="true" />

    <span class="row-name">{{ platform.name }}</span>
    <span class="row-hint">{{ platform.hint }}</span>
    <span class="mark" :class="state.kind" aria-hidden="true" />
    <span class="row-status" :class="state.kind">{{ state.label }}</span>
  </component>
</template>
