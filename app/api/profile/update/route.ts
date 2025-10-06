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
    const userId = await verifyPrivyToken(token)

    if (!userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { username, name, pfpUrl, bio, status } = await request.json()

    // Use admin client to bypass RLS
    const supabase = createAdminClient()

    // Build update object with only provided fields
    const updates: any = {}
    if (username !== undefined) updates.username = username
    if (name !== undefined) updates.name = name
    if (pfpUrl !== undefined) updates.pfp_url = pfpUrl
    if (bio !== undefined) updates.bio = bio
    if (status !== undefined) updates.status = status

    // Update the profile
    const { data: profile, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select("*")
      .single()

    if (error) {
      console.error("Error updating profile:", error)
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error("Error in profile update API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
