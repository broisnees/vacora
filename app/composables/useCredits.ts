export interface Pack {
  credits: number
  price: string
}

export function useCredits() {
  const balance = ref<number | null>(null)
  const free = ref(3)
  const packs = ref<Record<string, Pack>>({})
  const aiEnabled = ref(false)

  async function refresh() {
    try {
      const d = await $fetch<{ balance: number; free: number; packs: Record<string, Pack>; aiEnabled: boolean }>(
        '/api/credits',
      )
      balance.value = d.balance
      free.value = d.free
      packs.value = d.packs
      aiEnabled.value = d.aiEnabled
    } catch {}
  }

  async function buy(pack: string) {
    const d = await $fetch<{ balance: number }>('/api/credits/buy', { method: 'POST', body: { pack } })
    balance.value = d.balance
    return d.balance
  }

  function setBalance(n: number) {
    balance.value = n
  }

  return { balance, free, packs, aiEnabled, refresh, buy, setBalance }
}
