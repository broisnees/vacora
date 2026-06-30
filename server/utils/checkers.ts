import { promises as dns } from 'node:dns'
import type { CheckResult } from '~~/shared/platforms'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36'
const TIMEOUT_MS = 9000

async function status(
  url: string,
  opts: { headers?: Record<string, string>; redirect?: RequestRedirect } = {},
): Promise<number> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      redirect: opts.redirect ?? 'manual',
      headers: { 'user-agent': UA, accept: '*/*', ...opts.headers },
      signal: ctrl.signal,
    })
    return res.status
  } finally {
    clearTimeout(timer)
  }
}

async function json<T = any>(url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: T | null }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: 'application/json', ...headers },
      signal: ctrl.signal,
    })
    let body: T | null = null
    try {
      body = (await res.json()) as T
    } catch {
      body = null
    }
    return { status: res.status, body }
  } finally {
    clearTimeout(timer)
  }
}

async function text(url: string): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: 'text/html,application/json,*/*' },
      signal: ctrl.signal,
    })
    return { status: res.status, body: await res.text() }
  } finally {
    clearTimeout(timer)
  }
}

/** 404/410 ⇒ available, 2xx/3xx ⇒ taken, everything else ⇒ unknown. */
function fromStatus(code: number): boolean | null {
  if (code === 404 || code === 410 || code === 400) return true
  if (code >= 200 && code < 400) return false
  return null
}

type Result = Omit<CheckResult, 'id'>
type Checker = (name: string) => Promise<Result>

/** GET a URL and classify by status. */
function pageChecker(buildUrl: (n: string) => string, userUrl: (n: string) => string, lower = true): Checker {
  return async (name) => {
    const n = lower ? name.toLowerCase() : name
    return { available: fromStatus(await status(buildUrl(n), { redirect: 'manual' })), url: userUrl(n) }
  }
}

// ── Domains: DNS delegation first (fast), RDAP as a fallback ──
async function isDelegated(domain: string): Promise<boolean | null> {
  try {
    const ns = await Promise.race([
      dns.resolveNs(domain),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
    ])
    return Array.isArray(ns) && ns.length > 0
  } catch (e: any) {
    if (e?.code === 'ENOTFOUND' || e?.code === 'ENODATA') return false
    return null
  }
}

function domainChecker(tld: string): Checker {
  return async (name) => {
    const domain = `${name}.${tld}`.toLowerCase()
    const delegated = await isDelegated(domain)
    let available: boolean | null
    if (delegated === true) available = false
    else if (delegated === false) available = true
    else {
      // DNS inconclusive — confirm with RDAP, but never let a failed fallback
      // turn a domain into a hard error; report unknown instead.
      try {
        const rdap = await status(`https://rdap.org/domain/${domain}`, { redirect: 'follow' })
        available = rdap === 200 ? false : rdap === 404 ? true : null
      } catch {
        available = null
      }
    }
    return {
      available,
      url:
        available === false
          ? `https://${domain}`
          : `https://www.namecheap.com/domains/registration/results/?domain=${domain}`,
    }
  }
}

/** MX-record lookup: does this domain receive email? */
function mxChecker(tld: string): Checker {
  return async (name) => {
    const domain = `${name}.${tld}`.toLowerCase()
    try {
      const mx = await Promise.race([
        dns.resolveMx(domain),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
      ])
      const has = Array.isArray(mx) && mx.length > 0
      return { available: !has, url: `https://${domain}`, note: has ? 'mail is configured' : 'no mail records' }
    } catch (e: any) {
      if (e?.code === 'ENOTFOUND' || e?.code === 'ENODATA') return { available: true, note: 'no mail records' }
      return { available: null, note: 'mx lookup failed' }
    }
  }
}

