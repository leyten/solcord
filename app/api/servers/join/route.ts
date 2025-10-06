import { type NextRequest, NextResponse } from "next/server"
import { verifyPrivyToken } from "@/lib/auth/privy-server"
import { createAdminClient } from "@/lib/supabase/admin"
import { solanaTracker } from "@/lib/services/solana-tracker"

export async function POST(request: NextRequest) {
  try {
    // Verify Privy authentication
    const authHeader = request.headers.get("authorization")
    console.log("[v0] Join server - Auth header present:", !!authHeader)
    console.log("[v0] Join server - Auth header value:", authHeader?.substring(0, 20) + "...")

    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[v0] Join server - No Bearer token in header")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    console.log("[v0] Join server - Verifying token...")
    const verifiedUser = await verifyPrivyToken(token)
    console.log("[v0] Join server - Verified user:", verifiedUser)

    if (!verifiedUser) {
      console.log("[v0] Join server - Token verification failed")
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const userId = verifiedUser.userId
    console.log("[v0] Join server - User ID:", userId)

    const { tokenCA, walletAddress } = await request.json()

    if (!tokenCA || !walletAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get token data and check user balance
    const [tokenData, walletData] = await Promise.all([
      solanaTracker.getTokenData(tokenCA),
      solanaTracker.getWalletBalances(walletAddress),
    ])

    if (!tokenData) {
      return NextResponse.json({ error: "Invalid token address" }, { status: 400 })
    }

    if (!walletData) {
      return NextResponse.json({ error: "Could not fetch wallet data" }, { status: 400 })
    }

    // Find user's balance for this token
    const userToken = walletData.tokens.find((t) => t.token.mint === tokenCA)
    const userBalance = userToken?.balance || 0
    const hasMinimumTokens = solanaTracker.hasMinimumTokens(userBalance, tokenData.token.decimals, 10000)

    // Use admin client to bypass RLS
    const supabase = createAdminClient()

    // Check if server exists
    let { data: server, error: serverError } = await supabase
      .from("servers")
      .select("*")
      .eq("token_ca", tokenCA)
      .maybeSingle()

    if (serverError) {
      console.error("Error checking server:", serverError)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    if (!server) {
      const { data: newServer, error: createError } = await supabase
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
        return NextResponse.json({ error: "Failed to create server" }, { status: 500 })
      }

      server = newServer

      // Create default channels for the new server
      const defaultChannels = [
        { name: "feed", type: "feed", description: "Community social feed", position: 0 },
        { name: "announcements", type: "feed", description: "Official announcements and updates", position: 1 },
        { name: "general", type: "text", description: "General discussion about anything", position: 2 },
        { name: "trading", type: "text", description: "Trading discussion and analysis", position: 3 },
        {
          name: "1%+ holders",
          type: "text",
          description: "Exclusive chat for 1%+ token holders",
          position: 4,
          min_token_percentage: 1.0,
        },
        { name: "general-voice", type: "voice", description: "General voice chat", position: 5 },
      ]

      const channelsToInsert = defaultChannels.map((channel) => ({
        server_id: server.id,
        ...channel,
      }))

      const { error: channelsError } = await supabase.from("channels").insert(channelsToInsert)

      if (channelsError) {
        console.error("Error creating default channels:", channelsError)
        // Don't fail the entire request if channels fail to create
      } else {
        console.log(`✅ Created ${defaultChannels.length} default channels for server ${server.id}`)
      }
    }

    // Check if user is already a member
    const { data: existingMembership } = await supabase
      .from("server_memberships")
      .select("*")
      .eq("user_id", userId)
      .eq("server_id", server.id)
      .maybeSingle()

    const role = hasMinimumTokens ? "member" : "guest"

    // Convert token balance to integer (multiply by 10^decimals to store as smallest unit)
    const tokenBalanceInt = Math.floor(userBalance * Math.pow(10, tokenData.token.decimals))

    if (existingMembership) {
      // Update existing membership
      const { error: updateError } = await supabase
        .from("server_memberships")
        .update({
          role,
          token_balance: tokenBalanceInt,
          last_verified_at: new Date().toISOString(),
        })
        .eq("id", existingMembership.id)

      if (updateError) {
        console.error("Error updating membership:", updateError)
        return NextResponse.json({ error: "Failed to update membership" }, { status: 500 })
      }
    } else {
      // Create new membership
      const { error: membershipError } = await supabase.from("server_memberships").insert({
        user_id: userId,
        server_id: server.id,
        role,
        token_balance: tokenBalanceInt,
        last_verified_at: new Date().toISOString(),
      })

      if (membershipError) {
        console.error("Error creating membership:", membershipError)
        return NextResponse.json({ error: "Failed to join server" }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, server })
  } catch (error) {
    console.error("Error in join server API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
