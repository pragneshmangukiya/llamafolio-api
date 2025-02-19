import { getLendingPoolBalances, getLendingPoolContracts, getLendingPoolHealthFactor } from '@lib/aave/v2/lending'
import type { BaseContext, Contract, GetBalancesHandler } from '@lib/adapter'
import { resolveBalances } from '@lib/balance'

import { getLendingRewardsBalances } from '../common/rewards'
import { getStakeBalancerPoolBalances, getStakeBalances } from '../common/stake'

const AAVE: Contract = {
  name: 'Aave Token',
  address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
  chain: 'ethereum',
  symbol: 'AAVE',
  decimals: 18,
}

const ABPT: Contract = {
  name: 'Aave Balance Pool Token',
  address: '0x41A08648C3766F9F9d85598fF102a08f4ef84F84',
  chain: 'ethereum',
  symbol: 'ABPT',
  decimals: 18,
}

const stkAAVE: Contract = {
  name: 'Staked Aave',
  address: '0x4da27a545c0c5b758a6ba100e3a049001de870f5',
  chain: 'ethereum',
  symbol: 'stkAAVE',
  decimals: 18,
  underlyings: [AAVE],
  rewards: [AAVE],
}

const stkABPT: Contract = {
  name: 'Staked Aave Balance Pool Token',
  address: '0xa1116930326d21fb917d5a27f1e9943a9595fb47',
  chain: 'ethereum',
  symbol: 'stkABPT',
  decimals: 18,
  underlyings: [ABPT],
}

const lendingPool: Contract = {
  name: 'Lending Pool',
  address: '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9',
  chain: 'ethereum',
}

const incentiveController: Contract = {
  name: 'Aave Incentive Controller',
  address: '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5',
  chain: 'ethereum',
}

export const getContracts = async (ctx: BaseContext) => {
  const pools = await getLendingPoolContracts(ctx, lendingPool)

  return {
    contracts: {
      pools,
      incentiveController,
      stkAAVE,
      stkABPT,
    },
  }
}

export const getBalances: GetBalancesHandler<typeof getContracts> = async (ctx, contracts) => {
  const balances = await resolveBalances<typeof getContracts>(ctx, contracts, {
    pools: getLendingPoolBalances,
    incentiveController: (...args) => getLendingRewardsBalances(...args, stkAAVE, contracts.pools || []),
    stkAAVE: getStakeBalances,
    stkABPT: getStakeBalancerPoolBalances,
  })

  const healthFactor = await getLendingPoolHealthFactor(ctx, lendingPool)

  return {
    groups: [{ balances, healthFactor }],
  }
}
