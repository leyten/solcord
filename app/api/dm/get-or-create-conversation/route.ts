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

    const { user1, user2 } = await request.json()


    if (!user1 || !user2) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify the requesting user is one of the participants
  

    if (userId !== user1 && userId !== user2) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    // Use admin client to bypass RLS
    const supabase = createAdminClient()

    // Check if conversation already exists (in either direction)
    const { data: existingConv } = await supabase
      .from("dm_conversations")
      .select("id")
      .or(
        `and(participant_1.eq.${user1},participant_2.eq.${user2}),and(participant_1.eq.${user2},participant_2.eq.${user1})`,
      )
      .single()

    if (existingConv) {
      return NextResponse.json({ conversationId: existingConv.id })
    }

    // Create new conversation
    const { data: newConv, error } = await supabase
      .from("dm_conversations")
      .insert({
        participant_1: user1,
        participant_2: user2,
      })
      .select("id")
      .single()

    if (error) {
      console.error("Error creating conversation:", error)
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 })
    }

    return NextResponse.json({ conversationId: newConv.id })
  } catch (error) {
    console.error("Error in get-or-create-conversation API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
