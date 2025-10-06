import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyPrivyToken } from "@/lib/auth/privy-server"

export async function POST(request: NextRequest) {
  try {
    const authToken = request.headers.get("authorization")?.replace("Bearer ", "")

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const auth = await verifyPrivyToken(authToken)
    if (!auth) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { channelId, serverId, content, attachments } = await request.json()

    if (!channelId || !serverId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check server membership
    const { data: membership } = await supabase
      .from("server_memberships")
      .select("role, token_balance")
      .eq("user_id", auth.userId)
      .eq("server_id", serverId)
      .single()

    if (!membership && serverId !== "solcord") {
      return NextResponse.json({ error: "Not a member of this server" }, { status: 403 })
    }

    // Check write permissions
    if (serverId !== "solcord") {
      const decimals = 6
      const tokenBalanceRaw = membership?.token_balance || 0
      const actualTokens = tokenBalanceRaw / Math.pow(10, decimals)

      if (actualTokens < 10000) {
        return NextResponse.json({ error: "Insufficient tokens to post" }, { status: 403 })
      }
    }

    // Create post
    const { data: post, error } = await supabase
      .from("feed_posts")
      .insert({
        channel_id: channelId,
        server_id: serverId,
        author_id: auth.userId,
        content: content || null,
        attachments: attachments || null,
      })
      .select("*")
      .single()

    if (error) {
      console.error("Error creating post:", error)
      return NextResponse.json({ error: "Failed to create post" }, { status: 500 })
    }

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error("Error in create post API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
