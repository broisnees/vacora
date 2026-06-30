# vacora 🔎

A fast brand/product **name availability checker**, built with Nuxt 4. Type a name and it scans
**100+ platforms** — domains, package registries, code hosts, social and creator sites — in parallel,
streaming each result as it resolves, then scores how brandable the name actually is.

> The project name lives in one place — `BRAND` in `shared/platforms.ts` — change it there to rebrand.

## What it checks (102 signals)

| Category | Count | Examples |
| --- | --- | --- |
| **Domains** | 56 | `.com .io .dev .ai .app .co .net .org .xyz .site .tech .cloud .sh .gg .me .studio` … |
| **Email (MX)** | 2 | `name.com` / `name.io` mail records |
| **Package registries** | 22 | npm, npm `@scope`, JSR, PyPI, crates.io, Docker Hub, RubyGems, NuGet, Maven, Homebrew (+cask), Packagist, pub.dev, Hex, CocoaPods, Anaconda, CRAN, Deno, WP plugins, Firefox add-ons, AUR, Chocolatey |
| **Code & dev** | 4 | GitHub, GitLab, Codeberg, Hugging Face |
| **Social** | 11 | X/Twitter, YouTube, Telegram, Bluesky, Mastodon, dev.to, Linktree, Keybase, Gravatar, Hacker News, about.me |
| **Creator & content** | 7 | Substack, SoundCloud, Patreon, Vimeo, Behance, Dribbble, itch.io |

Every check hits the platform's live API/registry server-side (no CORS, no API keys required) and
reports **available / taken / unknown**. A weighted score (domains, npm and GitHub count for more)
produces an A+–F **brandability grade**.

> Bot-walled platforms (Instagram, TikTok, Twitch, Reddit, Medium, Product Hunt, Ko-fi …) are
> deliberately **excluded** — they return the same HTTP status for any input, so any result would be a
> guess. Reverse-DNS namespaces (Flathub, Gradle) are excluded for the same reason.

It also checks **email**: an MX-record lookup tells you whether `name.com` / `name.io` already receive
mail (configured = in use; none = free for you).

> **Why not "is `name@gmail.com` free?"** Gmail, Outlook, Proton and the rest deliberately block public
> address-existence checks to stop enumeration — there is no reliable way to query it, so vacora doesn't
> fake one. The MX check is the honest, reliable email signal.

## How it's fast & reliable

- **One streaming connection.** `GET /api/scan?name=…` runs the checks server-side and streams NDJSON,
  one line per result the instant it resolves — avoids the browser's ~6-connections-per-host cap and
  fills the UI progressively.
- **Bounded concurrency.** At most 12 checks run at once. Firing all ~100 simultaneously overwhelmed the
  DNS resolver (and downstream RDAP), which produced timeouts / "check failed"; the pool keeps every
  check reliable.
- **In-memory cache (10 min).** Repeat searches are instant and we hit platform rate limits far less.
- **Domains via DNS first.** A registered domain is delegated, so a single nameserver lookup answers
  most TLDs in ~50ms; RDAP is only a fallback when DNS is inconclusive.

## AI naming mode (Mistral + agentic tool use)

Switch to **✨ suggest names**, describe your project, and the agent invents brandable names — then
*proves* each one is free before showing it:

1. **mistral-medium** brainstorms candidates.
2. It calls a `check_names` **tool** (the same availability engine the MCP server exposes) to verify
   `.com`/`.io`/`.ai`, GitHub, npm, X and YouTube — and iterates, dropping taken names.
3. The server **re-verifies** the final picks itself (ground truth, never the model's word) and scores
   them, so what you see is real availability.

Each run costs **1 credit**; new visitors get a few free. Enable it with a key:

```bash
MISTRAL_API_KEY=... pnpm dev        # MISTRAL_MODEL overrides the model (default mistral-medium-latest)
```

Credits are an in-memory ledger keyed by an http-only cookie (`server/utils/credits.ts`) — swap the Map
for a DB and wire `STRIPE_SECRET_KEY` in `server/api/credits/buy.post.ts` for real payments. Endpoints:
`GET /api/credits`, `POST /api/credits/buy`, `POST /api/suggest`.

## Avoiding rate limits (changing IP / location)

Some platforms throttle by IP. Two levers:

1. **GitHub** — set `GITHUB_TOKEN` to go from ~60/hr to 5,000/hr (the one check that needs a key).
2. **Everything else** — route outbound checks through a proxy in another region by setting `SCAN_PROXY`:

   ```bash
   SCAN_PROXY="http://user:pass@gate.example-proxy.com:7000" pnpm dev
   ```

   Every platform request then exits from the proxy's IP instead of your server's. Point it at a
   rotating/residential proxy (Bright Data, Smartproxy, Oxylabs, etc.) to spread requests across many
   IPs/locations. The cache further reduces how often you call out at all.

## Public API & MCP

The HTTP API is public (CORS enabled) — call it from anywhere:

```bash
curl -N "http://localhost:3000/api/scan?name=acme"      # streaming NDJSON, all platforms
curl "http://localhost:3000/api/check/npm?name=acme"     # single platform
```

An **MCP server** (`mcp/server.mjs`) exposes the checker as tools (`check_name`, `check_platform`) for
Claude and other MCP clients. It calls the HTTP API, so run the app first (or set `VACORA_URL` to a
deployed origin):

```bash
# Claude Code
claude mcp add vacora -- node "$(pwd)/mcp/server.mjs"
```
```jsonc
// Claude Desktop — claude_desktop_config.json
{ "mcpServers": { "vacora": { "command": "node", "args": ["/abs/path/mcp/server.mjs"] } } }
```

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Production: `pnpm build && pnpm preview`.

### Optional: raise the GitHub rate limit

Unauthenticated GitHub checks are limited to ~60/hour per IP. Set a token to lift it:

```bash
export GITHUB_TOKEN=ghp_xxx && pnpm dev
```

## Layout

- `shared/platforms.ts` — `BRAND`, the 100 platform definitions (with favicons + scoring weights), shared by client and server.
- `server/utils/checkers.ts` — one checker per platform; domains handled generically by TLD.
- `server/api/scan.get.ts` — the streaming NDJSON endpoint. `server/api/check/[id].get.ts` — single ad-hoc check.
- `app/composables/useNameCheck.ts` — reads the stream, updates results live, computes the score.
- `app/app.vue` + `app/components/ResultChip.vue` — the UI: sticky verdict, available-only filter, `?q=` deep links, `/` to focus search.

> Availability is a strong signal, not legal trademark advice.
