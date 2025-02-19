import type { Chain } from '@lib/chains'

export const testAddresses = [
  '0xbDfA4f4492dD7b7Cf211209C4791AF8d52BF5c50',
  '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
]

export const testTokens: { [chain in Chain]: string[] } = {
  arbitrum: [],
  avalanche: [],
  ethereum: [
    '0x6b175474e89094c44da98b954eedeac495271d0f',
    '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  ],
  bsc: [],
  celo: [],
  fantom: [],
  gnosis: [],
  harmony: [],
  optimism: [],
  polygon: [],
}

const chains = [
  'ethereum',
  'polygon',
  'bsc',
  'celo',
  'fantom',
  'gnosis',
  'arbitrum',
  'avalanche',
  'harmony',
  'optimism',
] satisfies ReadonlyArray<Chain>

/**
 * Hardcoded for now
 * TODO: make this dynamic
 */
export const testData = {
  address: testAddresses[0],
  chain: chains[0],
  token: testTokens['ethereum'][0],
}
