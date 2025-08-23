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
  last_verified_at: string
}

export interface ServerWithMembership extends Server {
  membership?: ServerMembership
  canJoin: boolean
  userRole: "member" | "guest"
}

export class TokenServerService {
  private supabase = createClient()

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
        // Update existing membership
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
        // Create new membership
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

        // Update membership if role changed
        if (server.membership && server.membership.role !== newRole) {
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
}

export const tokenServerService = new TokenServerService()
