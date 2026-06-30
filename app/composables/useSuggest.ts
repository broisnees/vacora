export interface Suggestion {
  name: string
  rationale: string
  available: Record<string, boolean | null>
  score: number
}

export function useSuggest() {
  const suggestions = ref<Suggestion[]>([])
  const loading = ref(false)
  const error = ref('')
  const phase = ref('') // live status label from the streaming agent
  const phaseNames = ref<string[]>([]) // candidates currently being checked

  async function generate(idea: string, count: number, vibe: string): Promise<number | null> {
    loading.value = true
    error.value = ''
    suggestions.value = []
    phase.value = 'starting'
    phaseNames.value = []
    let balance: number | null = null

    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idea, count, vibe }),
      })

      // Non-streamed errors (no credits / not configured / bad input)
      if (!res.ok || !res.body) {
        let msg = 'generation failed'
        try {
          const j = await res.json()
          msg = j?.statusMessage || j?.message || msg
        } catch {}
        const err: any = new Error(msg)
        err.statusCode = res.status
        throw err
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (!line) continue
          let ev: any
          try {
            ev = JSON.parse(line)
          } catch {
            continue
          }
          if (ev.t === 'phase') {
            phase.value = ev.label || ''
            phaseNames.value = Array.isArray(ev.names) ? ev.names : []
          } else if (ev.t === 'done') {
            suggestions.value = ev.suggestions || []
            balance = typeof ev.balance === 'number' ? ev.balance : null
            phase.value = ''
          } else if (ev.t === 'error') {
            throw new Error(ev.message || 'generation failed')
          }
        }
      }
      return balance
    } catch (e: any) {
      error.value = e?.message || 'generation failed'
      throw e
    } finally {
      loading.value = false
      phase.value = ''
      phaseNames.value = []
    }
  }

  function reset() {
    suggestions.value = []
    error.value = ''
    phase.value = ''
    phaseNames.value = []
  }

  return { suggestions, loading, error, phase, phaseNames, generate, reset }
}
