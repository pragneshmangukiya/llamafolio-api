import { Adapter } from '@lib/adapter'

import * as arbitrum from './arbitrum'
import * as avax from './avax'
import * as bsc from './bsc'
import * as ethereum from './ethereum'
import * as fantom from './fantom'
import * as optimism from './optimism'
import * as polygon from './polygon'

const adapter: Adapter = {
  id: 'frax-finance',
  ethereum,
  arbitrum,
  avax,
  bsc,
  fantom,
  optimism,
  polygon,
}

export default adapter
