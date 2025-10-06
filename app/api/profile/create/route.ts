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

    const { username, name, pfpUrl, walletAddress } = await request.json()

    if (!username || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Use admin client to bypass RLS
    const supabase = createAdminClient()

    // Check if profile already exists
    const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", userId).single()

    if (existingProfile) {
      return NextResponse.json({ error: "Profile already exists" }, { status: 400 })
    }

    // Create the profile
    const { data: profile, error } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        username,
        name,
        pfp_url: pfpUrl || null,
        wallet_address: walletAddress || null,
      })
      .select("*")
      .single()

    if (error) {
      console.error("Error creating profile:", error)
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error("Error in profile create API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
