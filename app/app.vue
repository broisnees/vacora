<script setup lang="ts">
import {
  Search, X, Sun, Moon, SlidersHorizontal, Zap, Plug, Copy, Check, ArrowUpRight, ArrowRight,
  Sparkles, Gem, LoaderCircle,
} from '@lucide/vue'
import { PLATFORMS, CATEGORY_ORDER, CATEGORY_LABELS, BRAND, type PlatformCategory } from '~~/shared/platforms'
import { computeScore } from '~/composables/useNameCheck'

const { results, scanning, name, doneCount, run, reset } = useNameCheck()
const { enabled, enabledCats, enabledPlatforms, toggle, load: loadSettings } = useSettings()
const { balance, free, packs, aiEnabled, refresh: refreshCredits, buy, setBalance } = useCredits()
const {
  suggestions, loading: suggesting, error: suggestError,
  phase: suggestPhase, phaseNames: suggestNames, generate, reset: resetSuggest,
} = useSuggest()

const input = ref('')
const error = ref('')
const hasSearched = ref(false)
const availOnly = ref(false)
const copied = ref(false)
const mcpCopied = ref(false)
const searchEl = ref<HTMLInputElement | null>(null)
const theme = ref<'dark' | 'light'>('dark')
const showSettings = ref(false)
const showMcp = ref(false)

// AI suggest mode
const mode = ref<'check' | 'suggest'>('check')
const idea = ref('')
const vibe = ref('')
const count = ref(6)
const showBuy = ref(false)

const examples = ['nimbus', 'zephyr', 'quanta', 'nebula']
const TOTAL = computed(() => enabledPlatforms.value.length)

// reflects wherever the app is actually running (localhost in dev, prod origin live)
const mcpOrigin = ref('https://vacora.app')
const MCP_CONFIG = computed(
  () => `{
  "mcpServers": {
    "vacora": {
      "url": "${mcpOrigin.value}/mcp"
    }
  }
}`,
)

useHead({ title: `${BRAND.name} — ${BRAND.tagline}` })

const score = computed(() => computeScore(results, enabledPlatforms.value))

// total platforms per category, regardless of which are enabled
const PLATFORMSByCat = (() => {
  const m = new Map<PlatformCategory, number>()
  for (const p of PLATFORMS) m.set(p.category, (m.get(p.category) ?? 0) + 1)
  return m
})()

const categoryMeta = computed(() =>
  CATEGORY_ORDER.map((cat) => ({ cat, label: CATEGORY_LABELS[cat], n: PLATFORMSByCat.get(cat) ?? 0, on: enabled[cat] })),
)

const groups = computed(() => {
  const byCat = new Map<PlatformCategory, typeof enabledPlatforms.value>()
  for (const p of enabledPlatforms.value) {
    const arr = byCat.get(p.category) ?? []
    arr.push(p)
    byCat.set(p.category, arr)
  }
  return CATEGORY_ORDER.filter((c) => byCat.has(c))
    .map((cat) => {
      const all = byCat.get(cat)!
      const available = all.filter((p) => results[p.id]?.available === true).length
      const visible = availOnly.value ? all.filter((p) => results[p.id]?.available === true) : all
      return { cat, label: CATEGORY_LABELS[cat], all, visible, available }
    })
    .filter((g) => g.visible.length > 0)
})

// compact availability badges on a suggestion card
const QUICK_LABELS: Record<string, string> = {
  'domain-com': '.com',
  'domain-io': '.io',
  'domain-ai': '.ai',
  github: 'github',
  npm: 'npm',
  x: 'x',
}
function badges(s: { available: Record<string, boolean | null> }) {
  return Object.entries(QUICK_LABELS).map(([id, label]) => ({
    label,
    kind: s.available[id] === true ? 'ok' : s.available[id] === false ? 'no' : 'unknown',
  }))
}

function validate(n: string): string {
  if (!n) return 'type a name to check'
  if (n.length < 2) return 'a little longer, please'
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(n)) return 'use letters, numbers and - _ . (start alphanumeric)'
  return ''
}

async function check() {
  const n = input.value.trim().toLowerCase()
  input.value = n
  const err = validate(n)
  error.value = err
  if (err) return
  hasSearched.value = true
  availOnly.value = false
  if (import.meta.client) history.replaceState({}, '', `?q=${encodeURIComponent(n)}`)
  await run(n, enabledPlatforms.value)
}

function tryExample(n: string) {
  input.value = n
  check()
}

// Emptying the input clears the search — results and URL query go with it.
function clearSearch() {
  input.value = ''
  error.value = ''
  hasSearched.value = false
  availOnly.value = false
  reset()
  if (import.meta.client) history.replaceState({}, '', location.pathname)
  searchEl.value?.focus()
}

watch(input, (v) => {
  if (v.trim() === '' && hasSearched.value) clearSearch()
})

