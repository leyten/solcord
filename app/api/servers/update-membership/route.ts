import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyPrivyToken } from "@/lib/auth/privy-server"
import { solanaTracker } from "@/lib/services/solana-tracker"

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const verifiedUser = await verifyPrivyToken(token)

    if (!verifiedUser) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const userId = verifiedUser.userId
    const { serverId, walletAddress } = await request.json()

    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // If serverId is provided, update only that server's membership
    // Otherwise, update all servers the user is a member of
    let serversToUpdate: any[] = []

    if (serverId) {
      const { data: membership } = await supabase
        .from("server_memberships")
        .select("*, servers(*)")
        .eq("user_id", userId)
        .eq("server_id", serverId)
        .single()

      if (membership) {
        serversToUpdate = [{ ...membership.servers, membership }]
      }
    } else {
      const { data: memberships } = await supabase
        .from("server_memberships")
        .select("*, servers(*)")
        .eq("user_id", userId)

      serversToUpdate = memberships?.map((m) => ({ ...m.servers, membership: m })) || []
    }

    // Get wallet data
    const walletData = await solanaTracker.getWalletBalances(walletAddress)
    if (!walletData) {
      return NextResponse.json({ error: "Failed to fetch wallet data" }, { status: 500 })
    }

    // Update each server membership
    const updates = []
    for (const server of serversToUpdate) {
      const userToken = walletData.tokens.find((t: any) => t.token.mint === server.token_ca)
      const userBalance = userToken?.balance || 0

      // Get token data to check decimals
      const tokenData = await solanaTracker.getTokenData(server.token_ca)
      if (!tokenData) continue

      const hasMinimumTokens = solanaTracker.hasMinimumTokens(userBalance, tokenData.token.decimals, 10000)
      const newRole = hasMinimumTokens ? "member" : "guest"

      // Convert token balance to integer
      const tokenBalanceInt = Math.floor(userBalance * Math.pow(10, tokenData.token.decimals))


      const { data: updatedData, error: updateError } = await supabase
        .from("server_memberships")
        .update({
          role: newRole,
          token_balance: tokenBalanceInt,
          last_verified_at: new Date().toISOString(),
        })
        .eq("id", server.membership.id)
        .select()

      if (updateError) {
        console.error("[v0] Error updating membership:", updateError)
      } else {
        updates.push({
          serverId: server.id,
          role: newRole,
          tokenBalance: tokenBalanceInt,
        })
      }
    }

    return NextResponse.json({ success: true, updates })
  } catch (error) {
    console.error("Error updating membership:", error)
    return NextResponse.json({ error: "Failed to update membership" }, { status: 500 })
  }
}
