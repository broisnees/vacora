import { PLATFORMS } from '~~/shared/platforms'
import { runCheckerCached, quickCheck, quickScore, mapPool, validateName, hasChecker, QUICK_IDS } from '~~/server/utils/checkers'

// Streamable-HTTP MCP endpoint (served at /mcp) so URL-based MCP clients
// (Cursor, Claude, etc.) can use the checker as tools. Stateless JSON-RPC:
// each POST gets a single JSON response. The stdio server (mcp/server.mjs)
// remains for stdio clients.

const SERVER_INFO = { name: 'vacora', version: '1.0.0' }
const DEFAULT_PROTOCOL = '2025-06-18'

const TOOLS = [
  {
    name: 'check_name',
    description:
      'Check a brand/product name across all ~100 platforms (domains, package registries, code hosts, social, creator, email MX). Returns availability counts and the available platforms.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'the name to check (letters, numbers, - _ .)' } },
      required: ['name'],
    },
  },
  {
    name: 'quick_check',
    description: 'Fast availability check on the key platforms only: .com/.io/.ai domains, GitHub, npm, X, YouTube. Use for rapid name screening.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'the name to check' } },
      required: ['name'],
    },
  },
  {
    name: 'check_platform',
    description: 'Check a name on a single platform by id (e.g. "npm", "github", "domain-com", "x", "mx-com").',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'the name to check' },
        platform: { type: 'string', description: 'platform id, e.g. npm, github, domain-com' },
      },
      required: ['name', 'platform'],
    },
  },
]

function textResult(text: string, isError = false) {
  return { content: [{ type: 'text', text }], isError }
}

async function callTool(toolName: string, args: any) {
  const name = String(args?.name ?? '').trim().toLowerCase()
  const invalid = validateName(name)
  if (invalid) return textResult(`Invalid name: ${invalid}`, true)

  if (toolName === 'check_platform') {
    const platform = String(args?.platform ?? '')
    if (!hasChecker(platform)) return textResult(`Unknown platform: ${platform}`, true)
    const r = await runCheckerCached(platform, name)
    return textResult(JSON.stringify({ platform, ...r }, null, 2))
  }

  if (toolName === 'quick_check') {
    const avail = await quickCheck(name)
    const free = Object.entries(avail).filter(([, v]) => v === true).map(([k]) => k)
    const taken = Object.entries(avail).filter(([, v]) => v === false).map(([k]) => k)
    return textResult(
      `"${name}" quick check (score ${quickScore(avail)}/100)\nAVAILABLE: ${free.join(', ') || '—'}\nTAKEN: ${taken.join(', ') || '—'}\n\n${JSON.stringify(avail, null, 2)}`,
    )
  }

  // check_name — full sweep
  const results = await mapPool(PLATFORMS, 12, async (p) => ({ id: p.id, ...(await runCheckerCached(p.id, name)) }))
  const avail = results.filter((r) => r.available === true)
  const taken = results.filter((r) => r.available === false)
  const unknown = results.filter((r) => r.available === null)
  const summary =
    `Name "${name}" — available on ${avail.length}/${results.length - unknown.length} platforms checked\n\n` +
    `AVAILABLE (${avail.length}): ${avail.map((r) => r.id).join(', ') || '—'}\n` +
    `TAKEN (${taken.length}): ${taken.map((r) => r.id).join(', ') || '—'}` +
    (unknown.length ? `\nUNKNOWN (${unknown.length}): ${unknown.map((r) => r.id).join(', ')}` : '')
  return textResult(summary)
}

async function handle(msg: any) {
  const { id, method, params } = msg ?? {}
  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: params?.protocolVersion || DEFAULT_PROTOCOL,
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
          },
        }
      case 'ping':
        return { jsonrpc: '2.0', id, result: {} }
      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: TOOLS } }
      case 'tools/call': {
        const result = await callTool(params?.name, params?.arguments ?? {})
        return { jsonrpc: '2.0', id, result }
      }
      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } }
    }
  } catch (e: any) {
    return { jsonrpc: '2.0', id, error: { code: -32603, message: e?.message || 'internal error' } }
  }
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'access-control-allow-origin', '*')
  setResponseHeader(event, 'access-control-allow-headers', 'content-type, mcp-session-id, mcp-protocol-version, authorization')
  setResponseHeader(event, 'access-control-allow-methods', 'GET, POST, OPTIONS')

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }

  // GET opens a server→client SSE stream; this stateless server has nothing to
  // push, so return an empty event stream (keeps clients that probe GET happy).
  if (event.method === 'GET') {
    setResponseHeader(event, 'content-type', 'text/event-stream')
    setResponseHeader(event, 'cache-control', 'no-cache, no-transform')
    return ''
  }

  const body = await readBody(event).catch(() => null)
  if (!body) {
    setResponseStatus(event, 400)
    return { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }
  }

  const batch = Array.isArray(body)
  const messages = batch ? body : [body]
  const responses: any[] = []
  for (const m of messages) {
    // notifications (no id) get no response
    if (m && m.method && m.id === undefined) continue
    responses.push(await handle(m))
  }

  setResponseHeader(event, 'content-type', 'application/json')
  if (!responses.length) {
    setResponseStatus(event, 202)
    return ''
  }
  return batch ? responses : responses[0]
})
