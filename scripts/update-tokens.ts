import '../environment'

import type { Chain } from '@lib/chains'
import { chainsNames } from '@lib/chains'
import type { Address } from 'viem'

import pool from '../src/db/pool'
import type { ERC20Token } from '../src/db/tokens'
import { insertERC20Tokens, selectUndecodedChainAddresses } from '../src/db/tokens'
import { getERC20Details } from '../src/lib/erc20'

function help() {
  console.log('pnpm run update-tokens')
}

async function main() {
  // argv[0]: node_modules/.bin/tsx
  // argv[1]: update-tokens.ts
  if (process.argv.length < 2) {
    console.error('Missing arguments')
    return help()
  }

  const client = await pool.connect()

  try {
    const limit = 100
    let offset = 0

    for (;;) {
      console.log('Offset', offset)
      const chainsAddresses = await selectUndecodedChainAddresses(client, limit, offset)
      if (chainsAddresses.length === 0) {
        console.log(`Insert tokens done`)
        return
      }

      const tokensByChain = {} as { [chain in Chain]: Address[] }

      for (const item of chainsAddresses) {
        const [chain, address] = item as [Chain, Address]
        if (!chainsNames.includes(chain)) {
          console.error(`Unknown chain ${chain}`)
          continue
        }
        if (!tokensByChain[chain]) {
          tokensByChain[chain] = []
        }
        tokensByChain[chain].push(address)
      }

      const chains = Object.keys(tokensByChain) as Chain[]

      const chainsTokens = await Promise.all(
        chains.map((chain) => getERC20Details({ chain, adapterId: '' }, tokensByChain[chain])),
      )

      const tokens: ERC20Token[] = []

      for (let chainIdx = 0; chainIdx < chains.length; chainIdx++) {
        const chain = chains[chainIdx]

        for (const token of chainsTokens[chainIdx]) {
          tokens.push({
            address: token.address,
            chain,
            name: token.name,
            symbol: token.symbol.replaceAll('\x00', ''),
            decimals: token.decimals,
            coingeckoId: token.coingeckoId || undefined,
            cmcId: undefined,
          })
        }
      }

      console.log(tokens)

      await insertERC20Tokens(client, tokens)

      console.log(`Inserted ${tokens.length} tokens`)

      offset += limit
    }
  } catch (e) {
    console.log('Failed to insert tokens', e)
  } finally {
    client.release(true)
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
