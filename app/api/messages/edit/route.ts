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

    const { messageId, content } = await request.json()

    if (!messageId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check if user owns the message
    const { data: message } = await supabase.from("messages").select("author_id").eq("id", messageId).single()

    if (!message || message.author_id !== auth.userId) {
      return NextResponse.json({ error: "Not authorized to edit this message" }, { status: 403 })
    }

    // Update message
    const { error } = await supabase
      .from("messages")
      .update({
        content,
        edited_at: new Date().toISOString(),
      })
      .eq("id", messageId)

    if (error) {
      console.error("Error editing message:", error)
      return NextResponse.json({ error: "Failed to edit message" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in edit message API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