// Re-scan when enabled categories change mid-search (debounced). Guarded by
// `settingsReady` so applying persisted settings on mount doesn't trigger a
// spurious second scan.
const settingsReady = ref(false)
let reRunTimer: ReturnType<typeof setTimeout> | undefined
watch(enabledCats, () => {
  if (!settingsReady.value || mode.value !== 'check' || !hasSearched.value || !name.value) return
  clearTimeout(reRunTimer)
  reRunTimer = setTimeout(() => run(name.value, enabledPlatforms.value), 200)
})

function setMode(m: 'check' | 'suggest') {
  mode.value = m
  error.value = ''
  if (m === 'suggest' && balance.value === null) refreshCredits()
}

async function runGenerate() {
  if (suggesting.value) return
  if (idea.value.trim().length < 8) {
    suggestError.value = 'describe the project in a bit more detail'
    return
  }
  try {
    const bal = await generate(idea.value, count.value, vibe.value)
    if (typeof bal === 'number') setBalance(bal)
  } catch (e: any) {
    if (e?.statusCode === 402 || e?.data?.statusCode === 402) showBuy.value = true
  }
}

// Click a suggestion → run the full scan on it.
function pickSuggestion(n: string) {
  mode.value = 'check'
  input.value = n
  check()
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function buyPack(pack: string) {
  try {
    await buy(pack)
    showBuy.value = false
  } catch {}
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  if (!import.meta.client) return
  document.documentElement.dataset.theme = theme.value
  try {
    localStorage.setItem('vacora-theme', theme.value)
  } catch {}
}

async function share() {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText(location.href)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {}
}

async function copyMcp() {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText(MCP_CONFIG.value)
    mcpCopied.value = true
    setTimeout(() => (mcpCopied.value = false), 1600)
  } catch {}
}

function closePopovers() {
  showSettings.value = false
  showMcp.value = false
}