const checkers: Record<string, Checker> = {
  // ── registries ──
  npm: pageChecker((n) => `https://registry.npmjs.org/${encodeURIComponent(n)}`, (n) => `https://www.npmjs.com/package/${n}`),

  'npm-org': async (name) => {
    const scope = name.toLowerCase()
    const { status: code, body } = await json<{ objects?: { package?: { name?: string } }[] }>(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(`@${scope}/`)}&size=20`,
    )
    if (code < 200 || code >= 300) return { available: null, note: 'npm search unavailable' }
    const taken = (body?.objects ?? []).some((o) => o.package?.name?.toLowerCase().startsWith(`@${scope}/`))
    return { available: !taken, url: `https://www.npmjs.com/org/${name}` }
  },

  jsr: pageChecker((n) => `https://api.jsr.io/scopes/${encodeURIComponent(n)}`, (n) => `https://jsr.io/@${n}`),
  pypi: pageChecker((n) => `https://pypi.org/pypi/${encodeURIComponent(n)}/json`, (n) => `https://pypi.org/project/${n}/`),
  crates: pageChecker((n) => `https://crates.io/api/v1/crates/${encodeURIComponent(n)}`, (n) => `https://crates.io/crates/${n}`, false),
  dockerhub: pageChecker((n) => `https://hub.docker.com/v2/users/${encodeURIComponent(n)}/`, (n) => `https://hub.docker.com/u/${n}`),
  rubygems: pageChecker((n) => `https://rubygems.org/api/v1/gems/${encodeURIComponent(n)}.json`, (n) => `https://rubygems.org/gems/${n}`),
  nuget: pageChecker((n) => `https://api.nuget.org/v3-flatcontainer/${encodeURIComponent(n)}/index.json`, (n) => `https://www.nuget.org/packages/${n}`),

  maven: async (name) => {
    const { status: code, body } = await json<{ response?: { numFound?: number } }>(
      `https://search.maven.org/solrsearch/select?q=a:%22${encodeURIComponent(name)}%22&rows=1&wt=json`,
    )
    if (code < 200 || code >= 300) return { available: null, note: 'maven unavailable' }
    return { available: (body?.response?.numFound ?? 0) === 0, url: `https://central.sonatype.com/search?q=${name}` }
  },

  homebrew: pageChecker((n) => `https://formulae.brew.sh/api/formula/${encodeURIComponent(n)}.json`, (n) => `https://formulae.brew.sh/formula/${n}`),
  'homebrew-cask': pageChecker((n) => `https://formulae.brew.sh/api/cask/${encodeURIComponent(n)}.json`, (n) => `https://formulae.brew.sh/cask/${n}`),

  packagist: async (name) => {
    const { status: code, body } = await json<{ packageNames?: string[] }>(
      `https://packagist.org/packages/list.json?vendor=${encodeURIComponent(name)}`,
    )
    if (code < 200 || code >= 300) return { available: null, note: 'packagist unavailable' }
    const taken = !!body?.packageNames && body.packageNames.length > 0
    return { available: !taken, url: `https://packagist.org/packages/${name}/`, note: 'vendor namespace' }
  },

  'pub-dev': pageChecker((n) => `https://pub.dev/api/packages/${encodeURIComponent(n)}`, (n) => `https://pub.dev/packages/${n}`),
  hex: pageChecker((n) => `https://hex.pm/api/packages/${encodeURIComponent(n)}`, (n) => `https://hex.pm/packages/${n}`),
  cocoapods: pageChecker((n) => `https://trunk.cocoapods.org/api/v1/pods/${encodeURIComponent(n)}`, (n) => `https://cocoapods.org/pods/${n}`, false),
  anaconda: pageChecker((n) => `https://api.anaconda.org/package/anaconda/${encodeURIComponent(n)}`, (n) => `https://anaconda.org/anaconda/${n}`),
  cran: pageChecker((n) => `https://crandb.r-pkg.org/${encodeURIComponent(n)}`, (n) => `https://cran.r-project.org/package=${n}`, false),
  deno: pageChecker((n) => `https://apiland.deno.dev/v2/modules/${encodeURIComponent(n)}`, (n) => `https://deno.land/x/${n}`),
  'wp-plugin': pageChecker((n) => `https://api.wordpress.org/plugins/info/1.0/${encodeURIComponent(n)}.json`, (n) => `https://wordpress.org/plugins/${n}/`),
  firefox: pageChecker((n) => `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(n)}/`, (n) => `https://addons.mozilla.org/firefox/addon/${n}/`),

  aur: async (name) => {
    const { status: code, body } = await json<{ resultcount?: number }>(
      `https://aur.archlinux.org/rpc/?v=5&type=info&arg=${encodeURIComponent(name.toLowerCase())}`,
    )
    if (code < 200 || code >= 300) return { available: null, note: 'aur unavailable' }
    return { available: (body?.resultcount ?? 0) === 0, url: `https://aur.archlinux.org/packages/${name.toLowerCase()}` }
  },

  chocolatey: pageChecker((n) => `https://community.chocolatey.org/packages/${encodeURIComponent(n)}`, (n) => `https://community.chocolatey.org/packages/${n}`),

  // ── code & dev ──
  github: async (name) => {
    const headers: Record<string, string> = {}
    if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    const code = await status(`https://api.github.com/users/${encodeURIComponent(name)}`, { redirect: 'follow', headers })
    if (code === 403 || code === 429) return { available: null, note: 'rate limited — set GITHUB_TOKEN' }
    return { available: fromStatus(code), url: `https://github.com/${name}` }
  },

  gitlab: async (name) => {
    const { status: code, body } = await json<unknown[]>(`https://gitlab.com/api/v4/users?username=${encodeURIComponent(name)}`)
    if (code < 200 || code >= 300) return { available: null, note: 'gitlab unavailable' }
    return { available: !(Array.isArray(body) && body.length > 0), url: `https://gitlab.com/${name}` }
  },

  codeberg: async (name) => ({
    available: fromStatus(
      await status(`https://codeberg.org/api/v1/users/${encodeURIComponent(name)}`, {
        redirect: 'follow',
        headers: { 'user-agent': 'NameCheck/1.0 name-checker' },
      }),
    ),
    url: `https://codeberg.org/${name}`,
  }),

  huggingface: pageChecker((n) => `https://huggingface.co/api/users/${encodeURIComponent(n)}/overview`, (n) => `https://huggingface.co/${n}`, false),

  // ── social ──
  x: async (name) => {
    const code = await status(`https://x.com/${encodeURIComponent(name)}`, { redirect: 'manual' })
    if (code === 403 || code === 429) return { available: null, note: 'rate limited' }
    return { available: fromStatus(code), url: `https://x.com/${name}` }
  },

  youtube: pageChecker((n) => `https://www.youtube.com/@${encodeURIComponent(n)}`, (n) => `https://www.youtube.com/@${n}`, false),

  telegram: async (name) => {
    const { status: code, body } = await text(`https://t.me/${encodeURIComponent(name)}`)
    if (code < 200 || code >= 400) return { available: null, note: 'telegram unavailable' }
    return { available: !/tgme_page_title|tgme_page_extra/.test(body), url: `https://t.me/${name}` }
  },

  bluesky: async (name) => {
    const handle = `${name.toLowerCase()}.bsky.social`
    const code = await status(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`, { redirect: 'follow' })
    if (code === 200) return { available: false, url: `https://bsky.app/profile/${handle}` }
    if (code === 400) return { available: true, url: `https://bsky.app/profile/${handle}`, note: '.bsky.social' }
    return { available: null, note: 'bluesky unavailable' }
  },

  mastodon: async (name) => {
    const code = await status(`https://mastodon.social/api/v1/accounts/lookup?acct=${encodeURIComponent(name)}`, { redirect: 'manual' })
    return { available: fromStatus(code), url: `https://mastodon.social/@${name}`, note: 'mastodon.social' }
  },

  devto: pageChecker((n) => `https://dev.to/${encodeURIComponent(n)}`, (n) => `https://dev.to/${n}`),
  linktree: pageChecker((n) => `https://linktr.ee/${encodeURIComponent(n)}`, (n) => `https://linktr.ee/${n}`),
  keybase: pageChecker((n) => `https://keybase.io/${encodeURIComponent(n)}`, (n) => `https://keybase.io/${n}`),
  gravatar: pageChecker((n) => `https://gravatar.com/${encodeURIComponent(n)}.json`, (n) => `https://gravatar.com/${n}`),

  hackernews: async (name) => {
    const { status: code, body } = await text(`https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(name)}.json`)
    if (code < 200 || code >= 300) return { available: null, note: 'hn unavailable' }
    return { available: body.trim() === 'null', url: `https://news.ycombinator.com/user?id=${name}` }
  },

  aboutme: pageChecker((n) => `https://about.me/${encodeURIComponent(n)}`, (n) => `https://about.me/${n}`),

  // ── creator & content ──
  substack: pageChecker((n) => `https://${n}.substack.com`, (n) => `https://${n}.substack.com`),
  soundcloud: pageChecker((n) => `https://soundcloud.com/${encodeURIComponent(n)}`, (n) => `https://soundcloud.com/${n}`),
  patreon: pageChecker((n) => `https://www.patreon.com/${encodeURIComponent(n)}`, (n) => `https://www.patreon.com/${n}`),
  vimeo: pageChecker((n) => `https://vimeo.com/${encodeURIComponent(n)}`, (n) => `https://vimeo.com/${n}`),
  behance: pageChecker((n) => `https://www.behance.net/${encodeURIComponent(n)}`, (n) => `https://www.behance.net/${n}`),
  dribbble: pageChecker((n) => `https://dribbble.com/${encodeURIComponent(n)}`, (n) => `https://dribbble.com/${n}`),
  itch: pageChecker((n) => `https://${n}.itch.io`, (n) => `https://${n}.itch.io`),
}

/** Run a single check by platform id. Domain/mx ids are handled generically. */
export async function runChecker(id: string, name: string): Promise<Result> {
  if (id.startsWith('domain-')) return domainChecker(id.slice('domain-'.length))(name)
  if (id.startsWith('mx-')) return mxChecker(id.slice('mx-'.length))(name)
  const fn = checkers[id]
  if (!fn) throw new Error(`unknown platform: ${id}`)
  return fn(name)
}

export function hasChecker(id: string): boolean {
  return id.startsWith('domain-') || id.startsWith('mx-') || id in checkers
}

// ── In-memory cache: definite answers are reused for a while. This keeps
//    repeat searches instant and cuts how often we hit platform rate limits.
const cache = new Map<string, { at: number; res: Result }>()
const CACHE_TTL = 10 * 60 * 1000

export async function runCheckerCached(id: string, name: string): Promise<Result> {
  const key = `${id}:${name}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.res
  const res = await runChecker(id, name)
  if (res.available !== null) cache.set(key, { at: Date.now(), res }) // don't cache failures
  return res
}

// ── Quick check: a small, high-signal subset used by the AI naming agent and
//    for fast availability badges. Avoids the full ~100-platform sweep.
export const QUICK_IDS = ['domain-com', 'domain-io', 'domain-ai', 'github', 'npm', 'x', 'youtube'] as const

export async function quickCheck(name: string): Promise<Record<string, boolean | null>> {
  const out: Record<string, boolean | null> = {}
  await Promise.all(
    QUICK_IDS.map(async (id) => {
      try {
        out[id] = (await runCheckerCached(id, name)).available
      } catch {
        out[id] = null
      }
    }),
  )
  return out
}

/** Run `fn` over items with at most `limit` in flight at once. */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

/** A 0–100 desirability score from a quick-check result (weights .com highest). */
export function quickScore(avail: Record<string, boolean | null>): number {
  const weights: Record<string, number> = { 'domain-com': 5, 'domain-io': 2, 'domain-ai': 2, github: 3, npm: 2, x: 2, youtube: 1 }
  let got = 0
  let total = 0
  for (const [id, w] of Object.entries(weights)) {
    if (avail[id] === null || avail[id] === undefined) continue
    total += w
    if (avail[id]) got += w
  }
  return total === 0 ? 0 : Math.round((got / total) * 100)
}

export function validateName(name: string): string | null {
  if (!name) return 'Please enter a name'
  if (name.length < 2) return 'Name is too short'
  if (name.length > 64) return 'Name is too long'
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name))
    return 'Use letters, numbers, and - _ . only (must start with a letter or number)'
  return null
}
