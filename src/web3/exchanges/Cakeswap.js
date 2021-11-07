import Web3Instance from 'singletons/Web3'
import PairAbi from 'web3/smartcontracts/abi/exchangePairABI.json'
import FactoryAbi from 'web3/smartcontracts/abi/exchangeFactoryABI.json'
import RouterAbi from 'web3/smartcontracts/abi/exchangeRouterABI.json'
import { CakeswapFactoryAddress, CakeswapRouterAddress } from 'web3/smartcontracts/addresses'
import BigNumber from 'bignumber.js'
import { Web3Config } from 'config/web3.config'
import { now } from 'moment'
import Web3Helper from 'web3/helpers/Web3Helper'
import Web3Errors from 'web3/helpers/Web3Errors'

export default class Cakeswap {
  constructor () {
    this.web3 = Web3Instance.getInstance()
    this.web3Helper = new Web3Helper()
  }

  async getReserves (address) {
    const contract = new this.web3.eth.Contract(PairAbi, address)

    const reserves = await contract.methods.getReserves().call()
    return { reserve0: reserves._reserve0, reserve1: reserves._reserve1 }
  }

  async getReservesInBatch (addresses) {
    const requests = addresses.map((address) => {
      const contract = new this.web3.eth.Contract(PairAbi, address)
      return contract.methods.getReserves().call
    })

    const results = await this.web3Helper.makeBatchRequest(requests)
    return results.map((result) => {
      return { reserve0: result._reserve0, reserve1: result._reserve1 }
    })
  }

  async getPairs (blockBegin, blockEnd) {
    const contract = new this.web3.eth.Contract(FactoryAbi, CakeswapFactoryAddress)
    return await contract.getPastEvents('PairCreated', { fromBlock: blockBegin, toBlock: blockEnd })
  }

  async getAmountsOut (buyAmount, buyAddress, sellAddress) {
    const contract = new this.web3.eth.Contract(RouterAbi, CakeswapRouterAddress)
    const result = await contract.methods.getAmountsOut(buyAmount, [sellAddress, buyAddress]).call()
    return new BigNumber(result[1])
  }

  async getAmountsIn (sellAmount, buyAddress, sellAddress) {
    const contract = new this.web3.eth.Contract(RouterAbi, CakeswapRouterAddress)
    const result = await contract.methods.getAmountsIn(sellAmount, [sellAddress, buyAddress]).call()
    return new BigNumber(result[1])
  }

  async buyTokens (sellAmount, expectedAmount, buyAddress, sellAddress) {
    const contract = new this.web3.eth.Contract(RouterAbi, CakeswapRouterAddress)
    const data = contract.methods.swapExactTokensForTokensSupportingFeeOnTransferTokens(sellAmount, expectedAmount, [sellAddress, buyAddress], Web3Config.config.publicKey, now() + 1).encodeABI()
    const currentBlock = await this.web3.eth.getBlockNumber()
    try {
      const config = await this.web3Helper.getTransactionConfig({
        from: Web3Config.config.publicKey,
        to: CakeswapRouterAddress,
        data: data,
        gasPrice: '10000000000'
      })
      await this.web3Helper.estimateGas(config)
      const txHash = await this.web3Helper.send(config)
      return {
        txHash: txHash.txHash,
        status: txHash.status,
        data: data,
        block: currentBlock,
        error: null
      }
    } catch (err) {
      Web3Errors.throwExchangeError(err, data, currentBlock)
    }
  }

  async sellTokens (sellAmount, expectedAmount, buyAddress, sellAddress) {
    const contract = new this.web3.eth.Contract(RouterAbi, CakeswapRouterAddress)
    const data = contract.methods.swapExactTokensForTokensSupportingFeeOnTransferTokens(sellAmount, expectedAmount, [sellAddress, buyAddress], Web3Config.config.publicKey, now() + 1).encodeABI()
    const currentBlock = await this.web3.eth.getBlockNumber()
    try {
      const config = await this.web3Helper.getTransactionConfig({
        from: Web3Config.config.publicKey,
        to: CakeswapRouterAddress,
        data: data,
        gasPrice: '10000000000'
      })
      await this.web3Helper.estimateGas(config)
      const txHash = await this.web3Helper.send(config)
      return {
        txHash: txHash.txHash,
        status: txHash.status,
        data: data,
        block: currentBlock,
        error: null
      }
    } catch (err) {
      Web3Errors.throwExchangeError(err, data, currentBlock)
    }
  }
}
