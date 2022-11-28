import { Contract } from '@lib/adapter'
import { Chain } from '@lib/chains'
import { multicall } from '@lib/multicall'
import { isSuccess } from '@lib/type'
import { BigNumber } from 'ethers'

const pools = [
  '0x1ed460d149d48fa7d91703bf4890f97220c09437', // BUSD
  '0xa991356d261fbaf194463af6df8f0464f8f1c742', // USDC
  '0x6002b1dcb26e7b1aa797a17551c6f487923299d7', // USDT
  '0x97ce06c3e3d027715b2d6c22e67d5096000072e5', // TUSD
  '0xa1e72267084192db7387c8cc1328fade470e4149', // Legacy TUSD
]

export async function getPoolsContracts(chain: Chain) {
  const contracts: Contract[] = []

  const tokensRes = await multicall({
    chain,
    calls: pools.map((pool) => ({
      target: pool,
      params: [],
    })),
    abi: {
      inputs: [],
      name: 'token',
      outputs: [{ internalType: 'contract ERC20', name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    },
  })

  for (let i = 0; i < pools.length; i++) {
    const tokenRes = tokensRes[i]

    if (!isSuccess(tokenRes)) {
      continue
    }

    contracts.push({
      chain,
      address: pools[i],
      underlyings: [tokenRes.output],
    })
  }

  return contracts
}

export interface PoolSupply extends Contract {
  poolValue: BigNumber
  totalSupply: BigNumber
}

export async function getPoolsSupplies(chain: Chain, pools: Contract[]) {
  const poolsSupplies: PoolSupply[] = []

  const calls = pools.map((pool) => ({
    target: pool.address,
    params: [],
  }))

  const [poolValue, totalSupply] = await Promise.all([
    multicall({
      chain,
      calls,
      abi: {
        inputs: [],
        name: 'poolValue',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    }),

    multicall({
      chain,
      calls,
      abi: {
        inputs: [],
        name: 'totalSupply',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    }),
  ])

  for (let i = 0; i < pools.length; i++) {
    if (!poolValue[i].success || !totalSupply[i].success) {
      continue
    }

    poolsSupplies.push({
      ...pools[i],
      poolValue: BigNumber.from(poolValue[i].output),
      totalSupply: BigNumber.from(totalSupply[i].output),
    })
  }

  return poolsSupplies
}
