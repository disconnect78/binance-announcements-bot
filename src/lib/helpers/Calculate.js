import BigNumber from 'bignumber.js'

export default class Calculate {
  static excludeDecimals (number, decimals) {
    const bigNumber = new BigNumber(number)
    return bigNumber.div(10 ** decimals)
  }

  static includeDecimals (number, decimals) {
    const bigNumber = new BigNumber(number)
    return bigNumber.multipliedBy(10 ** decimals)
  }

  static getReceivedAmount (buyAmount, coinReserve, tokenReserve, target) {
    BigNumber.set({ DECIMAL_PLACES: 40 })
    const reserve0 = target === 'coin' ? tokenReserve : coinReserve
    const reserve1 = target === 'coin' ? coinReserve : tokenReserve
    const ratio = this._calculateRatioWithPriceImpact(buyAmount, reserve0, reserve1)
    const invertedRatio = new BigNumber(1).div(ratio)
    return buyAmount.multipliedBy(invertedRatio).multipliedBy(0.9975)
  }

  static _calculateRatioWithPriceImpact (buyAmount, reserve0, reserve1) {
    const k = reserve0.multipliedBy(reserve1)
    const newReserve1 = reserve0.plus(buyAmount)
    const newReserve2 = k.div(newReserve1)
    return reserve0.div(newReserve2)
  }
}
