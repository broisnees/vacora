// Route all outbound checks through a proxy when SCAN_PROXY is set.
// This is how you "change location / device" to avoid per-IP rate limits:
// point it at a residential or rotating proxy in another region, e.g.
//   SCAN_PROXY="http://user:pass@gate.smartproxy.com:7000" pnpm dev
// Every platform request then exits from the proxy's IP, not your server's.
export default defineNitroPlugin(async () => {
  const proxy = process.env.SCAN_PROXY
  if (!proxy) return
  try {
    const { setGlobalDispatcher, ProxyAgent } = await import('undici')
    setGlobalDispatcher(new ProxyAgent(proxy))
    console.log(`[scan] outbound checks routed through proxy: ${proxy.replace(/\/\/[^@]*@/, '//***@')}`)
  } catch (e) {
    console.warn('[scan] failed to set proxy dispatcher:', e)
  }
})
