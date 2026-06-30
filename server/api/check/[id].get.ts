import { runChecker, hasChecker, validateName } from '~~/server/utils/checkers'
import type { CheckResult } from '~~/shared/platforms'

// Single-platform check (used for ad-hoc lookups / testing).
export default defineEventHandler(async (event): Promise<CheckResult> => {
  const id = getRouterParam(event, 'id') ?? ''
  const { name } = getQuery(event) as { name?: string }
  const candidate = (name ?? '').trim().toLowerCase()

  const invalid = validateName(candidate)
  if (invalid) throw createError({ statusCode: 400, statusMessage: invalid })
  if (!hasChecker(id)) throw createError({ statusCode: 404, statusMessage: `Unknown platform: ${id}` })

  try {
    return { id, ...(await runChecker(id, candidate)) }
  } catch {
    return { id, available: null, note: 'Check timed out or failed' }
  }
})
