// ── Brand (centralized — change in one place) ────────────────
export const BRAND = {
  name: 'vacora',
  tagline: 'check a name across 100+ platforms — instantly',
}

export type PlatformCategory = 'domain' | 'email' | 'registry' | 'code' | 'social' | 'creator'

export interface PlatformMeta {
  id: string
  name: string
  category: PlatformCategory
  hint: string
  weight: number
  /** Domain used to fetch the favicon (non-domain platforms). */
  fav?: string
}

// ── Domains (checked via DNS delegation + RDAP fallback) ─────
const TLDS: [tld: string, hint: string, weight: number][] = [
  ['com', 'the one everyone tries first', 5],
  ['io', 'startup favourite', 3],
  ['dev', 'developer products', 3],
  ['ai', 'ai products', 3],
  ['app', 'apps & products', 2],
  ['co', 'short .com alt', 2],
  ['net', 'classic fallback', 2],
  ['org', 'orgs & open source', 2],
  ['xyz', 'anything goes', 1],
  ['site', 'general purpose', 1],
  ['online', 'general purpose', 1],
  ['tech', 'tech companies', 1],
  ['cloud', 'infra & saas', 1],
  ['software', 'software products', 1],
  ['tools', 'developer tools', 1],
  ['run', 'apps & services', 1],
  ['build', 'build tools', 1],
  ['page', 'landing pages', 1],
  ['link', 'link-in-bio', 1],
  ['sh', 'cli & shell tools', 1],
  ['gg', 'gaming & community', 1],
  ['me', 'personal brand', 1],
  ['so', 'short & snappy', 1],
  ['to', 'short redirector', 1],
  ['tv', 'video & streaming', 1],
  ['fm', 'audio & podcasts', 1],
  ['studio', 'studios & agencies', 1],
  ['design', 'design products', 1],
  ['store', 'commerce', 1],
  ['shop', 'commerce', 1],
  ['world', 'broad brand', 1],
  ['life', 'lifestyle', 1],
  ['live', 'live & events', 1],
  ['space', 'communities', 1],
  ['club', 'communities', 1],
  ['blog', 'blogs & writing', 1],
  ['chat', 'messaging', 1],
  ['social', 'social products', 1],
  ['media', 'media & content', 1],
  ['news', 'news & media', 1],
  ['info', 'informational', 1],
  ['biz', 'business', 1],
  ['pro', 'professional', 1],
  ['vip', 'premium', 1],
  ['ninja', 'playful', 1],
  ['email', 'email products', 1],
  ['website', 'general purpose', 1],
  ['digital', 'digital products', 1],
  ['agency', 'agencies', 1],
  ['network', 'networks', 1],
  ['team', 'teams', 1],
  ['works', 'studios', 1],
  ['zone', 'general purpose', 1],
  ['wiki', 'wikis & docs', 1],
  ['games', 'gaming', 1],
  ['art', 'creative', 1],
]

const domainPlatforms: PlatformMeta[] = TLDS.map(([tld, hint, weight]) => ({
  id: `domain-${tld}`,
  name: `.${tld}`,
  category: 'domain',
  hint,
  weight,
}))

// Email: does the name's domain receive mail (MX records present)?
// available = no mail set up there; taken = mail is already configured.
const emailPlatforms: PlatformMeta[] = [
  { id: 'mx-com', name: 'name.com email', category: 'email', hint: 'mx records on .com', weight: 1 },
  { id: 'mx-io', name: 'name.io email', category: 'email', hint: 'mx records on .io', weight: 1 },
]

const registryPlatforms: PlatformMeta[] = [
  { id: 'npm', name: 'npm', hint: 'javascript packages', weight: 4, fav: 'npmjs.com' },
  { id: 'npm-org', name: 'npm @scope', hint: 'npm org namespace', weight: 2, fav: 'npmjs.com' },
  { id: 'jsr', name: 'jsr', hint: 'js registry scope', weight: 2, fav: 'jsr.io' },
  { id: 'pypi', name: 'pypi', hint: 'python packages', weight: 3, fav: 'pypi.org' },
  { id: 'crates', name: 'crates.io', hint: 'rust crates', weight: 3, fav: 'crates.io' },
  { id: 'dockerhub', name: 'docker hub', hint: 'container namespace', weight: 3, fav: 'docker.com' },
  { id: 'rubygems', name: 'rubygems', hint: 'ruby gems', weight: 2, fav: 'rubygems.org' },
  { id: 'nuget', name: 'nuget', hint: '.net packages', weight: 2, fav: 'nuget.org' },
  { id: 'maven', name: 'maven central', hint: 'jvm artifacts', weight: 2, fav: 'maven.apache.org' },
  { id: 'homebrew', name: 'homebrew', hint: 'macos formula', weight: 2, fav: 'brew.sh' },
  { id: 'homebrew-cask', name: 'homebrew cask', hint: 'macos app cask', weight: 1, fav: 'brew.sh' },
  { id: 'packagist', name: 'packagist', hint: 'php composer vendor', weight: 1, fav: 'packagist.org' },
  { id: 'pub-dev', name: 'pub.dev', hint: 'dart / flutter', weight: 1, fav: 'pub.dev' },
  { id: 'hex', name: 'hex.pm', hint: 'elixir / erlang', weight: 1, fav: 'hex.pm' },
  { id: 'cocoapods', name: 'cocoapods', hint: 'swift / objc', weight: 1, fav: 'cocoapods.org' },
  { id: 'anaconda', name: 'anaconda', hint: 'conda packages', weight: 1, fav: 'anaconda.org' },
  { id: 'cran', name: 'cran', hint: 'r packages', weight: 1, fav: 'r-project.org' },
  { id: 'deno', name: 'deno.land/x', hint: 'deno modules', weight: 1, fav: 'deno.land' },
  { id: 'wp-plugin', name: 'wp plugin', hint: 'wordpress plugins', weight: 1, fav: 'wordpress.org' },
  { id: 'firefox', name: 'firefox add-on', hint: 'browser extension', weight: 1, fav: 'mozilla.org' },
  { id: 'aur', name: 'aur', hint: 'arch linux', weight: 1, fav: 'archlinux.org' },
  { id: 'chocolatey', name: 'chocolatey', hint: 'windows packages', weight: 1, fav: 'chocolatey.org' },
].map((p) => ({ ...p, category: 'registry' as const }))

