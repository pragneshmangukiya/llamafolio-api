import type { BalancesContext, BaseContext, Contract } from '@lib/adapter'
import { call } from '@lib/call'
import { multicall } from '@lib/multicall'

export const chickenBondManager: Contract = {
  chain: 'ethereum',
  address: '0x57619FE9C539f890b19c61812226F9703ce37137',
}

const abi = {
  bondNFT: {
    inputs: [],
    name: 'bondNFT',
    outputs: [{ internalType: 'contract IBondNFT', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  lusdToken: {
    inputs: [],
    name: 'lusdToken',
    outputs: [{ internalType: 'contract ILUSDToken', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  bLUSDToken: {
    inputs: [],
    name: 'bLUSDToken',
    outputs: [{ internalType: 'contract IBLUSDToken', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  calcAccruedBLUSD: {
    inputs: [{ internalType: 'uint256', name: '_bondID', type: 'uint256' }],
    name: 'calcAccruedBLUSD',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
} as const

export interface ChickenBondManager extends Contract {
  bondNFT: `0x${string}`
}

export async function getChickenBondManagerContract(ctx: BaseContext) {
  const [bondNFT, lusdToken, bLUSDToken] = await Promise.all([
    call({ ctx, target: chickenBondManager.address, abi: abi.bondNFT }),
    call({ ctx, target: chickenBondManager.address, abi: abi.lusdToken }),
    call({ ctx, target: chickenBondManager.address, abi: abi.bLUSDToken }),
  ])

  const contract: ChickenBondManager = {
    chain: 'ethereum',
    address: chickenBondManager.address,
    bondNFT,
    underlyings: [lusdToken],
    rewards: [bLUSDToken],
  }

  return contract
}

export function getAccruedBLUSD(ctx: BalancesContext, tokenIDs: bigint[]) {
  return multicall({
    ctx,
    calls: tokenIDs.map((tokenID) => ({ target: chickenBondManager.address, params: [tokenID] } as const)),
    abi: abi.calcAccruedBLUSD,
  })
}