function onKey(e: KeyboardEvent) {
  if (e.key === '/' && mode.value === 'check' && document.activeElement !== searchEl.value) {
    e.preventDefault()
    searchEl.value?.focus()
  } else if (e.key === 'Escape') {
    if (showSettings.value || showMcp.value || showBuy.value) {
      closePopovers()
      showBuy.value = false
    } else if (document.activeElement === searchEl.value && input.value) {
      e.preventDefault()
      clearSearch()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  theme.value = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  mcpOrigin.value = location.origin
  loadSettings()
  refreshCredits()
  const q = new URLSearchParams(location.search).get('q')
  if (q) {
    input.value = q
    check()
  }
  // Enable category-driven re-scans only after the persisted settings and any
  // initial query have settled (so loading them doesn't double-trigger a scan).
  nextTick(() => (settingsReady.value = true))
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="topbar">
    <div class="wrap topbar-inner">
      <div class="brand"><span class="sq" />{{ BRAND.name }}</div>
      <nav class="topbar-links">
        <span class="hide-sm count-pill">{{ TOTAL }} platforms</span>
        <button class="credits-pill" type="button" title="credits for AI naming" @click="showBuy = true">
          <Gem class="gem" :size="13" :stroke-width="1.75" /> {{ balance ?? '—' }}
        </button>
        <div class="pop-anchor">
          <button
            class="icon-btn"
            type="button"
            aria-label="categories to check"
            title="categories"
            :class="{ active: showSettings }"
            @click="showSettings = !showSettings; showMcp = false"
          >
            <SlidersHorizontal :size="16" :stroke-width="1.75" />
          </button>
          <div v-if="showSettings" class="popover">
            <div class="pop-head">categories to check</div>
            <button
              v-for="c in categoryMeta"
              :key="c.cat"
              type="button"
              class="setting-row"
              role="switch"
              :aria-checked="c.on"
              @click="toggle(c.cat)"
            >
              <span class="setting-label">{{ c.label }}</span>
              <span class="setting-count">{{ c.n }}</span>
              <span class="switch" :class="{ on: c.on }"><span class="knob" /></span>
            </button>
          </div>
        </div>
        <button
          class="icon-btn"
          type="button"
          :aria-label="theme === 'dark' ? 'switch to light theme' : 'switch to dark theme'"
          :title="theme === 'dark' ? 'light theme' : 'dark theme'"
          @click="toggleTheme"
        >
          <Sun v-if="theme === 'dark'" :size="16" :stroke-width="1.75" />
          <Moon v-else :size="16" :stroke-width="1.75" />
        </button>
      </nav>
    </div>
  </div>

  <div v-if="showSettings || showMcp" class="pop-overlay" @click="closePopovers" />

  <div class="wrap">
    <section class="hero" :class="{ compact: hasSearched }">
      <h1>{{ BRAND.name }}</h1>
      <p class="tag">check a brand or product name across <b>{{ TOTAL }}</b> platforms — instantly</p>

      <div class="mode-tabs">
        <button type="button" :class="{ on: mode === 'check' }" @click="setMode('check')">check a name</button>
        <button type="button" :class="{ on: mode === 'suggest' }" @click="setMode('suggest')">
          <Sparkles :size="14" :stroke-width="1.75" /> suggest names
        </button>
      </div>

      <!-- AI suggest mode -->
      <form v-if="mode === 'suggest'" class="suggest" @submit.prevent="runGenerate">
        <div class="composer">
          <textarea
            v-model="idea"
            class="composer-input"
            rows="3"
            placeholder="describe your project — what it does, who it's for, the vibe you want…"
            aria-label="project description"
          />
          <div class="composer-bar">
            <input v-model="vibe" class="composer-vibe" placeholder="vibe — playful, techy, premium…" aria-label="vibe" />
            <label class="composer-count">
              <select v-model.number="count" aria-label="number of names">
                <option v-for="n in [4, 6, 8, 10]" :key="n" :value="n">{{ n }} names</option>
              </select>
            </label>
            <button class="btn composer-go" type="submit" :disabled="suggesting || !aiEnabled">
              <span v-if="suggesting" class="spin"><LoaderCircle :size="14" :stroke-width="2" /></span>
              <Sparkles v-else :size="14" :stroke-width="1.75" />
              {{ suggesting ? 'thinking…' : 'generate' }}
              <span class="btn-credit">1 credit</span>
            </button>
          </div>
        </div>
        <p v-if="suggestError" class="error">{{ suggestError }}</p>
        <p v-else class="subline">
          <Sparkles class="bolt" :size="13" :stroke-width="2" />
          <template v-if="!aiEnabled">AI naming needs <b>MISTRAL_API_KEY</b> set on the server</template>
          <template v-else>brainstorms, then <b>checks availability</b> — you keep only what's free · <b>{{ balance ?? '—' }}</b> credits</template>
        </p>
      </form>

      <!-- name check mode -->
      <form v-else class="search" @submit.prevent="check">
        <div class="search-row">
          <Search class="search-ico" :size="17" :stroke-width="1.75" />
          <input
            ref="searchEl"
            v-model="input"
            type="text"
            autocapitalize="off"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            placeholder="search a name ..."
            aria-label="name to check"
            @input="error = ''"
          />
          <button v-if="input" class="clear" type="button" aria-label="clear search" title="clear (esc)" @click="clearSearch">
            <X :size="16" :stroke-width="2" />
          </button>
          <kbd v-else class="kbd-hint">/</kbd>
          <button class="btn" type="submit" :disabled="scanning">{{ scanning ? 'scanning…' : 'check' }}</button>
        </div>
      </form>

      <p v-if="mode === 'check' && error" class="error">{{ error }}</p>
      <p v-else-if="mode === 'check' && !hasSearched" class="subline">
        <Zap class="bolt" :size="13" :stroke-width="2" /> domains, registries, code hosts, social &amp; creator — all at once
      </p>

      <div v-if="mode === 'check' && !hasSearched" class="examples">
        <span class="examples-label">try</span>
        <button v-for="ex in examples" :key="ex" type="button" class="ex" @click="tryExample(ex)">{{ ex }}</button>
      </div>
    </section>

    <main v-if="mode === 'check' && hasSearched" class="results">
      <div class="verdict">
        <div class="verdict-top">
          <div class="verdict-name">{{ name }}</div>
          <div class="verdict-actions">
            <button class="mini" :class="{ on: availOnly }" type="button" @click="availOnly = !availOnly">available only</button>
            <button class="mini" type="button" @click="share">
              <Check v-if="copied" :size="13" :stroke-width="2.25" />
              {{ copied ? 'copied' : 'share' }}
            </button>
          </div>
        </div>

        <div class="verdict-body">
          <div class="grade-badge" :class="{ pending: scanning }">{{ scanning ? '·' : score.grade }}</div>
          <div class="verdict-headline">
            <div class="verdict-score"><b>{{ scanning ? '··' : score.value }}</b><span>/ 100 score</span></div>
            <div class="verdict-say">{{ scanning ? 'scanning…' : score.verdict }}</div>
          </div>
          <div class="verdict-avail">
            <div class="verdict-avail-num"><b>{{ score.available }}</b><span>/ {{ TOTAL }}</span></div>
            <span class="verdict-avail-lbl">available · {{ doneCount }} checked</span>
          </div>
        </div>

        <div class="bar">
          <div class="bar-fill" :style="{ width: (scanning ? (doneCount / TOTAL) * 100 : score.value) + '%' }" />
        </div>
      </div>

      <section v-for="g in groups" :key="g.cat" class="group">
        <div class="group-head">
          <h3>{{ g.label }}</h3>
          <span class="rule" />
          <span class="frac">{{ g.available }}/{{ g.all.length }} free</span>
        </div>
        <div class="rows">
          <ResultChip v-for="p in g.visible" :key="p.id" :platform="p" :result="results[p.id]" />
        </div>
      </section>

      <p v-if="availOnly && !groups.length" class="empty">
        {{ scanning ? 'scanning…' : 'nothing available yet — this name is well claimed.' }}
      </p>
    </main>

    <!-- AI suggestion results -->
    <main v-else-if="mode === 'suggest' && (suggesting || suggestions.length)" class="results">
      <div v-if="suggesting" class="gen">
        <div class="gen-bar"><span class="gen-bar-fill" /></div>
        <div class="gen-status">
          <span class="spin"><LoaderCircle :size="15" :stroke-width="2" /></span>
          <span class="gen-label">{{ suggestPhase || 'starting' }}<span class="gen-dots" /></span>
        </div>
        <div v-if="suggestNames.length" class="gen-names">
          <span v-for="n in suggestNames" :key="n" class="gen-name">{{ n }}</span>
        </div>
        <div class="suggest-grid gen-skeleton" aria-hidden="true">
          <div v-for="i in count" :key="i" class="sug-card skel">
            <div class="skel-line w-name" />
            <div class="skel-line w-why" />
            <div class="skel-line w-badge" />
          </div>
        </div>
      </div>
      <div v-else class="suggest-grid">
        <button v-for="s in suggestions" :key="s.name" class="sug-card" type="button" @click="pickSuggestion(s.name)">
          <div class="sug-top">
            <span class="sug-name">{{ s.name }}</span>
            <span class="sug-ring" :class="{ hi: s.score >= 70 }">
              <svg viewBox="0 0 36 36" aria-hidden="true">
                <circle class="sug-ring-track" cx="18" cy="18" r="15.9155" />
                <circle class="sug-ring-bar" cx="18" cy="18" r="15.9155" :stroke-dasharray="`${s.score} 100`" />
              </svg>
              <span class="sug-ring-num">{{ s.score }}</span>
            </span>
          </div>
          <p class="sug-why">{{ s.rationale }}</p>
          <div class="sug-badges">
            <span v-for="b in badges(s)" :key="b.label" class="sug-badge" :class="b.kind">
              <i class="sug-badge-dot" />{{ b.label }}
            </span>
          </div>
          <span class="sug-cta">
            <span>check all {{ TOTAL }}</span>
            <ArrowRight class="sug-cta-arrow" :size="15" :stroke-width="2" />
          </span>
        </button>
      </div>
    </main>
  </div>

  <!-- buy credits modal -->
  <div v-if="showBuy" class="modal-overlay" @click.self="showBuy = false">
    <div class="modal" role="dialog" aria-label="buy credits">
      <div class="modal-head">
        <h3>credits</h3>
        <button class="modal-x" type="button" aria-label="close" @click="showBuy = false"><X :size="16" :stroke-width="2" /></button>
      </div>
      <p class="modal-sub">you have <b>{{ balance ?? '—' }}</b> credits. each AI naming run costs <b>1</b>. new visitors get {{ free }} free.</p>
      <div class="packs">
        <button v-for="(p, id) in packs" :key="id" class="pack" type="button" @click="buyPack(id)">
          <span class="pack-credits">{{ p.credits }} credits</span>
          <span class="pack-price">{{ p.price }}</span>
        </button>
      </div>
      <p class="modal-note">demo grants instantly. set <code>STRIPE_SECRET_KEY</code> for real checkout.</p>
    </div>
  </div>

  <div class="wrap">
    <footer class="footer" id="how">
      <div class="footer-main">
        <div class="footer-brand"><span class="sq" />{{ BRAND.name }}</div>
        <p class="footer-note">checks live registry, rdap &amp; dns data in parallel — a strong signal, not trademark advice.</p>
      </div>
      <div class="footer-right">
        <div class="pop-anchor">
          <button class="footer-btn" type="button" :class="{ active: showMcp }" @click="showMcp = !showMcp; showSettings = false">
            <Plug :size="14" :stroke-width="1.75" /> add to your agent
          </button>
          <div v-if="showMcp" class="popover mcp-pop">
            <div class="pop-head">install as an mcp server</div>
            <pre class="mcp-code">{{ MCP_CONFIG }}</pre>
            <button class="mcp-copy" type="button" @click="copyMcp">
              <component :is="mcpCopied ? Check : Copy" :size="13" :stroke-width="2" />
              {{ mcpCopied ? 'copied' : 'copy config' }}
            </button>
          </div>
        </div>
        <a class="footer-link" href="https://nuxt.com" target="_blank" rel="noopener noreferrer">
          built with nuxt <ArrowUpRight :size="13" :stroke-width="1.75" />
        </a>
      </div>
    </footer>
  </div>
</template>
