import type { BaseContext, Contract } from '@lib/adapter'
import { mapSuccess } from '@lib/array'
import { abi as erc20Abi } from '@lib/erc20'
import type { Call } from '@lib/multicall'
import { multicall } from '@lib/multicall'

const abi = {
  underlying: {
    inputs: [],
    name: 'underlying',
    outputs: [{ internalType: 'contract IERC20Metadata', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  lpToken: {
    inputs: [],
    name: 'lpToken',
    outputs: [{ internalType: 'contract ILpToken', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  rewardManager: {
    inputs: [],
    name: 'rewardManager',
    outputs: [{ internalType: 'contract IRewardManager', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
} as const

const CNC = '0x9aE380F0272E2162340a5bB646c354271c0F5cFC'
const CRV = '0xD533a949740bb3306d119CC777fa900bA034cd52'
const CVX = '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B'

export async function getlpTokensContracts(ctx: BaseContext, pools: `0x${string}`[]): Promise<Contract[]> {
  const contracts: Contract[] = []

  const calls: Call<typeof abi.lpToken>[] = pools.map((pool) => ({ target: pool }))

  const [lpTokensRes, underlyingsRes, rewardManagersRes] = await Promise.all([
    multicall({ ctx, calls, abi: abi.lpToken }),
    multicall({ ctx, calls, abi: abi.underlying }),
    multicall({ ctx, calls, abi: abi.rewardManager }),
  ])

  const lpTokenDetailsCalls = mapSuccess(lpTokensRes, (lpTokenRes) => ({ target: lpTokenRes.output }))

  const [symbolsRes, decimalsRes] = await Promise.all([
    multicall({
      ctx,
      calls: lpTokenDetailsCalls,
      abi: erc20Abi.symbol,
    }),
    multicall({
      ctx,
      calls: lpTokenDetailsCalls,
      abi: erc20Abi.decimals,
    }),
  ])

  for (let poolIdx = 0; poolIdx < pools.length; poolIdx++) {
    const pool = pools[poolIdx]
    const lpTokenRes = lpTokensRes[poolIdx]
    const underlyingRes = underlyingsRes[poolIdx]
    const rewardManagerRes = rewardManagersRes[poolIdx]
    const symbolRes = symbolsRes[poolIdx]
    const decimalRes = decimalsRes[poolIdx]

    if (
      !lpTokenRes.success ||
      !underlyingRes.success ||
      !rewardManagerRes.success ||
      !symbolRes.success ||
      !decimalRes.success
    ) {
      continue
    }

    contracts.push({
      chain: ctx.chain,
      pool: pool,
      address: pool,
      symbol: symbolRes.output,
      decimals: decimalRes.output,
      lpToken: lpTokenRes.output,
      underlyings: [underlyingRes.output],
      rewarder: rewardManagerRes.output,
      rewards: [CNC, CRV, CVX],
    })
  }

  return contracts
}
