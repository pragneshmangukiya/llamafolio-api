import type { BaseContext, Contract } from '@lib/adapter'
import { mapSuccessFilter, rangeBI } from '@lib/array'
import { call } from '@lib/call'
import { multicall } from '@lib/multicall'

const abi = {
  n_gauges: {
    stateMutability: 'view',
    type: 'function',
    name: 'n_gauges',
    inputs: [],
    outputs: [{ name: '', type: 'int128' }],
    gas: 3150,
  },
  gauges: {
    stateMutability: 'view',
    type: 'function',
    name: 'gauges',
    inputs: [{ name: 'arg0', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    gas: 3255,
  },
  lp_token: {
    stateMutability: 'view',
    type: 'function',
    name: 'lp_token',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  vaultParams: {
    inputs: [],
    name: 'vaultParams',
    outputs: [
      { internalType: 'bool', name: 'isPut', type: 'bool' },
      { internalType: 'uint8', name: 'decimals', type: 'uint8' },
      { internalType: 'address', name: 'asset', type: 'address' },
      { internalType: 'address', name: 'underlying', type: 'address' },
      { internalType: 'uint56', name: 'minimumSupply', type: 'uint56' },
      { internalType: 'uint104', name: 'cap', type: 'uint104' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  vaultParamsOptions: {
    inputs: [],
    name: 'vaultParams',
    outputs: [
      { internalType: 'uint8', name: 'decimals', type: 'uint8' },
      { internalType: 'address', name: 'underlying', type: 'address' },
      { internalType: 'uint56', name: 'minimumSupply', type: 'uint56' },
      { internalType: 'uint104', name: 'cap', type: 'uint104' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
} as const

export async function getFarmLPContracts(ctx: BaseContext, gaugeController: Contract): Promise<Contract[]> {
  const contracts: Contract[] = []

  const gaugesLength = await call({ ctx, target: gaugeController.address, abi: abi.n_gauges })

  const gaugesAddressesRes = await multicall({
    ctx,
    calls: rangeBI(0n, gaugesLength).map((i) => ({ target: gaugeController.address, params: [i] } as const)),
    abi: abi.gauges,
  })

  const gaugesAddresses = mapSuccessFilter(gaugesAddressesRes, (res) => res.output)

  const lpTokenFromGaugeRes = await multicall({
    ctx,
    calls: gaugesAddresses.map((address) => ({ target: address })),
    abi: abi.lp_token,
  })

  for (let idx = 0; idx < lpTokenFromGaugeRes.length; idx++) {
    const lpTokenFromGauge = lpTokenFromGaugeRes[idx]

    if (!lpTokenFromGauge.success) {
      continue
    }

    const contract: Contract = {
      chain: ctx.chain,
      address: lpTokenFromGauge.input.target,
      gauge: lpTokenFromGauge.input.target,
      lpToken: lpTokenFromGauge.output,
      underlyings: undefined,
    }

    contracts.push(contract)
  }

  const underlyingsRes = await multicall({
    ctx,
    calls: contracts.map((contract) => ({ target: contract.lpToken })),
    abi: abi.vaultParams,
  })

  for (let idx = 0; idx < underlyingsRes.length; idx++) {
    const underlyings = underlyingsRes[idx]
    const contract = contracts[idx]

    if (!underlyings.success) {
      const vaultParamsOptions = await call({ ctx, target: contract.lpToken, abi: abi.vaultParamsOptions })
      const [_decimals, underlying, _minimumSupply, _cap] = vaultParamsOptions
      contract.underlyings = [underlying]
    } else {
      const [_isPut, _decimals, asset] = underlyings.output
      contract.underlyings = [asset]
    }
  }

  return contracts
}
