import type { Balance, BalancesContext, Contract } from '@lib/adapter'
import { groupBy } from '@lib/array'
import { abi as erc20Abi } from '@lib/erc20'
import { multicall } from '@lib/multicall'
import { parseEther } from 'viem'

import type { ProviderBalancesParams } from './provider'
import { auraProvider, convexProvider, sushiProvider } from './provider'

const abi = {
  getPricePerFullShare: {
    inputs: [],
    name: 'getPricePerFullShare',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
} as const

export async function getBadgerBalances(ctx: BalancesContext, pools: Contract[]): Promise<Balance[]> {
  const balances: Balance[] = []

  const [balanceOfsRes, rateOfsRes] = await Promise.all([
    multicall({
      ctx,
      calls: pools.map((pool) => ({ target: pool.address, params: [ctx.address] } as const)),
      abi: erc20Abi.balanceOf,
    }),
    multicall({ ctx, calls: pools.map((pool) => ({ target: pool.address })), abi: abi.getPricePerFullShare }),
  ])

  for (let poolIdx = 0; poolIdx < pools.length; poolIdx++) {
    const pool = pools[poolIdx]
    const balanceOfRes = balanceOfsRes[poolIdx]
    const rateOfRes = rateOfsRes[poolIdx]

    if (!balanceOfRes.success || balanceOfRes.output === 0n || !rateOfRes.success) {
      continue
    }

    balances.push({
      ...pool,
      amount: (balanceOfRes.output * rateOfRes.output) / parseEther('1.0'),
      underlyings: pool.underlyings as Contract[],
      rewards: undefined,
      category: 'farm',
    })
  }

  return getUnderlyingsBadgerBalances(ctx, balances)
}

type Provider = (ctx: BalancesContext, pools: ProviderBalancesParams[]) => Promise<ProviderBalancesParams[]>

const providers: Record<string, Provider | undefined> = {
  Aura: auraProvider,
  Convex: convexProvider,
  Curve: convexProvider,
  Sushiswap: sushiProvider,
  Swapr: sushiProvider,
  Solidex: sushiProvider,
  Quickswap: sushiProvider,
}

const getUnderlyingsBadgerBalances = async (ctx: BalancesContext, pools: Contract[]): Promise<Balance[]> => {
  // add totalSupply, required to get formatted underlyings balances
  const totalSuppliesRes = await multicall({
    ctx,
    calls: pools.map((pool) => ({ target: pool.lpToken })),
    abi: erc20Abi.totalSupply,
  })

  for (let poolIdx = 0; poolIdx < pools.length; poolIdx++) {
    const totalSupplyRes = totalSuppliesRes[poolIdx]
    if (totalSupplyRes.success) {
      pools[poolIdx].totalSupply = totalSupplyRes.output
    }
  }

  // resolve underlyings
  const poolsByProvider = groupBy(pools, 'provider')

  return (
    await Promise.all(
      Object.keys(poolsByProvider).map((providerId) => {
        const providerFn = providers[providerId]
        if (!providerFn) {
          return poolsByProvider[providerId] as Balance[]
        }

        return providerFn(ctx, poolsByProvider[providerId] as ProviderBalancesParams[])
      }),
    )
  ).flat()
}
