import { createClient } from "@/lib/supabase/client"
import { solanaTracker } from "./solana-tracker"

export interface Server {
  id: string
  token_ca: string
  name: string
  symbol: string
  logo_url: string
  created_at: string
}

export interface ServerMembership {
  id: string
  user_id: string
  server_id: string
  role: "member" | "guest"
  token_balance: number
  holding_percentage: number
  last_verified_at: string
}

export interface ServerWithMembership extends Server {
  membership?: ServerMembership
  canJoin: boolean
  userRole: "member" | "guest"
}

export class TokenServerService {
  private supabase = createClient()

  private calculateHoldingPercentage(tokenBalanceRaw: number, decimals: number): number {
    // Convert raw balance back to actual tokens by dividing by 10^decimals
    const actualTokens = tokenBalanceRaw / Math.pow(10, decimals)
    // 10 million tokens = 1% (as specified by user)
    const percentage = (actualTokens / 10_000_000) * 1.0
    return Math.round(percentage * 1000000) / 1000000 // Round to 6 decimal places
  }

  async getServerByTokenCA(tokenCA: string): Promise<ServerWithMembership | null> {
    try {
      // First check if server exists in database
      const { data: existingServer, error: serverError } = await this.supabase
        .from("servers")
        .select("*")
        .eq("token_ca", tokenCA)
        .maybeSingle()

      if (serverError) {
        console.error("Error fetching server:", serverError)
      }

      // Fetch token data from Solana Tracker
      const tokenData = await solanaTracker.getTokenData(tokenCA)
      if (!tokenData) {
        return null
      }

      // If server exists, return it with token data
      if (existingServer) {
        return {
          ...existingServer,
          canJoin: true,
          userRole: "guest", // Will be updated when checking user balance
        }
      }

      // If server doesn't exist, return preview data
      return {
        id: "", // Will be generated when created
        token_ca: tokenCA,
        name: tokenData.token.name,
        symbol: tokenData.token.symbol,
        logo_url: tokenData.token.image,
        created_at: "",
        canJoin: true,
        userRole: "guest",
      }
    } catch (error) {
      console.error("Error in getServerByTokenCA:", error)
      return null
    }
  }

  async joinServer(
    tokenCA: string,
    userId: string,
    walletAddress: string,
    authToken?: string,
  ): Promise<{ success: boolean; server?: Server; error?: string }> {
    try {

      const response = await fetch("/api/servers/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify({
          tokenCA,
          walletAddress,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("❌ API error joining server:", error)
        return { success: false, error: error.error || "Failed to join server" }
      }

      const data = await response.json()
      return { success: true, server: data.server }
    } catch (error) {
      console.error("Error in joinServer:", error)
      return { success: false, error: "Unexpected error occurred" }
    }
  }

  async getUserServers(userId: string): Promise<ServerWithMembership[]> {
    try {
      const { data, error } = await this.supabase
        .from("server_memberships")
        .select(`
          *,
          servers (*)
        `)
        .eq("user_id", userId)

      if (error) {
        console.error("Error fetching user servers:", error)
        return []
      }

      return data.map((membership) => ({
        ...membership.servers,
        membership,
        canJoin: true,
        userRole: membership.role,
      }))
    } catch (error) {
      console.error("Error in getUserServers:", error)
      return []
    }
  }

  async updateUserMemberships(
    userId: string,
    walletAddress: string,
    serverId?: string,
    authToken?: string,
  ): Promise<void> {
    try {
      const response = await fetch("/api/servers/update-membership", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify({
          serverId,
          walletAddress,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("❌ API error updating membership:", error)
        return
      }

      const data = await response.json()
    } catch (error) {
      console.error("Error updating user memberships:", error)
    }
  }

  async autoDiscoverServers(userId: string, walletAddress: string): Promise<void> {
    try {
      // Get wallet data
      const walletData = await solanaTracker.getWalletBalances(walletAddress)
      if (!walletData) return

      // For each token with sufficient balance, try to join server
      for (const walletToken of walletData.tokens) {
        const hasMinimumTokens = solanaTracker.hasMinimumTokens(walletToken.balance, walletToken.token.decimals, 10000)

        if (hasMinimumTokens) {
          // Try to join server (will create if doesn't exist)
          await this.joinServer(walletToken.token.mint, userId, walletAddress)
        }
      }
    } catch (error) {
      console.error("Error in auto-discover servers:", error)
    }
  }

  async getUserHoldingPercentage(userId: string, serverId: string): Promise<number> {
    try {
      // Get the membership with token_balance
      const { data: membership, error: membershipError } = await this.supabase
        .from("server_memberships")
        .select("token_balance")
        .eq("user_id", userId)
        .eq("server_id", serverId)
        .maybeSingle()

      if (membershipError || !membership) {
        console.error("Error fetching user membership:", membershipError)
        return 0
      }

      const decimals = 6 // Standard for most Solana tokens
      const tokenBalanceRaw = membership.token_balance || 0

      // Calculate percentage from raw balance
      const percentage = this.calculateHoldingPercentage(tokenBalanceRaw, decimals)
      return percentage
    } catch (error) {
      console.error("Error in getUserHoldingPercentage:", error)
      return 0
    }
  }

  async canUserWrite(userId: string, serverId: string): Promise<boolean> {
    try {
      if (serverId === "solcord") {
        return true
      }

      const { data: membership, error } = await this.supabase
        .from("server_memberships")
        .select("token_balance")
        .eq("user_id", userId)
        .eq("server_id", serverId)
        .maybeSingle()

      if (error || !membership) {
        return false
      }

      const decimals = 6 // Standard for most Solana tokens
      const tokenBalanceRaw = membership.token_balance || 0
      const actualTokens = tokenBalanceRaw / Math.pow(10, decimals)

      // User needs 10k tokens to write
      return actualTokens >= 10000
    } catch (error) {
      console.error("Error checking user write permissions:", error)
      return false
    }
  }

  async leaveServer(
    userId: string,
    serverId: string,
    authToken?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Prevent leaving the main Solcord server
      if (serverId === "solcord") {
        return { success: false, error: "Cannot leave the main Solcord server" }
      }

      const response = await fetch("/api/servers/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify({ serverId }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("❌ API error leaving server:", error)
        return { success: false, error: error.error || "Failed to leave server" }
      }

      return { success: true }
    } catch (error) {
      console.error("Error in leaveServer:", error)
      return { success: false, error: "Unexpected error occurred" }
    }
  }

  async getUserTokenPercentage(serverId: string): Promise<number> {
    try {
      if (!this.supabase.auth.getUser) {
        return 0
      }

      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      if (!user) {
        return 0
      }

      const { data: membership, error } = await this.supabase
        .from("server_memberships")
        .select("token_balance")
        .eq("user_id", user.id)
        .eq("server_id", serverId)
        .maybeSingle()

      if (error || !membership) {
        return 0
      }

      const decimals = 6 // Standard for most Solana tokens
      const tokenBalanceRaw = membership.token_balance || 0

      // Calculate actual percentage using the same logic as getUserHoldingPercentage
      const percentage = this.calculateHoldingPercentage(tokenBalanceRaw, decimals)
      return percentage
    } catch (error) {
      console.error("Error in getUserTokenPercentage:", error)
      return 0
    }
  }
}

export const tokenServerService = new TokenServerService()
