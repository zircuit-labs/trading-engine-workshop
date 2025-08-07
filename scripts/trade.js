// Trading Engine API Usage Examples
import { config as dotenv } from 'dotenv'
import { createWalletClient, http, getAddress, erc20Abi, createPublicClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, optimism, zircuit, arbitrum, mainnet, baseSepolia, optimismSepolia, arbitrumSepolia, sepolia } from 'viem/chains'

dotenv()

const API_BASE_URL = 'https://trading.ai.zircuit.com/api/engine/v1'
const API_KEY = process.env.API_KEY
const PRIVATE_KEY = process.env.PRIVATE_KEY

const SUPPORTED_CHAINS = [base, optimism, zircuit, arbitrum, mainnet, baseSepolia, optimismSepolia, arbitrumSepolia, sepolia]

// Example request USDC -> USDT swap in Base Mainnet
const QUOTE_REQUEST = {
  srcChainId: 8453, // Base mainnet
  srcToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
  srcAmountWei: '250000',
  destToken: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2', // USDT
  destChainId: 8453, // Same chain
  slippageBps: 100,
  // userAccount: account.address, // Set in executeTrade
  // destReceiver: account.address, // Set in executeTrade, can be different to userAccount

  // Optional fee parameters omitted
  // feeRecipient: account.address,
  // feeBps: '0',
}

const getPublicClient = (chainId) => {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId)
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainId}`)
  }
  return createPublicClient({ chain, transport: http() })
}

const getWalletClient = (chainId, account) => {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId)
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainId}`)
  }
  return createWalletClient({
    chain,
    transport: http(),
    account,
  })
}

const isNativeToken = (tokenAddress) => {
  return (
    getAddress(tokenAddress) === getAddress('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
  )
}

async function getTradeEstimate(quoteRequest) {
  try {
    const response = await apiRequest('/order/estimate', {
      method: 'POST',
      body: JSON.stringify(quoteRequest),
    })

    console.log('Trade estimate:', response)

    // Extract important data for next steps
    const { trade, tx } = response.data

    return {
      tradeId: trade.tradeId,
      expectedAmount: trade.destTokenAmountWei,
      txData: tx,
      fees: trade.fees,
    }
  } catch (error) {
    console.error('Failed to get trade estimate:', error)
    throw error
  }
}

async function approveTokenIfNeeded(tokenAddress, userAccount, spenderAddress, amount, chainId) {
  try {
    if (!PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable not set')
    }

    if (isNativeToken(tokenAddress)) {
      console.log('Native token - no approval needed')
      return null
    }

    const publicClient = getPublicClient(chainId)

    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [userAccount.address, spenderAddress],
    })

    if (BigInt(allowance) >= BigInt(amount)) {
      console.log('Sufficient allowance already exists')
      return null
    }

    console.log('Insufficient allowance, sending approval transaction...')

    const walletClient = getWalletClient(chainId, userAccount)

    const tx = await walletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spenderAddress, amount],
    })

    console.log('Approval transaction sent:', tx)

    await publicClient.waitForTransactionReceipt({ hash: tx })

    return tx
  } catch (error) {
    console.error('Failed to approve token:', error)
    throw error
  }
}

// Helper function for API requests
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
    ...(options.headers || {}),
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`

    try {
      const errorData = JSON.parse(errorText)
      errorMessage = errorData.error || errorData.message || errorMessage
    } catch {
      errorMessage = errorText || errorMessage
    }

    throw new Error(errorMessage)
  }

  return response.json()
}

const executeTrade = async () => {
  try {
    if (!PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable not set')
    }

    const account = privateKeyToAccount(PRIVATE_KEY)
    console.log('Trading with wallet address:', account.address)

    const quoteRequest = {
      ...QUOTE_REQUEST,
      userAccount: account.address, // User's wallet
      destReceiver: account.address, // Same as user
    }

    // Step 1: Get trade estimate
    console.log('Step 1: Getting trade estimate...')
    const estimate = await getTradeEstimate(quoteRequest)

    console.log('Fees:', estimate.fees)

    // Step 2: Check if token approval is needed
    console.log('Step 2: Checking token approval...')
    const spenderAddress = estimate.txData.to // GudEngine address
    await approveTokenIfNeeded(
      quoteRequest.srcToken,
      account,
      spenderAddress,
      quoteRequest.srcAmountWei,
      quoteRequest.srcChainId,
    )

    // Step 3: Execute trade
    console.log('Step 3: Executing trade...')
    const walletClient = getWalletClient(quoteRequest.srcChainId, account)

    const tx = await walletClient.sendTransaction({
      account,
      to: estimate.txData.to,
      value: BigInt(estimate.txData.value),
      data: estimate.txData.data,
    })

    console.log('✅ Trade executed successfully!')
    console.log('Transaction hash:', tx)

    return {
      success: true,
      txHash: tx,
      tradeId: estimate.tradeId,
    }
  } catch (error) {
    console.error('❌ Backend trade execution failed:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

executeTrade()
