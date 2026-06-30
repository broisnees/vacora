import { PLATFORMS, CATEGORY_ORDER, type PlatformCategory } from '~~/shared/platforms'

const STORAGE = 'vacora-categories'

// Module-level singleton so every component shares one settings object.
const enabled = reactive<Record<PlatformCategory, boolean>>({
  domain: true,
  email: true,
  registry: true,
  code: true,
  social: true,
  creator: true,
})

let persisting = false

export function useSettings() {
  const enabledCats = computed(() => CATEGORY_ORDER.filter((c) => enabled[c]))
  const enabledPlatforms = computed(() => PLATFORMS.filter((p) => enabled[p.category]))

  function toggle(cat: PlatformCategory) {
    // Never let the user disable every category — keep at least one on.
    if (enabled[cat] && enabledCats.value.length === 1) return
    enabled[cat] = !enabled[cat]
  }

  // Load persisted prefs after hydration to avoid SSR mismatch.
  function load() {
    if (!import.meta.client) return
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || '{}') as Partial<Record<PlatformCategory, boolean>>
      for (const c of CATEGORY_ORDER) if (typeof saved[c] === 'boolean') enabled[c] = saved[c]!
    } catch {}
    if (persisting) return
    persisting = true
    watch(enabled, () => {
      try {
        localStorage.setItem(STORAGE, JSON.stringify(enabled))
      } catch {}
    })
  }

  return { enabled, enabledCats, enabledPlatforms, toggle, load }
}