const codePlatforms: PlatformMeta[] = [
  { id: 'github', name: 'github', hint: 'user / org', weight: 4, fav: 'github.com' },
  { id: 'gitlab', name: 'gitlab', hint: 'user / group', weight: 2, fav: 'gitlab.com' },
  { id: 'codeberg', name: 'codeberg', hint: 'user / org', weight: 1, fav: 'codeberg.org' },
  { id: 'huggingface', name: 'hugging face', hint: 'ml models / user', weight: 2, fav: 'huggingface.co' },
].map((p) => ({ ...p, category: 'code' as const }))

const socialPlatforms: PlatformMeta[] = [
  { id: 'x', name: 'x / twitter', hint: '@handle', weight: 3, fav: 'x.com' },
  { id: 'youtube', name: 'youtube', hint: '@handle', weight: 3, fav: 'youtube.com' },
  { id: 'telegram', name: 'telegram', hint: 't.me/handle', weight: 2, fav: 'telegram.org' },
  { id: 'bluesky', name: 'bluesky', hint: 'name.bsky.social', weight: 2, fav: 'bsky.app' },
  { id: 'mastodon', name: 'mastodon', hint: 'mastodon.social', weight: 1, fav: 'joinmastodon.org' },
  { id: 'devto', name: 'dev.to', hint: 'dev community', weight: 1, fav: 'dev.to' },
  { id: 'linktree', name: 'linktree', hint: 'link-in-bio', weight: 1, fav: 'linktr.ee' },
  { id: 'keybase', name: 'keybase', hint: 'crypto identity', weight: 1, fav: 'keybase.io' },
  { id: 'gravatar', name: 'gravatar', hint: 'global avatar', weight: 1, fav: 'gravatar.com' },
  { id: 'hackernews', name: 'hacker news', hint: 'hn username', weight: 1, fav: 'news.ycombinator.com' },
  { id: 'aboutme', name: 'about.me', hint: 'personal page', weight: 1, fav: 'about.me' },
].map((p) => ({ ...p, category: 'social' as const }))

const creatorPlatforms: PlatformMeta[] = [
  { id: 'substack', name: 'substack', hint: 'newsletter subdomain', weight: 2, fav: 'substack.com' },
  { id: 'soundcloud', name: 'soundcloud', hint: 'audio creator', weight: 2, fav: 'soundcloud.com' },
  { id: 'patreon', name: 'patreon', hint: 'membership', weight: 2, fav: 'patreon.com' },
  { id: 'vimeo', name: 'vimeo', hint: 'video creator', weight: 1, fav: 'vimeo.com' },
  { id: 'behance', name: 'behance', hint: 'design portfolio', weight: 1, fav: 'behance.net' },
  { id: 'dribbble', name: 'dribbble', hint: 'design shots', weight: 1, fav: 'dribbble.com' },
  { id: 'itch', name: 'itch.io', hint: 'indie games', weight: 1, fav: 'itch.io' },
].map((p) => ({ ...p, category: 'creator' as const }))

export const PLATFORMS: PlatformMeta[] = [
  ...domainPlatforms,
  ...emailPlatforms,
  ...registryPlatforms,
  ...codePlatforms,
  ...socialPlatforms,
  ...creatorPlatforms,
]

export const CATEGORY_ORDER: PlatformCategory[] = ['domain', 'email', 'registry', 'code', 'social', 'creator']

export const CATEGORY_LABELS: Record<PlatformCategory, string> = {
  domain: 'domains',
  email: 'email (mx)',
  registry: 'package registries',
  code: 'code & dev',
  social: 'social',
  creator: 'creator & content',
}

export interface CheckResult {
  id: string
  /** true = available, false = taken, null = could not determine */
  available: boolean | null
  url?: string
  note?: string
}
