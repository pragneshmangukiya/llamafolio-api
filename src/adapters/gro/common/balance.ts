import type { Balance, BalancesContext, Contract } from '@lib/adapter'
import { groupBy } from '@lib/array'
import { abi as erc20Abi } from '@lib/erc20'
import { multicall } from '@lib/multicall'

import { getBalancerProviderBalances } from './providers/balancerProvider'
import { getGroProviderBalances } from './providers/groProvider'
import { getSushiProviderBalances } from './providers/sushiProvider'

const abi = {
  userInfo: {
    inputs: [
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'address', name: '', type: 'address' },
    ],
    name: 'userInfo',
    outputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'int256', name: 'rewardDebt', type: 'int256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  claimable: {
    inputs: [
      { internalType: 'uint256', name: '_pid', type: 'uint256' },
      { internalType: 'address', name: '_user', type: 'address' },
    ],
    name: 'claimable',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  getPricePerShare: {
    inputs: [],
    name: 'getPricePerShare',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
} as const

export async function getGroBalances(
  ctx: BalancesContext,
  contracts: Contract[],
  masterchef: Contract,
): Promise<Balance[]> {
  const balances: Balance[] = []

  const [userInfosBalancesRes, claimableBalancesRes] = await Promise.all([
    multicall({
      ctx,
      calls: contracts.map(
        (contract) => ({ target: masterchef.address, params: [BigInt(contract.pid), ctx.address] } as const),
      ),
      abi: abi.userInfo,
    }),
    multicall({
      ctx,
      calls: contracts.map(
        (contract) => ({ target: masterchef.address, params: [BigInt(contract.pid), ctx.address] } as const),
      ),
      abi: abi.claimable,
    }),
  ])

  for (let poolIdx = 0; poolIdx < contracts.length; poolIdx++) {
    const contract = contracts[poolIdx]
    const underlyings = contract.underlyings as Contract[]
    const reward = contract.rewards?.[0] as Contract
    const userInfosBalanceRes = userInfosBalancesRes[poolIdx]
    const claimableBalanceRes = claimableBalancesRes[poolIdx]

    if (!userInfosBalanceRes.success || !claimableBalanceRes.success) {
      continue
    }

    const [amount, _rewardDebt] = userInfosBalanceRes.output

    balances.push({
      ...contract,
      amount: amount,
      underlyings,
      rewards: [{ ...reward, amount: claimableBalanceRes.output }],
      category: 'farm',
    })
  }

  return (await getUnderlyingsBalances(ctx, balances)).map((res) => ({ ...res, category: 'farm' }))
}

type Provider = (ctx: BalancesContext, pools: Balance[]) => Promise<Balance[]>

const providers: Record<string, Provider | undefined> = {
  0: getGroProviderBalances,
  1: getSushiProviderBalances,
  2: getSushiProviderBalances,
  3: getGroProviderBalances,
  4: getGroProviderBalances,
  5: getBalancerProviderBalances,
  6: getGroProviderBalances,
}

const getUnderlyingsBalances = async (ctx: BalancesContext, balances: Balance[]): Promise<Balance[]> => {
  // resolve underlyings
  const poolsByPid = groupBy(balances as Contract[], 'pid')

  return (
    await Promise.all(
      Object.keys(poolsByPid).map((pid) => {
        const providerFn = providers[pid]
        if (!providerFn) {
          return poolsByPid[pid] as Balance[]
        }

        return providerFn(ctx, poolsByPid[pid] as Balance[])
      }),
    )
  ).flat()
}

export async function getYieldBalances(ctx: BalancesContext, pools: Contract[]): Promise<Balance[]> {
  const balances: Balance[] = []

  const [balancesOfRes, pricePerSharesRes] = await Promise.all([
    multicall({
      ctx,
      calls: pools.map((pool) => ({ target: pool.address, params: [ctx.address] } as const)),
      abi: erc20Abi.balanceOf,
    }),
    multicall({ ctx, calls: pools.map((pool) => ({ target: pool.address })), abi: abi.getPricePerShare }),
  ])

  for (let poolIdx = 0; poolIdx < pools.length; poolIdx++) {
    const pool = pools[poolIdx]
    const balanceOfRes = balancesOfRes[poolIdx]
    const pricePerShareRes = pricePerSharesRes[poolIdx]

    if (!balanceOfRes.success || !pricePerShareRes.success) {
      continue
    }

    balances.push({
      ...pool,
      amount: (balanceOfRes.output * pricePerShareRes.output) / 10n ** BigInt(pool.decimals || 0),
      underlyings: pool.underlyings as Contract[],
      rewards: undefined,
      category: 'farm',
    })
  }

  return balances
}
