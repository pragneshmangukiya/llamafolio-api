import type { Balance, BalancesContext, BaseContext, Contract } from '@lib/adapter'
import { rangeBI } from '@lib/array'
import { call } from '@lib/call'
import type { Call } from '@lib/multicall'
import { multicall } from '@lib/multicall'
import type { Token } from '@lib/token'

const abi = {
  poolCount: {
    inputs: [],
    name: 'poolCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  getPoolToken: {
    inputs: [{ internalType: 'uint256', name: '_poolId', type: 'uint256' }],
    name: 'getPoolToken',
    outputs: [{ internalType: 'contract IERC20', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  reward: {
    inputs: [],
    name: 'reward',
    outputs: [{ internalType: 'contract IMintableERC20', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  getStakeTotalDeposited: {
    inputs: [
      { internalType: 'address', name: '_account', type: 'address' },
      { internalType: 'uint256', name: '_poolId', type: 'uint256' },
    ],
    name: 'getStakeTotalDeposited',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  getStakeTotalUnclaimed: {
    inputs: [
      { internalType: 'address', name: '_account', type: 'address' },
      { internalType: 'uint256', name: '_poolId', type: 'uint256' },
    ],
    name: 'getStakeTotalUnclaimed',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
} as const

const ALCX: Token = {
  chain: 'ethereum',
  address: '0xdBdb4d16EdA451D0503b854CF79D55697F90c8DF',
  decimals: 18,
  symbol: 'ALCX',
}

export interface getStakerContractsParams extends Contract {
  pid: number
}

export async function getStakerContracts(ctx: BaseContext, staker: Contract): Promise<getStakerContractsParams[]> {
  const contracts: getStakerContractsParams[] = []

  const poolLength = await call({ ctx, target: staker.address, abi: abi.poolCount })

  const poolTokensRes = await multicall({
    ctx,
    calls: rangeBI(0n, poolLength).map((idx) => ({ target: staker.address, params: [idx] } as const)),
    abi: abi.getPoolToken,
  })

  for (let idx = 0; idx < poolLength; idx++) {
    const poolTokenRes = poolTokensRes[idx]

    if (!poolTokenRes.success) {
      continue
    }

    contracts.push({
      chain: ctx.chain,
      address: poolTokenRes.output,
      pid: idx,
    })
  }
  return contracts
}

export async function getStakerBalances(
  ctx: BalancesContext,
  contracts: getStakerContractsParams[],
  staker: Contract,
): Promise<Balance[]> {
  const balances: Balance[] = []

  const calls: Call<typeof abi.getStakeTotalDeposited>[] = []
  for (let idx = 0; idx < contracts.length; idx++) {
    const contract = contracts[idx]
    calls.push({ target: staker.address, params: [ctx.address, BigInt(contract.pid)] })
  }

  const [balancesRes, rewardsBalancesRes] = await Promise.all([
    multicall({ ctx, calls, abi: abi.getStakeTotalDeposited }),
    multicall({ ctx, calls, abi: abi.getStakeTotalUnclaimed }),
  ])

  for (let idx = 0; idx < contracts.length; idx++) {
    const contract = contracts[idx]
    const balanceRes = balancesRes[idx]
    const rewardsBalanceRes = rewardsBalancesRes[idx]

    if (!balanceRes.success || !rewardsBalanceRes.success) {
      continue
    }

    balances.push({
      ...contract,
      amount: balanceRes.output,
      underlyings: undefined,
      rewards: [{ ...ALCX, amount: rewardsBalanceRes.output }],
      category: 'stake',
    })
  }
  return balances
}
