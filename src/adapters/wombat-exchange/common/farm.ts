import type { Balance, BalancesContext, Contract } from '@lib/adapter'
import { mapSuccessFilter } from '@lib/array'
import { multicall } from '@lib/multicall'
import { parseEther } from 'viem'

const abi = {
  getAssetPid: {
    inputs: [{ internalType: 'address', name: 'asset', type: 'address' }],
    name: 'getAssetPid',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  userInfo: {
    inputs: [
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'address', name: '', type: 'address' },
    ],
    name: 'userInfo',
    outputs: [
      { internalType: 'uint128', name: 'amount', type: 'uint128' },
      { internalType: 'uint128', name: 'factor', type: 'uint128' },
      { internalType: 'uint128', name: 'rewardDebt', type: 'uint128' },
      { internalType: 'uint128', name: 'pendingWom', type: 'uint128' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  pendingTokens: {
    inputs: [
      { internalType: 'uint256', name: '_pid', type: 'uint256' },
      { internalType: 'address', name: '_user', type: 'address' },
    ],
    name: 'pendingTokens',
    outputs: [
      { internalType: 'uint256', name: 'pendingRewards', type: 'uint256' },
      { internalType: 'contract IERC20[]', name: 'bonusTokenAddresses', type: 'address[]' },
      { internalType: 'string[]', name: 'bonusTokenSymbols', type: 'string[]' },
      { internalType: 'uint256[]', name: 'pendingBonusRewards', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  exchangeRate: {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'exchangeRate',
    outputs: [{ internalType: 'uint256', name: 'xr', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
} as const

export async function getWombatFarmBalances(
  ctx: BalancesContext,
  pools: Contract[],
  masterchef: Contract,
): Promise<Balance[]> {
  const balances: Balance[] = []
  const WOM = masterchef.rewards?.[0] as Contract

  const getAssetsPidRes = await multicall({
    ctx,
    calls: pools.map((pool) => ({ target: masterchef.address, params: [pool.address] } as const)),
    abi: abi.getAssetPid,
  })

  const poolsWithIds = mapSuccessFilter(getAssetsPidRes, (res, idx: number) => ({
    ...pools[idx],
    pid: res.output,
  }))

  const [userInfosRes, pendingRewardsRes, exchangeRatesRes] = await Promise.all([
    multicall({
      ctx,
      calls: poolsWithIds.map((pool) => ({ target: masterchef.address, params: [pool.pid, ctx.address] } as const)),
      abi: abi.userInfo,
    }),
    multicall({
      ctx,
      calls: poolsWithIds.map((pool) => ({ target: masterchef.address, params: [pool.pid, ctx.address] } as const)),
      abi: abi.pendingTokens,
    }),
    multicall({
      ctx,
      calls: poolsWithIds.map((pool) =>
        pool.provider
          ? {
              target: pool.provider,
              params: [(pool.underlyings![0] as Contract).address],
            }
          : null,
      ),
      abi: abi.exchangeRate,
    }),
  ])

  for (let poolIdx = 0; poolIdx < poolsWithIds.length; poolIdx++) {
    const pool = poolsWithIds[poolIdx]
    const underlying = pool.underlyings?.[0] as Contract
    const userInfoRes = userInfosRes[poolIdx]
    const pendingRewardRes = pendingRewardsRes[poolIdx]
    const exchangeRateRes = exchangeRatesRes[poolIdx]

    if (!underlying || !userInfoRes.success || !pendingRewardRes.success || !exchangeRateRes.success) {
      continue
    }

    const [amount] = userInfoRes.output
    const [pendingRewards] = pendingRewardRes.output

    const fmtUnderlying = {
      ...underlying,
      decimals: 18,
      amount: (amount * exchangeRateRes.output) / parseEther('1.0'),
    }

    balances.push({
      ...pool,
      amount: amount,
      underlyings: [fmtUnderlying],
      rewards: [{ ...WOM, amount: pendingRewards }],
      category: 'farm',
    })
  }

  return balances
}
