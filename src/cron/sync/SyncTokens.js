import axios from 'axios'
import Logger from 'singletons/Logger'
import { promises as fs } from 'fs'
import { TOKENS_FILE } from 'files'

export default class SyncTokens {
  async execute () {
    try {
      const { data } = await axios.get('https://api.coingecko.com/api/v3/coins/list?include_platform=true')

      const bscTokens = data
        .filter((token) => {
          return token.platforms['binance-smart-chain'] !== undefined
        })
        .map((token) => {
          return {
            id: token.id,
            symbol: token.symbol,
            name: token.name,
            address: token.platforms['binance-smart-chain']
          }
        })

      await fs.writeFile(TOKENS_FILE, JSON.stringify(bscTokens))
    } catch (err) {
      Logger.getInstance().error(`Sync tokens - ${err.message}`)
    }
  }
}
