import BigNumber from 'bignumber.js'
import { AppConfig } from 'config/app.config'
import { MarketConfig } from 'config/market.config'
import InsufficientInputAmountError from 'errors/web3/exchanges/pancakeswap/InsufficientInputAmountError'
import InsufficientOutputAmountError from 'errors/web3/exchanges/pancakeswap/InsufficientOutputAmountError'
import NonceError from 'errors/web3/exchanges/pancakeswap/NonceError'
import TransferFailedError from 'errors/web3/exchanges/pancakeswap/TransferFailedError'
import TransferFailedFromError from 'errors/web3/exchanges/pancakeswap/TransferFailedFromError'
import Calculate from 'lib/helpers/Calculate'
import Helper from 'lib/helpers/Helper'
import moment from 'moment'
import Logger from 'singletons/Logger'
import Cakeswap from 'web3/exchanges/Cakeswap'
import Bep20 from 'web3/tokens/Bep20'
import lockFile from 'proper-lockfile'
import { TRANSACTIONS_FILE } from 'files'
import { promises as fs } from 'fs'

export default class PancakeswapProcessor {
  constructor () {
    this.BNB_TO_SELL = MarketConfig.config.bnbToSell

    this.cakeswap = new Cakeswap()
    this.bep20 = new Bep20()
  }

  async buy (bnbToken, buyToken) {
    const tokensToReceiveTotal = await this.cakeswap.getAmountsOut(Calculate.includeDecimals(this.BNB_TO_SELL, bnbToken.decimals), buyToken.address, bnbToken.address)
    const tokensToReceive = Calculate.excludeDecimals(tokensToReceiveTotal.toString(), buyToken.decimals)

    // TODO: save the transaction in json file
    let transaction = {
      token_sold: bnbToken.symbol,
      token_bought: buyToken.symbol,
      type: 'buy',
      sold_amount: this.BNB_TO_SELL,
      bought_amount: tokensToReceive.toNumber(),
      total_amount_bought: tokensToReceiveTotal,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    }

    if (!AppConfig.config.testMode) {
      const transfer = await this._buyTokenOnCakeswap(Calculate.includeDecimals(this.BNB_TO_SELL, bnbToken.decimals), tokensToReceiveTotal, buyToken.address, bnbToken.address)
      if (transfer.error === null) {
        const tokenBalanceAmountTotal = await this._getBalanceOfToken(buyToken.address)
        const tokenBalanceAmount = Calculate.excludeDecimals(tokenBalanceAmountTotal.toString(), buyToken.decimals)
        transaction = { ...transaction, success: transfer.status, tx: transfer.txHash, bought_amount: tokenBalanceAmount.toNumber(), total_amount_bought: tokenBalanceAmountTotal }
        await this._writeTransaction(transaction)

        return transfer.status
      } else {
        transaction = { ...transaction, success: false, error: transfer.error, data: transfer.data, block: transfer.block }
        await this._writeTransaction(transaction)

        return false
      }
    }

    await this._writeTransaction(transaction)
    return true
  }

  async sell (bnbToken, sellToken) {
    const input = await fs.readFile(TRANSACTIONS_FILE)
    const transactions = input.toString() !== '' ? JSON.parse(input.toString()) : []
    const buyTransaction = transactions.find((transaction) => transaction.token_bought === sellToken.symbol && transaction.type === 'buy')
    const sellAmount = buyTransaction.total_amount_bought

    const bnbToReceiveTotal = await this.cakeswap.getAmountsOut(sellAmount, bnbToken.address, sellToken.address)
    const bnbToReceive = Calculate.excludeDecimals(bnbToReceiveTotal.toString(), bnbToken.decimals)

    let transaction = {
      token_sold: sellToken.symbol,
      token_bought: bnbToken.symbol,
      type: 'sell',
      sold_amount: Calculate.excludeDecimals(sellAmount.toString(), sellToken.decimals).toNumber(),
      bought_amount: bnbToReceive.toNumber(),
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    }

    // TODO: save the transaction in json file
    if (!AppConfig.config.testMode) {
      await this._approveToken(sellToken.address, sellAmount)
      const transfer = await this._sellTokenOnCakeswap(bnbToReceiveTotal, sellAmount, sellToken.address, bnbToken.address)
      if (transfer.error === null) {
        transaction = { ...transaction, success: transfer.status, tx: transfer.txHash }
        await this._writeTransaction(transaction)

        return transfer.status
      } else {
        transaction = { ...transaction, success: false, error: transfer.error, data: transfer.data, block: transfer.block }
        await this._writeTransaction(transaction)

        return false
      }
    }

    await this._writeTransaction(transaction)
    return true
  }

