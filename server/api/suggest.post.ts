import { mistralChat, mistralConfigured, type MistralMessage } from '~~/server/utils/mistral'
import { quickCheck, quickScore, mapPool, QUICK_IDS, validateName } from '~~/server/utils/checkers'
import { session, balanceOf, spend } from '~~/server/utils/credits'

interface SuggestBody {
  idea?: string
  count?: number
  vibe?: string
}

const COST = 1

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'check_names',
      description:
        'Check whether candidate names are available on key platforms: .com/.io/.ai domains, GitHub, npm, X, YouTube. Call this (batches up to 12) to verify ideas BEFORE finalizing. Returns per name: true=available / false=taken / null=unknown.',
      parameters: {
        type: 'object',
        properties: {
          names: {
            type: 'array',
            items: { type: 'string' },
            description: 'lowercase candidate names, 2–30 chars, only letters/numbers/hyphen',
          },
        },
        required: ['names'],
      },
    },
  },
]

/** Mistral message content may be a string, null, or an array of parts. */
function asText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((c: any) => (typeof c === 'string' ? c : c?.text ?? '')).join('')
  return content == null ? '' : String(content)
}

function sanitize(raw: unknown): string | null {
  const n = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '')
  return validateName(n) ? null : n
}

async function runCheckTool(names: unknown): Promise<Record<string, Record<string, boolean | null>>> {
  const list = Array.isArray(names) ? names : []
  const valid = [...new Set(list.map(sanitize).filter((n): n is string => !!n))].slice(0, 12)
  const results = await mapPool(valid, 3, async (n) => [n, await quickCheck(n)] as const)
  return Object.fromEntries(results)
}

function parseSuggestions(content: unknown): { name: string; rationale?: string }[] {
  let txt = asText(content).trim()
  if (!txt) return []
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) txt = fence[1]!.trim()
  const brace = txt.indexOf('{')
  const arr = txt.indexOf('[')
  const start = brace < 0 ? arr : arr < 0 ? brace : Math.min(brace, arr)
  if (start > 0) txt = txt.slice(start)
  try {
    const parsed = JSON.parse(txt)
    const list = Array.isArray(parsed) ? parsed : parsed.suggestions || parsed.names || []
    return list
      .map((s: any) => (typeof s === 'string' ? { name: s } : { name: s?.name, rationale: s?.rationale || s?.reason }))
      .filter((s: any) => s.name)
  } catch {
    return []
  }
}

export default defineEventHandler(async (event) => {
  if (!mistralConfigured()) throw createError({ statusCode: 503, statusMessage: 'AI naming is not configured — set MISTRAL_API_KEY' })

  const sid = session(event)
  if (balanceOf(sid) < COST) throw createError({ statusCode: 402, statusMessage: 'Out of credits — buy more to keep generating' })

  const body = await readBody<SuggestBody>(event)
  const idea = (body?.idea ?? '').trim()
  if (idea.length < 8) throw createError({ statusCode: 400, statusMessage: 'Describe the project in a bit more detail' })
  const count = Math.min(Math.max(body?.count ?? 6, 3), 10)
  const vibe = (body?.vibe ?? '').trim().slice(0, 120)

  setResponseHeader(event, 'content-type', 'application/x-ndjson; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'no-cache, no-transform')
  setResponseHeader(event, 'x-accel-buffering', 'no')

  const system =
    `You are a world-class brand-naming consultant. Invent short, memorable, brandable names ` +
    `(4–12 letters, easy to say and spell) for the user's project. Avoid existing major brands. ` +
    `You MUST verify candidates with the check_names tool and strongly prefer names that are AVAILABLE ` +
    `(especially .com, GitHub and npm). Iterate: brainstorm ~10–14 candidates, check them, drop taken ones. ` +
    `When done, reply with ONLY a JSON object: ` +
    `{"suggestions":[{"name":"lowercasename","rationale":"one short sentence why it fits"}]} ` +
    `with the ${count} best names, ordered best first.`

  const messages: MistralMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: `Project idea: ${idea}${vibe ? `\nDesired vibe: ${vibe}` : ''}\n\nGive me ${count} great names.` },
  ]

  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      const emit = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
        } catch {}
      }

      ;(async () => {
        try {
          emit({ t: 'phase', label: 'brainstorming names' })

          let finalContent: unknown = ''
          for (let round = 0; round < 4; round++) {
            const lastRound = round === 3
            const resp = await mistralChat({ messages, tools: TOOLS, tool_choice: lastRound ? 'none' : 'auto' })
            const msg = resp?.choices?.[0]?.message
            if (!msg) break
            messages.push({ role: 'assistant', content: asText(msg.content), tool_calls: msg.tool_calls })

            if (msg.tool_calls?.length && !lastRound) {
              const checking: string[] = []
              for (const tc of msg.tool_calls) {
                let args: any = {}
                try {
                  args = JSON.parse(tc.function?.arguments || '{}')
                } catch {}
                if (Array.isArray(args.names)) checking.push(...args.names.map((x: any) => String(x)))
              }
              emit({ t: 'phase', label: 'checking availability', names: checking.slice(0, 14) })
              for (const tc of msg.tool_calls) {
                let args: any = {}
                try {
                  args = JSON.parse(tc.function?.arguments || '{}')
                } catch {}
                const toolResult = await runCheckTool(args.names)
                messages.push({ role: 'tool', tool_call_id: tc.id, name: 'check_names', content: JSON.stringify(toolResult) })
              }
              emit({ t: 'phase', label: 'refining shortlist' })
              continue
            }
            finalContent = msg.content
            break
          }

          if (!parseSuggestions(finalContent).length) {
            emit({ t: 'phase', label: 'finalizing picks' })
            const resp = await mistralChat({
              messages: [...messages, { role: 'user', content: 'Reply now with ONLY the JSON object of the best names.' }],
              response_format: { type: 'json_object' },
            })
            finalContent = resp?.choices?.[0]?.message?.content ?? finalContent
          }

          let picks = parseSuggestions(finalContent)
            .map((s) => ({ name: sanitize(s.name)!, rationale: s.rationale }))
            .filter((s) => s.name)
          picks = picks.filter((s, i) => picks.findIndex((p) => p.name === s.name) === i).slice(0, count)

          if (!picks.length) {
            emit({ t: 'error', message: 'The model returned no usable names — try again' })
            controller.close()
            return
          }

          emit({ t: 'phase', label: 'verifying availability', names: picks.map((p) => p.name) })
          const suggestions = await mapPool(picks, 3, async (s) => {
            const available = await quickCheck(s.name)
            return { name: s.name, rationale: s.rationale ?? '', available, score: quickScore(available) }
          })
          suggestions.sort((a, b) => b.score - a.score)

          spend(sid, COST) // charge only on success
          emit({ t: 'done', suggestions, balance: balanceOf(sid), checked: QUICK_IDS })
        } catch (e: any) {
          emit({ t: 'error', message: e?.statusMessage || e?.message || 'generation failed' })
        } finally {
          try {
            controller.close()
          } catch {}
        }
      })()
    },
  })
})
