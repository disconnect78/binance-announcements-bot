import Web3Error from 'errors/web3/Web3Error'

export default class TransferFromFailedError extends Web3Error {
  constructor (data, block) {
    super('TRANSFER_FROM_FAILED', data, block)

    Object.setPrototypeOf(this, TransferFromFailedError.prototype)
  }
}
