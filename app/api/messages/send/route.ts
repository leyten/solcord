import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyPrivyToken } from "@/lib/auth/privy-server"

export async function POST(request: NextRequest) {
  try {
    // Get auth token from header
    const authToken = request.headers.get("authorization")?.replace("Bearer ", "")

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify Privy token
    const auth = await verifyPrivyToken(authToken)
    if (!auth) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { channelId, serverId, content, attachments, reply_to } = await request.json()

    // Validate required fields
    if (!channelId || !serverId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if user is a member of the server
    const supabase = createAdminClient()

    const { data: membership } = await supabase
      .from("server_memberships")
      .select("role, token_balance")
      .eq("user_id", auth.userId)
      .eq("server_id", serverId)
      .single()

    if (!membership && serverId !== "solcord") {
      return NextResponse.json({ error: "Not a member of this server" }, { status: 403 })
    }

    // Check if user has write permissions (10k tokens minimum)
    if (serverId !== "solcord") {
      const decimals = 6
      const tokenBalanceRaw = membership?.token_balance || 0
      const actualTokens = tokenBalanceRaw / Math.pow(10, decimals)

      if (actualTokens < 10000) {
        return NextResponse.json({ error: "Insufficient tokens to write" }, { status: 403 })
      }
    }

    // Insert message using admin client (bypasses RLS)
    const messageData = {
      channel_id: channelId,
      server_id: serverId,
      author_id: auth.userId,
      content: content || null,
      message_type: attachments?.length ? "image" : "text",
      attachments: attachments || null,
      reply_to: reply_to || null,
    }

    const { data: message, error } = await supabase.from("messages").insert(messageData).select("*").single()

    if (error) {
      console.error("Error inserting message:", error)
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message })
  } catch (error) {
    console.error("Error in send message API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
