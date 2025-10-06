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

    const { postId, content } = await request.json()

    if (!postId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get the post to check server membership
    const { data: post } = await supabase.from("feed_posts").select("server_id").eq("id", postId).single()

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // Check server membership
    const { data: membership } = await supabase
      .from("server_memberships")
      .select("role")
      .eq("user_id", auth.userId)
      .eq("server_id", post.server_id)
      .single()

    if (!membership && post.server_id !== "solcord") {
      return NextResponse.json({ error: "Not a member of this server" }, { status: 403 })
    }

    // Create comment
    const { data: comment, error } = await supabase
      .from("feed_post_comments")
      .insert({
        post_id: postId,
        author_id: auth.userId,
        content,
      })
      .select("*")
      .single()

    if (error) {
      console.error("Error creating comment:", error)
      return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
    }

    // Increment replies count
    await supabase.rpc("increment_post_replies", { post_id: postId })

    return NextResponse.json({ success: true, comment })
  } catch (error) {
    console.error("Error in create comment API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
