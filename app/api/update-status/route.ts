import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { PrivyClient } from "@privy-io/server-auth"
import { cookies } from "next/headers"

const privy = new PrivyClient(process.env.NEXT_PUBLIC_PRIVY_APP_ID!, process.env.PRIVY_APP_SECRET!)

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get("privy-token")?.value

    if (!authToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    let claims
    try {
      claims = await privy.verifyAuthToken(authToken)
    } catch (error) {
      console.error("Failed to verify auth token:", error)
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 })
    }

    const formData = await request.formData()
    const status = formData.get("status") as string

    if (!status || !["online", "dnd", "offline"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from("profiles")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claims.userId)

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating status:", error)
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 })
  }
}
