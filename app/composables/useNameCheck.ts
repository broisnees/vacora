import { PLATFORMS, type CheckResult, type PlatformMeta } from '~~/shared/platforms'

export interface Score {
  value: number
  grade: string
  verdict: string
  available: number
  total: number
}

const GRADES: { min: number; grade: string; verdict: string }[] = [
  { min: 90, grade: 'A+', verdict: 'pristine — grab it now' },
  { min: 78, grade: 'A', verdict: 'strong, brandable pick' },
  { min: 62, grade: 'B', verdict: 'good, a few clashes' },
  { min: 45, grade: 'C', verdict: 'workable but crowded' },
  { min: 25, grade: 'D', verdict: 'heavily contested' },
  { min: 0, grade: 'F', verdict: 'taken almost everywhere' },
]

// Weighted brandability score over a set of platforms that returned a
// definite answer. Pure — depends only on its inputs (settings-aware).
export function computeScore(results: Record<string, CheckResult | undefined>, platforms: PlatformMeta[]): Score {
  let availW = 0
  let totalW = 0
  let available = 0
  let total = 0
  for (const p of platforms) {
    const r = results[p.id]
    if (!r || r.available === null) continue
    total++
    totalW += p.weight
    if (r.available) {
      available++
      availW += p.weight
    }
  }
  const value = totalW === 0 ? 0 : Math.round((availW / totalW) * 100)
  const band = GRADES.find((g) => value >= g.min)!
  return { value, grade: band.grade, verdict: band.verdict, available, total }
}

export function useNameCheck() {
  const results = reactive<Record<string, CheckResult | undefined>>({})
  const scanning = ref(false)
  const name = ref('')
  const doneCount = ref(0)
  const scanned = ref<PlatformMeta[]>(PLATFORMS)

  function reset() {
    for (const p of PLATFORMS) results[p.id] = undefined
    name.value = ''
    doneCount.value = 0
    scanning.value = false
  }

  async function run(raw: string, platforms: PlatformMeta[]) {
    const candidate = raw.trim().toLowerCase()
    name.value = candidate
    scanned.value = platforms
    scanning.value = true
    doneCount.value = 0
    for (const p of PLATFORMS) results[p.id] = undefined

    const cats = [...new Set(platforms.map((p) => p.category))].join(',')

    try {
      const res = await fetch(`/api/scan?name=${encodeURIComponent(candidate)}&cats=${cats}`)
      if (!res.ok || !res.body) throw new Error('scan failed')
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
          try {
            const r = JSON.parse(line) as CheckResult
            results[r.id] = r
            doneCount.value++
          } catch {}
        }
      }
    } catch {
      for (const p of platforms) if (!results[p.id]) results[p.id] = { id: p.id, available: null, note: 'failed' }
    } finally {
      scanning.value = false
    }
  }

  return { results, scanning, name, doneCount, scanned, run, reset }
}
