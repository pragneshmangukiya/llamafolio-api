import type { GetBalancesHandler } from '@lib/adapter'
import { resolveBalances } from '@lib/balance'
import { getBalancesOf } from '@lib/erc20'
import type { Token } from '@lib/token'

const RETH: Token = {
  chain: 'ethereum',
  address: '0x9559aaa82d9649c7a7b220e7c461d2e74c9a3593',
  name: 'StaFi Staked ETH',
  symbol: 'RETH',
  decimals: 18,
}

export const getContracts = async () => {
  return {
    contracts: { RETH },
  }
}

export const getBalances: GetBalancesHandler<typeof getContracts> = async (ctx, contracts) => {
  const balances = await resolveBalances<typeof getContracts>(ctx, contracts, {
    RETH: async (ctx, RETH) => {
      const { erc20 } = await getBalancesOf(ctx, [RETH])
      return erc20
    },
  })

  return {
    groups: [{ balances }],
  }
}
