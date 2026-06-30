import { PLATFORMS } from '~~/shared/platforms'
import { runCheckerCached, validateName } from '~~/server/utils/checkers'

// Cap on simultaneous outbound checks. Firing all ~100 at once overwhelms the
// DNS resolver (and downstream RDAP), causing timeouts/"check failed"; a pool
// keeps every check reliable while results still stream in progressively.
const CONCURRENCY = 12

export default defineEventHandler((event) => {
  const { name, cats } = getQuery(event) as { name?: string; cats?: string }
  const candidate = (name ?? '').trim().toLowerCase()

  const invalid = validateName(candidate)
  if (invalid) throw createError({ statusCode: 400, statusMessage: invalid })

  setResponseHeader(event, 'content-type', 'application/x-ndjson; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'no-cache, no-transform')
  setResponseHeader(event, 'x-accel-buffering', 'no')

  // Only scan the categories the client asked for — skipping disabled ones
  // keeps the scan fast and avoids needless outbound requests.
  const wanted = (cats ?? '').split(',').map((c) => c.trim()).filter(Boolean)
  const encoder = new TextEncoder()
  const queue = wanted.length ? PLATFORMS.filter((p) => wanted.includes(p.category)) : [...PLATFORMS]

  return new ReadableStream({
    start(controller) {
      let index = 0
      let active = 0
      let closed = false

      const emit = (obj: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
        } catch {
          closed = true
        }
      }

      const maybeClose = () => {
        if (!closed && index >= queue.length && active === 0) {
          closed = true
          try {
            controller.close()
          } catch {}
        }
      }

      const pump = () => {
        while (active < CONCURRENCY && index < queue.length) {
          const p = queue[index++]!
          active++
          runCheckerCached(p.id, candidate)
            .then((res) => emit({ id: p.id, ...res }))
            .catch(() => emit({ id: p.id, available: null, note: 'check failed' }))
            .finally(() => {
              active--
              pump()
              maybeClose()
            })
        }
        maybeClose()
      }

      pump()
    },
  })
})
