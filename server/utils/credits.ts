import type { H3Event } from 'h3'

// Simple credit ledger keyed by an http-only session cookie. In-memory for now
// (resets on restart) — swap the Map for a DB/KV in production. New visitors get
// FREE_CREDITS to try the AI naming before they need to buy more.
export const FREE_CREDITS = 3

export const PACKS: Record<string, { credits: number; price: string; amountCents: number }> = {
  starter: { credits: 10, price: '$5', amountCents: 500 },
  pro: { credits: 50, price: '$20', amountCents: 2000 },
  studio: { credits: 150, price: '$50', amountCents: 5000 },
}

const balances = new Map<string, number>()

function newId(): string {
  // server-side only — Math.random is fine here
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

export function session(event: H3Event): string {
  let sid = getCookie(event, 'vacora_sid')
  if (!sid) {
    sid = newId()
    setCookie(event, 'vacora_sid', sid, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    })
  }
  if (!balances.has(sid)) balances.set(sid, FREE_CREDITS)
  return sid
}

export function balanceOf(sid: string): number {
  return balances.get(sid) ?? 0
}

export function spend(sid: string, n = 1): boolean {
  const b = balanceOf(sid)
  if (b < n) return false
  balances.set(sid, b - n)
  return true
}

export function grant(sid: string, n: number): number {
  const b = balanceOf(sid) + n
  balances.set(sid, b)
  return b
}
