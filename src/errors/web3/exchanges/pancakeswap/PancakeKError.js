import Web3Error from 'errors/web3/Web3Error'

export default class PancakeKError extends Web3Error {
  constructor (data, block) {
    super('PANCAKE_K_ERROR', data, block)

    Object.setPrototypeOf(this, PancakeKError.prototype)
  }
}
