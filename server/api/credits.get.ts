import { session, balanceOf, FREE_CREDITS, PACKS } from '~~/server/utils/credits'
import { mistralConfigured } from '~~/server/utils/mistral'

export default defineEventHandler((event) => {
  const sid = session(event)
  return {
    balance: balanceOf(sid),
    free: FREE_CREDITS,
    packs: PACKS,
    aiEnabled: mistralConfigured(),
  }
})
