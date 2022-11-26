import { Balance, BaseBalance, BaseContext } from '@lib/adapter'
import { Chain } from '@lib/chains'
import { Call, multicall, MultiCallResult } from '@lib/multicall'
import { Token } from '@lib/token'
import { isNotNullish } from '@lib/type'
import { getToken } from '@llamafolio/tokens'
import { BigNumber } from 'ethers'

export const abi = {
  balanceOf: {
    constant: true,
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  decimals: {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [
      {
        name: '',
        type: 'uint8',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  symbol: {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [
      {
        name: '',
        type: 'string',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
}

export async function getERC20Balances(ctx: BaseContext, chain: Chain, tokens: string[]): Promise<BaseBalance[]> {
  const details = await getERC20Details(chain, tokens)

  return getERC20BalanceOf(ctx, chain, details)
}

export async function getERC20BalanceOf(ctx: BaseContext, chain: Chain, tokens: Token[]): Promise<Balance[]> {
  const balances = await multicall({
    chain,
    calls: tokens.map((token) => ({
      target: token.address,
      params: [ctx.address],
    })),
    abi: abi.balanceOf,
  })

  return tokens
    .map((token, i) => {
      if (!balances[i].success || balances[i].output == null) {
        console.error(`Could not get balanceOf for token ${chain}:${token.address}`)
        return null
      }

      ;(token as Balance).amount = BigNumber.from(balances[i].output || '0')
      return token as Balance
    })
    .filter(isNotNullish)
}

export async function getERC20Details(chain: Chain, tokens: string[]): Promise<Token[]> {
  const found: { [key: string]: Token } = {}
  for (const address of tokens) {
    const tokenInfo = getToken(chain, address.toLowerCase())
    if (tokenInfo) {
      found[address] = tokenInfo as Token
    }
  }

  const missingTokens = tokens.filter((address) => !found[address])

  const calls = missingTokens.map((address) => ({
    target: address,
    params: [],
  }))

  const [symbols, decimals] = await Promise.all([
    multicall({ chain, calls, abi: abi.symbol }),
    multicall({ chain, calls, abi: abi.decimals }),
  ])

  for (let i = 0; i < missingTokens.length; i++) {
    const address = missingTokens[i]
    if (!symbols[i].success) {
      console.error(`Could not get symbol for token ${chain}:${address}`)
      continue
    }
    if (!decimals[i].success) {
      console.error(`Could not get decimals for token ${chain}:${address}`)
      continue
    }

    found[address] = {
      chain,
      address,
      symbol: symbols[i].output,
      decimals: parseInt(decimals[i].output),
    }
  }

  return tokens.map((address) => found[address]).filter(isNotNullish)
}

export async function getERC20Details2(chain: Chain, tokens: (string | null)[]): Promise<(Token | null)[]> {
  const found: { [key: string]: Token } = {}
  for (const address of tokens) {
    if (!address) {
      continue
    }
    const tokenInfo = getToken(chain, address.toLowerCase())
    if (tokenInfo) {
      found[address] = tokenInfo as Token
    }
  }

  const missingTokens = tokens.filter((address) => address && !found[address]) as string[]

  const calls = missingTokens.map((address) => ({
    target: address,
    params: [],
  }))

  const [symbols, decimals] = await Promise.all([
    multicall({ chain, calls, abi: abi.symbol }),
    multicall({ chain, calls, abi: abi.decimals }),
  ])

  for (let i = 0; i < missingTokens.length; i++) {
    const address = missingTokens[i]
    if (!symbols[i].success) {
      console.error(`Could not get symbol for token ${chain}:${address}`)
      continue
    }
    if (!decimals[i].success) {
      console.error(`Could not get decimals for token ${chain}:${address}`)
      continue
    }

    found[address] = {
      chain,
      address,
      symbol: symbols[i].output,
      decimals: parseInt(decimals[i].output),
    }
  }

  return tokens.map((address) => (address != null && found[address]) || null)
}

export async function resolveERC20Details<K extends string>(
  chain: Chain,
  contracts: Record<K, (string | null)[]>,
): Promise<Record<K, MultiCallResult<string | null, any[], Token>[]>> {
  const results = {} as Record<K, MultiCallResult<string | null, any[], Token>[]>
  const calls: Call[] = []

  for (const key in contracts) {
    results[key] = []

    for (let i = 0; i < contracts[key].length; i++) {
      const address = contracts[key][i]
      const input = { params: [], target: address }

      if (!address) {
        results[key].push({ success: false, output: null, input })
        continue
      }

      const token = getToken(chain, address.toLowerCase())

      if (token) {
        results[key].push({ success: true, output: token as Token, input })
      } else {
        calls.push({
          target: address,
          params: [],
        })
        results[key].push({ success: false, output: null, input })
      }
    }
  }

  // fetch missing info on-chain
  const [symbols, decimals] = await Promise.all([
    multicall({ chain, calls, abi: abi.symbol }),
    multicall({ chain, calls, abi: abi.decimals }),
  ])

  let callsIdx = 0
  for (const key in contracts) {
    for (let i = 0; i < contracts[key].length; i++) {
      // ignored nullish targets or successful responses (found in cache)
      if (!contracts[key][i] || results[key][i].success) {
        continue
      }

      const address = calls[callsIdx].target
      if (!symbols[callsIdx].success) {
        console.error(`Could not get symbol for token ${chain}:${address}`)
        callsIdx++
        continue
      }
      if (!decimals[callsIdx].success) {
        console.error(`Could not get decimals for token ${chain}:${address}`)
        callsIdx++
        continue
      }

      const token: Token = {
        chain,
        address,
        symbol: symbols[callsIdx].output,
        decimals: parseInt(decimals[callsIdx].output),
      }
      results[key][i].success = true
      results[key][i].output = token

      callsIdx++
    }
  }

  return results
}
