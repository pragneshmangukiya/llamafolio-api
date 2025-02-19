import type { Balance, Contract } from '@lib/adapter'
import type { BalancesContext } from '@lib/adapter'
import { call } from '@lib/call'
import { abi } from '@lib/erc20'

const KLIMA: Contract = {
  name: 'Klima DAO',
  displayName: 'Klima DAO',
  chain: 'polygon',
  address: '0x4e78011Ce80ee02d2c3e649Fb657E45898257815',
  symbol: 'KLIMA',
  decimals: 9,
}

export async function getStakeBalances(ctx: BalancesContext, contract: Contract): Promise<Balance> {
  const amount = await call({
    ctx,
    target: contract.address,
    params: [ctx.address],
    abi: abi.balanceOf,
  })

  const balance: Balance = {
    chain: ctx.chain,
    address: contract.address,
    decimals: contract.decimals,
    symbol: contract.symbol,
    amount,
    underlyings: [{ ...KLIMA, amount }],
    category: 'stake',
  }

  return balance
}

export async function getFormattedStakeBalances(ctx: BalancesContext, contract: Contract): Promise<Balance> {
  const balanceOf = await call({
    ctx,
    target: contract.address,
    params: [ctx.address],
    abi: abi.balanceOf,
  })

  const formattedBalanceOf = await call({
    ctx,
    target: contract.address,
    params: [balanceOf],
    abi: {
      inputs: [{ internalType: 'uint256', name: '_amount', type: 'uint256' }],
      name: 'wKLIMATosKLIMA',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
  })

  const balance: Balance = {
    chain: ctx.chain,
    address: contract.address,
    symbol: contract.symbol,
    decimals: 9,
    amount: formattedBalanceOf,
    underlyings: [{ ...KLIMA, amount: formattedBalanceOf }],
    category: 'stake',
  }

  return balance
}
