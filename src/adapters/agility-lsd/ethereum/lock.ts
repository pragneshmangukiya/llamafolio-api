import type { BalancesContext, Contract, LockBalance } from '@lib/adapter'
import { rangeBI } from '@lib/array'
import { call } from '@lib/call'
import { multicall } from '@lib/multicall'
import type { Token } from '@lib/token'

const abi = {
  getUserRedeem: {
    inputs: [
      { internalType: 'address', name: 'userAddress', type: 'address' },
      { internalType: 'uint256', name: 'redeemIndex', type: 'uint256' },
    ],
    name: 'getUserRedeem',
    outputs: [
      { internalType: 'uint256', name: 'agiAmount', type: 'uint256' },
      { internalType: 'uint256', name: 'ESAGIAmount', type: 'uint256' },
      { internalType: 'uint256', name: 'endTime', type: 'uint256' },
      { internalType: 'address', name: 'dividendsContract', type: 'address' },
      { internalType: 'uint256', name: 'dividendsAllocation', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  getUserRedeemsLength: {
    inputs: [{ internalType: 'address', name: 'userAddress', type: 'address' }],
    name: 'getUserRedeemsLength',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
} as const

const AGI: Token = {
  chain: 'ethereum',
  address: '0x5F18ea482ad5cc6BC65803817C99f477043DcE85',
  decimals: 18,
  symbol: 'AGI',
}

export async function getAgilityLockerBalances(ctx: BalancesContext, locker: Contract): Promise<LockBalance[]> {
  const balances: LockBalance[] = []

  const userRedeemsLengthsRes = await call({
    ctx,
    target: locker.address,
    params: [ctx.address],
    abi: abi.getUserRedeemsLength,
  })

  const getUserRedeemsRes = await multicall({
    ctx,
    calls: rangeBI(0n, userRedeemsLengthsRes).map(
      (idx) => ({ target: locker.address, params: [ctx.address, idx] } as const),
    ),
    abi: abi.getUserRedeem,
  })

  for (let resIdx = 0; resIdx < getUserRedeemsRes.length; resIdx++) {
    const getUserRedeemRes = getUserRedeemsRes[resIdx]

    if (!getUserRedeemRes.success) {
      continue
    }

    const [agiAmount, ESAGIAmount, endTime] = getUserRedeemRes.output
    const now = Date.now() / 1000
    const unlockAt = Number(endTime)

    balances.push({
      ...locker,
      amount: ESAGIAmount,
      claimable: now > unlockAt ? agiAmount : 0n,
      underlyings: [{ ...AGI, amount: agiAmount }],
      rewards: undefined,
      unlockAt,
      category: 'lock',
    })
  }

  return balances
}
