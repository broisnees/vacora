import { session, grant, balanceOf, PACKS } from '~~/server/utils/credits'

// Buy a credit pack. With STRIPE_SECRET_KEY set you'd create a Checkout Session
// and grant credits from the webhook; without it we grant immediately (demo mode)
// so the flow is usable out of the box.
export default defineEventHandler(async (event) => {
  const sid = session(event)
  const body = await readBody<{ pack?: string }>(event)
  const pack = PACKS[body?.pack ?? '']
  if (!pack) throw createError({ statusCode: 400, statusMessage: 'unknown pack' })

  if (process.env.STRIPE_SECRET_KEY) {
    // Production path (not wired in demo): return a Stripe Checkout URL instead
    // of granting, and grant on the webhook after payment succeeds.
    throw createError({ statusCode: 501, statusMessage: 'Stripe checkout not configured in this build' })
  }

  const balance = grant(sid, pack.credits)
  return { balance, granted: pack.credits, demo: true }
})