  async _buyTokenOnCakeswap (bnbAmount, tokensToReceiveAmount, tokenAddress, bnbAddress, attempt = 0) {
    try {
      return await this.cakeswap.buyTokens(bnbAmount, tokensToReceiveAmount, tokenAddress, bnbAddress)
    } catch (err) {
      if (err instanceof InsufficientOutputAmountError || NonceError || TransferFailedError) {
        Logger.getInstance().error(`Buy token error - ${tokenAddress} - ${err.message}`)
        attempt += 1
        if (attempt <= 10) {
          await Helper.sleep(1000 * 1)
          const tokensToReceiveAmount = await this.cakeswap.getAmountsOut(bnbAmount, tokenAddress, bnbAddress)
          return await this._buyTokenOnCakeswap(bnbAmount, tokensToReceiveAmount, tokenAddress, bnbAddress, attempt)
        }
      }
      return {
        error: err.message,
        data: err.data,
        block: err.block
      }
    }
  }

  async _getBalanceOfToken (tokenAddress, attempt = 0) {
    const balance = await this.bep20.getBalance(tokenAddress)
    if (balance.isGreaterThan(0)) {
      return balance
    } else {
      attempt += 1
      if (attempt <= 10) {
        await Helper.sleep(1000 * 1)
        return await this._getBalanceOfToken(tokenAddress, attempt)
      }
    }
    return new BigNumber(0)
  }

  async _sellTokenOnCakeswap (bnbAmount, tokensToSellAmount, tokenAddress, bnbAddress, attempt = 0) {
    try {
      return await this.cakeswap.sellTokens(tokensToSellAmount, bnbAmount, bnbAddress, tokenAddress)
    } catch (err) {
      Logger.getInstance().error(`Sell token error - ${tokenAddress} - ${err.message}`)
      if (err instanceof TransferFailedFromError || NonceError || InsufficientInputAmountError) {
        attempt += 1
        if (attempt <= 10) {
          await Helper.sleep(1000 * 1)
          const bnbToReceiveTotal = await this.cakeswap.getAmountsOut(tokensToSellAmount, bnbAddress, tokenAddress)
          return await this._sellTokenOnCakeswap(bnbToReceiveTotal, tokensToSellAmount, tokenAddress, bnbAddress, attempt)
        }
      }
      return {
        error: err.message,
        data: err.data,
        block: err.block
      }
    }
  }

  async _approveToken (tokenAddress, tokenAmount, attempt = 0) {
    const allowance = await this.bep20.getAllowance(tokenAddress)
    if (allowance.isEqualTo(0)) {
      await this.bep20.approve(tokenAddress, tokenAmount)
      attempt += 1
      if (attempt <= 5) {
        await Helper.sleep(1000 * 8)
        return await this._approveToken(tokenAddress, tokenAmount, attempt)
      }
      return false
    }
    return true
  }

  async _writeTransaction (transaction) {
    await lockFile.lock(TRANSACTIONS_FILE)

    const input = await fs.readFile(TRANSACTIONS_FILE)
    const transactions = input.toString() !== '' ? JSON.parse(input.toString()) : []
    transactions.push(transaction)
    await fs.writeFile(TRANSACTIONS_FILE, JSON.stringify(transactions))

    await lockFile.unlock(TRANSACTIONS_FILE)
  }
}
