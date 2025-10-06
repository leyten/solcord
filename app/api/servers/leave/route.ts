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

    const { serverId } = await request.json()

    if (!serverId) {
      return NextResponse.json({ error: "Missing server ID" }, { status: 400 })
    }

    // Use admin client to bypass RLS
    const supabase = createAdminClient()

    // Delete membership
    const { error } = await supabase.from("server_memberships").delete().eq("server_id", serverId).eq("user_id", userId)

    if (error) {
      console.error("Error leaving server:", error)
      return NextResponse.json({ error: "Failed to leave server" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in leave server API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
