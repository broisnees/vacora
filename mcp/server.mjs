#!/usr/bin/env node
// MCP server for the name-availability checker.
//
// Exposes the checker as MCP tools so Claude (Desktop / Code) or any MCP client
// can check name availability. It talks to the running app's public HTTP API,
// so it stays decoupled from the Nuxt internals and works against local or
// deployed instances.
//
// Usage (after `pnpm dev` is running, or set VACORA_URL to a deployed origin):
//   node mcp/server.mjs
//
// Claude Code:  claude mcp add vacora -- node /abs/path/mcp/server.mjs
// Claude Desktop config:
//   { "mcpServers": { "vacora": { "command": "node", "args": ["/abs/path/mcp/server.mjs"] } } }

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const BASE = (process.env.VACORA_URL || 'http://localhost:3000').replace(/\/$/, '')

async function scan(name) {
  const res = await fetch(`${BASE}/api/scan?name=${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`scan failed: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
}

function summarize(name, results) {
  const avail = results.filter((r) => r.available === true)
  const taken = results.filter((r) => r.available === false)
  const unknown = results.filter((r) => r.available === null)
  const lines = [
    `Name "${name}" — available on ${avail.length}/${results.length - unknown.length} checked platforms`,
    ``,
    `AVAILABLE (${avail.length}): ${avail.map((r) => r.id).join(', ') || '—'}`,
    `TAKEN (${taken.length}): ${taken.map((r) => r.id).join(', ') || '—'}`,
  ]
  if (unknown.length) lines.push(`UNKNOWN (${unknown.length}): ${unknown.map((r) => r.id).join(', ')}`)
  return lines.join('\n')
}

const server = new McpServer({ name: 'vacora', version: '1.0.0' })

server.tool(
  'check_name',
  'Check whether a brand/product name is available across 100+ platforms (domains, package registries, code hosts, social, creator, email MX). Returns a per-platform breakdown.',
  { name: z.string().describe('the brand/product name to check (letters, numbers, - _ .)') },
  async ({ name }) => {
    const results = await scan(name)
    const summary = summarize(name, results)
    return {
      content: [
        { type: 'text', text: summary },
        { type: 'text', text: JSON.stringify(results, null, 2) },
      ],
    }
  },
)

server.tool(
  'check_platform',
  'Check a name on a single platform by id (e.g. "npm", "github", "domain-com", "x", "mx-com").',
  {
    name: z.string().describe('the name to check'),
    platform: z.string().describe('platform id, e.g. npm, github, domain-com, x, mx-com'),
  },
  async ({ name, platform }) => {
    const res = await fetch(`${BASE}/api/check/${encodeURIComponent(platform)}?name=${encodeURIComponent(name)}`)
    const body = await res.json()
    return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }] }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error(`vacora MCP server ready (api: ${BASE})`)
