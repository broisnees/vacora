// Thin wrapper over the Mistral chat-completions REST API (no SDK dependency).
// Set MISTRAL_API_KEY to enable AI naming; MISTRAL_MODEL overrides the model.

const ENDPOINT = 'https://api.mistral.ai/v1/chat/completions'

export interface MistralToolCall {
  id: string
  function: { name: string; arguments: string }
}
export interface MistralMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: MistralToolCall[]
  tool_call_id?: string
  name?: string
}

export interface MistralChatBody {
  messages: MistralMessage[]
  tools?: unknown[]
  tool_choice?: 'auto' | 'any' | 'none'
  response_format?: { type: 'json_object' }
  temperature?: number
  max_tokens?: number
}

export function mistralConfigured(): boolean {
  return !!process.env.MISTRAL_API_KEY
}

export async function mistralChat(body: MistralChatBody): Promise<any> {
  const key = process.env.MISTRAL_API_KEY
  if (!key) {
    throw createError({ statusCode: 503, statusMessage: 'AI naming is not configured — set MISTRAL_API_KEY' })
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 45_000)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ model: process.env.MISTRAL_MODEL || 'mistral-medium-latest', temperature: 0.75, ...body }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300)
      throw createError({ statusCode: 502, statusMessage: `Mistral error ${res.status}: ${detail}` })
    }
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}
