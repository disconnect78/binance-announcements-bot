export default class Web3Error extends Error {
  constructor (message, data, block) {
    super()

    this.message = message
    this.data = data
    this.block = block
  }
}
