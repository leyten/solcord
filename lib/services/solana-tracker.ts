// Solana Tracker API service for token data and wallet balances

interface TokenMetadata {
  name: string
  symbol: string
  mint: string
  uri: string
  decimals: number
  description: string
  image: string
  hasFileMetaData: boolean
}

interface TokenData {
  token: TokenMetadata
  pools: any[]
  events: any
  risk: any
}

interface WalletToken {
  token: TokenMetadata
  balance: number
  value: number
}

interface WalletData {
  tokens: WalletToken[]
  total: number
  totalSol: number
  timestamp: string
}

export class SolanaTrackerService {
  private baseUrl = "/api/solana-tracker"

  async getTokenData(tokenAddress: string): Promise<TokenData | null> {
    try {
      const response = await fetch(`${this.baseUrl}/token/${tokenAddress}`)

      if (!response.ok) {
        console.error(`Failed to fetch token data: ${response.status}`)
        return null
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error("Error fetching token data:", error)
      return null
    }
  }

  async getWalletBalances(walletAddress: string): Promise<WalletData | null> {
    try {
      const response = await fetch(`${this.baseUrl}/wallet/${walletAddress}`)

      if (!response.ok) {
        console.error(`Failed to fetch wallet data: ${response.status}`)
        return null
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error("Error fetching wallet data:", error)
      return null
    }
  }

  // Helper to convert token balance to raw units (accounting for decimals)
  convertToRawBalance(balance: number, decimals: number): bigint {
    return BigInt(Math.floor(balance * Math.pow(10, decimals)))
  }

  // Helper to convert raw balance to decimal
  convertFromRawBalance(rawBalance: bigint, decimals: number): number {
    return Number(rawBalance) / Math.pow(10, decimals)
  }

  // Check if user has minimum required tokens
  hasMinimumTokens(balance: number, decimals: number, minRequired = 10000): boolean {
    const rawBalance = this.convertToRawBalance(balance, decimals)
    const minRequiredRaw = BigInt(minRequired * Math.pow(10, decimals))
    return rawBalance >= minRequiredRaw
  }
}

export const solanaTracker = new SolanaTrackerService()
