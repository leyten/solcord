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

    const { conversationId, content, attachments } = await request.json()

    if (!conversationId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
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

    const recipientId = conversation.participant_1 === userId ? conversation.participant_2 : conversation.participant_1

    // Insert the message
    const { data: message, error } = await supabase
      .from("direct_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        recipient_id: recipientId, // Added recipient_id to satisfy NOT NULL constraint
        content,
        attachments: attachments || null,
      })
      .select("*")
      .single()

    if (error) {
      console.error("Error sending DM:", error)
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
    }

    // Update conversation's last_message_at
    await supabase
      .from("dm_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId)

    return NextResponse.json({ message })
  } catch (error) {
    console.error("Error in DM send API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
