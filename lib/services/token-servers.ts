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
  ): Promise<{ success: boolean; server?: Server; error?: string }> {
    try {
      console.log("Joining server with:", { tokenCA, userId, walletAddress })

      // Get token data and check user balance
      const [tokenData, walletData] = await Promise.all([
        solanaTracker.getTokenData(tokenCA),
        solanaTracker.getWalletBalances(walletAddress),
      ])

      if (!tokenData) {
        return { success: false, error: "Invalid token address" }
      }

      if (!walletData) {
        return { success: false, error: "Could not fetch wallet data" }
      }

      // Find user's balance for this token
      const userToken = walletData.tokens.find((t) => t.token.mint === tokenCA)
      const userBalance = userToken?.balance || 0
      const hasMinimumTokens = solanaTracker.hasMinimumTokens(userBalance, tokenData.token.decimals, 10000)

      console.log("User token balance:", { userBalance, hasMinimumTokens })

      // Check if server exists
      let { data: server, error: serverError } = await this.supabase
        .from("servers")
        .select("*")
        .eq("token_ca", tokenCA)
        .maybeSingle()

      if (serverError) {
        console.error("Error checking server:", serverError)
        return { success: false, error: "Database error" }
      }

      // Create server if it doesn't exist
      if (!server) {
        console.log("Creating new server...")
        const { data: newServer, error: createError } = await this.supabase
          .from("servers")
          .insert({
            token_ca: tokenCA,
            name: tokenData.token.name,
            symbol: tokenData.token.symbol,
            logo_url: tokenData.token.image,
          })
          .select()
          .single()

        if (createError) {
          console.error("Error creating server:", createError)
          return { success: false, error: `Failed to create server: ${createError.message}` }
        }

        server = newServer
        console.log("Server created:", server)
      }

      // Check if user is already a member
      const { data: existingMembership } = await this.supabase
        .from("server_memberships")
        .select("*")
        .eq("user_id", userId)
        .eq("server_id", server.id)
        .maybeSingle()

      const role = hasMinimumTokens ? "member" : "guest"

      // Convert token balance to integer (multiply by 10^decimals to store as smallest unit)
      const tokenBalanceInt = Math.floor(userBalance * Math.pow(10, tokenData.token.decimals))

      if (existingMembership) {
        console.log("Updating existing membership...")
        const { error: updateError } = await this.supabase
          .from("server_memberships")
          .update({
            role,
            token_balance: tokenBalanceInt,
            last_verified_at: new Date().toISOString(),
          })
          .eq("id", existingMembership.id)

        if (updateError) {
          console.error("Error updating membership:", updateError)
          return { success: false, error: "Failed to update membership" }
        }
      } else {
        console.log("Creating new membership...")
        const { error: membershipError } = await this.supabase.from("server_memberships").insert({
          user_id: userId,
          server_id: server.id,
          role,
          token_balance: tokenBalanceInt,
          last_verified_at: new Date().toISOString(),
        })

        if (membershipError) {
          console.error("Error creating membership:", membershipError)
          return { success: false, error: "Failed to join server" }
        }
      }

      console.log("Successfully joined server")
      return { success: true, server }
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

  async updateUserMemberships(userId: string, walletAddress: string): Promise<void> {
    try {
      // Get user's current servers
      const userServers = await this.getUserServers(userId)

      // Get wallet data
      const walletData = await solanaTracker.getWalletBalances(walletAddress)
      if (!walletData) return

      // Update each server membership
      for (const server of userServers) {
        const userToken = walletData.tokens.find((t) => t.token.mint === server.token_ca)
        const userBalance = userToken?.balance || 0

        // Get token data to check decimals
        const tokenData = await solanaTracker.getTokenData(server.token_ca)
        if (!tokenData) continue

        const hasMinimumTokens = solanaTracker.hasMinimumTokens(userBalance, tokenData.token.decimals, 10000)
        const newRole = hasMinimumTokens ? "member" : "guest"

        // Convert token balance to integer
        const tokenBalanceInt = Math.floor(userBalance * Math.pow(10, tokenData.token.decimals))

        if (server.membership) {
          await this.supabase
            .from("server_memberships")
            .update({
              role: newRole,
              token_balance: tokenBalanceInt,
              last_verified_at: new Date().toISOString(),
            })
            .eq("id", server.membership.id)
        }
      }
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
      console.log("[v0] getUserHoldingPercentage called:", { userId, serverId })

      // Get the membership with token_balance
      const { data: membership, error: membershipError } = await this.supabase
        .from("server_memberships")
        .select("token_balance")
        .eq("user_id", userId)
        .eq("server_id", serverId)
        .maybeSingle()

      console.log("[v0] getUserHoldingPercentage membership query:", { membership, membershipError })

      if (membershipError || !membership) {
        console.error("Error fetching user membership:", membershipError)
        return 0
      }

      const decimals = 6 // Standard for most Solana tokens
      const tokenBalanceRaw = membership.token_balance || 0

      console.log("[v0] getUserHoldingPercentage calculation:", { tokenBalanceRaw, decimals })

      // Calculate percentage from raw balance
      const percentage = this.calculateHoldingPercentage(tokenBalanceRaw, decimals)
      console.log("[v0] getUserHoldingPercentage result:", { percentage })

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

  async leaveServer(userId: string, serverId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Prevent leaving the main Solcord server
      if (serverId === "solcord") {
        return { success: false, error: "Cannot leave the main Solcord server" }
      }

      // Delete the user's membership from the server
      const { error } = await this.supabase
        .from("server_memberships")
        .delete()
        .eq("user_id", userId)
        .eq("server_id", serverId)

      if (error) {
        console.error("Error leaving server:", error)
        return { success: false, error: "Failed to leave server" }
      }

      console.log(`User ${userId} successfully left server ${serverId}`)
      return { success: true }
    } catch (error) {
      console.error("Error in leaveServer:", error)
      return { success: false, error: "Unexpected error occurred" }
    }
  }

  async getUserTokenPercentage(serverId: string): Promise<number> {
    try {
      console.log("[v0] getUserTokenPercentage called:", { serverId })

      if (!this.supabase.auth.getUser) {
        console.log("[v0] getUserTokenPercentage: No auth user function")
        return 0
      }

      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      console.log("[v0] getUserTokenPercentage auth user:", { user: user ? { id: user.id } : null })

      if (!user) {
        console.log("[v0] getUserTokenPercentage: No authenticated user")
        return 0
      }

      const { data: membership, error } = await this.supabase
        .from("server_memberships")
        .select("token_balance")
        .eq("user_id", user.id)
        .eq("server_id", serverId)
        .maybeSingle()

      console.log("[v0] getUserTokenPercentage membership:", { membership, error })

      if (error || !membership) {
        console.log("[v0] getUserTokenPercentage: No membership found")
        return 0
      }

      const tokenBalanceRaw = membership.token_balance || 0
      const minimumFor1Percent = 10_000_000_000_000 // 10 trillion raw units = 10M tokens = 1%

      console.log("[v0] getUserTokenPercentage balance check:", {
        tokenBalanceRaw,
        minimumFor1Percent,
        hasAccess: tokenBalanceRaw >= minimumFor1Percent,
      })

      // Return 1.0 if user has 1%+ tokens, 0 otherwise
      return tokenBalanceRaw >= minimumFor1Percent ? 1.0 : 0
    } catch (error) {
      console.error("Error in getUserTokenPercentage:", error)
      return 0
    }
  }
}

export const tokenServerService = new TokenServerService()
