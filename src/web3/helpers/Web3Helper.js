import { Web3Config } from 'config/web3.config'
import Web3 from 'singletons/Web3'
import Web3Instance from 'singletons/Web3'

export default class Web3Helper {
  constructor () {
    this.web3 = Web3Instance.getInstance()
  }

  async send (transactionConfig) {
    return new Promise(async (resolve, reject) => {
      const signedTransaction = await this.web3.eth.accounts.signTransaction(transactionConfig, Web3Config.config.privateKey)
      if (!signedTransaction.rawTransaction) throw new Error('Error while signing transaction')
      this.web3.eth
        .sendSignedTransaction(signedTransaction.rawTransaction)
        .on('error', (error) => {
          reject(error)
        }).then((receipt) => {
          resolve({
            txHash: receipt.transactionHash,
            status: receipt.status
          })
        })
    })
  }

  async estimateGas (transactionConfig) {
    return await this.web3.eth.estimateGas({
      from: transactionConfig.from,
      to: transactionConfig.to,
      data: transactionConfig.data,
      value: transactionConfig.value
    })
  }

  async getTransactionConfig (params) {
    if (!params.from) throw new Error("Parameter 'from' is not defined.")
    if (!params.to) throw new Error("Parameter 'to' is not defined.")
    if (!params.data) throw new Error("Parameter 'data' is not defined.")

    const from = params.from
    const to = params.to
    const data = params.data !== '0x' ? params.data : '0x'
    const value = params.value ?? 0
    const gas = params.gas ?? (await this.getGas({ from, to, data, value }))

    const transactionConfig = { from, to, data, value, gas }

    if (params.gasPrice) {
      transactionConfig.gasPrice = params.gasPrice
    }

    transactionConfig.nonce = params.nonce ?? (await this.getNonce(from))

    return transactionConfig
  }

  // PRIVATE
  async getGas (transactionConfig) {
    return ((await this.web3.eth.estimateGas(transactionConfig)) * 1.1).toFixed(0) // increasing gas cost by 10% for margin
  }

  // PRIVATE
  async getNonce (from) {
    return await this.web3.eth.getTransactionCount(String(from), 'pending')
  }

  makeBatchRequest (calls) {
    const web3 = Web3Instance.getInstance()
    const batch = new web3.BatchRequest()

    const promises = calls.map((call) => {
      return new Promise((resolve, reject) => {
        const req = call.request({ from: '0x0000000000000000000000000000000000000000' }, (err, data) => {
          if (err) reject(err)
          else resolve(data)
        })
        batch.add(req)
      })
    })
    batch.execute()

    return Promise.all(promises)
  }
}
