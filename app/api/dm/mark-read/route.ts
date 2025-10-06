import { type NextRequest, NextResponse } from "next/server"
import { verifyPrivyToken } from "@/lib/auth/privy-server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    // Verify Privy authentication
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const verifiedUser = await verifyPrivyToken(token)

    if (!verifiedUser) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const userId = verifiedUser.userId

    const { conversationId } = await request.json()

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversation ID" }, { status: 400 })
    }

    // Use admin client to bypass RLS
    const supabase = createAdminClient()

    // Verify user is part of the conversation
    const { data: conversation } = await supabase
      .from("dm_conversations")
      .select("participant_1, participant_2")
      .eq("id", conversationId)
      .single()

    if (!conversation || (conversation.participant_1 !== userId && conversation.participant_2 !== userId)) {
      return NextResponse.json({ error: "Not authorized for this conversation" }, { status: 403 })
    }

    const otherUserId = conversation.participant_1 === userId ? conversation.participant_2 : conversation.participant_1

    const { error } = await supabase
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("sender_id", otherUserId)
      .is("read_at", null)

    if (error) {
      console.error("Error marking messages as read:", error)
      return NextResponse.json({ error: "Failed to mark messages as read" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in mark-read API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
