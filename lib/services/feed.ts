import { createClient } from "@/lib/supabase/client"
import { compressImage } from "@/lib/utils/file-compression"

export interface FeedPost {
  id: string
  channel_id: string
  server_id: string // 🔥 ENSURE SERVER_ID IS INCLUDED
  author_id: string
  content: string | null
  attachments: any[]
  likes_count: number
  retweets_count: number
  replies_count: number
  created_at: string
  updated_at: string
  profiles: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  }
  user_liked?: boolean
  user_retweeted?: boolean
}

export interface FeedComment {
  id: string
  post_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
  profiles: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  }
}

export interface CreatePostData {
  channel_id: string
  server_id: string // 🔥 NEW REQUIRED FIELD
  content?: string
  attachments?: File[]
  userId?: string
  authToken?: string // Added authToken for API authentication
}

export interface CreateCommentData {
  post_id: string
  content: string
  userId?: string
  authToken?: string // Added authToken for API authentication
}

class FeedService {
  private supabase = createClient()

  // Helper method to set user context for RLS
  private async setUserContext(userId: string) {
    try {
      await this.supabase.rpc("set_claim", {
        claim: "sub",
        value: userId,
      })
    } catch (error) {
      // If the function doesn't exist, we'll handle it differently
    }
  }

  // GET POSTS - NOW SERVER-AWARE
  async getPosts(
    channelId: string,
    serverId: string,
    sortBy: "latest" | "top" = "latest",
    userId?: string,
  ): Promise<FeedPost[]> {
    try {

      // Set user context if available
      if (userId) {
        await this.setUserContext(userId)
      }

      let query = this.supabase
        .from("feed_posts")
        .select(`
          *,
          profiles:author_id (
            id,
            username,
            name,
            pfp_url
          )
        `)
        .eq("server_id", serverId) // 🔥 FILTER BY SERVER
        .eq("channel_id", channelId)

      if (sortBy === "latest") {
        query = query.order("created_at", { ascending: false })
      } else {
        query = query.order("likes_count", { ascending: false })
      }

      const { data: posts, error } = await query

      if (error) {
        console.error("Error fetching posts:", error)
        return []
      }

      if (!posts) {
        return []
      }

      // Get user reactions for all posts if user is authenticated
      const userReactions: { [key: string]: { liked: boolean; retweeted: boolean } } = {}

      if (userId && posts.length > 0) {
        try {
          // First, check if the user has any reactions directly
          const { data: reactions, error: reactionsError } = await this.supabase
            .from("feed_post_reactions")
            .select("post_id, reaction_type")
            .eq("user_id", userId)
            .in(
              "post_id",
              posts.map((p) => p.id),
            )

          if (reactionsError) {
            console.error("Error fetching user reactions:", reactionsError)
          } else if (reactions && reactions.length > 0) {
            // Process the reactions
            reactions.forEach((reaction) => {
              const postId = reaction.post_id
              if (!userReactions[postId]) {
                userReactions[postId] = { liked: false, retweeted: false }
              }

              if (reaction.reaction_type === "like") {
                userReactions[postId].liked = true
              } else if (reaction.reaction_type === "retweet") {
                userReactions[postId].retweeted = true
              }
            })
          }
        } catch (reactionError) {
          console.error("Error in reaction query:", reactionError)
        }
      }


      
      return posts.map((post) => ({
        ...post,
        profiles: {
          id: post.profiles.id,
          username: post.profiles.username,
          display_name: post.profiles.name,
          avatar_url: post.profiles.pfp_url,
        },
        user_liked: userReactions[post.id]?.liked || false,
        user_retweeted: userReactions[post.id]?.retweeted || false,
      }))
    } catch (error) {
      console.error("Error in getPosts:", error)
      return []
    }
  }

  // CREATE POST - NOW SERVER-AWARE
  async createPost(data: CreatePostData, onOptimisticUpdate?: (post: FeedPost) => void): Promise<FeedPost | null> {
    try {
      const userId = data.userId

      if (!userId) {
        console.error("User not authenticated - userId is required")
        return null
      }


      const attachments: any[] = []

      // Process attachments if provided
      if (data.attachments && data.attachments.length > 0) {
        for (const file of data.attachments) {
          try {
            let processedFile = file

            // Compress images
            if (file.type.startsWith("image/")) {
              processedFile = await compressImage(file, {
                maxWidth: 800,
                maxHeight: 600,
                quality: 0.8,
              })
            }

            // Upload to Supabase Storage
            const fileName = `${Date.now()}-${processedFile.name}`
            const { data: uploadData, error: uploadError } = await this.supabase.storage
              .from("message-attachments")
              .upload(fileName, processedFile)

            if (uploadError) {
              console.error("Upload error:", uploadError)
              continue
            }

            // Get public URL
            const { data: urlData } = this.supabase.storage.from("message-attachments").getPublicUrl(fileName)

            attachments.push({
              id: Date.now().toString(),
              filename: file.name,
              size: file.size,
              content_type: file.type,
              url: urlData.publicUrl,
              width: file.type.startsWith("image/") ? undefined : undefined,
              height: file.type.startsWith("image/") ? undefined : undefined,
            })
          } catch (error) {
            console.error("Error processing attachment:", error)
          }
        }
      }

      // Create optimistic post for immediate UI update
      const optimisticPost: FeedPost = {
        id: `temp-${Date.now()}`,
        channel_id: data.channel_id,
        server_id: data.server_id,
        author_id: userId,
        content: data.content || null,
        attachments: attachments,
        likes_count: 0,
        retweets_count: 0,
        replies_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profiles: {
          id: userId,
          username: "You",
          display_name: "You",
          avatar_url: null,
        },
        user_liked: false,
        user_retweeted: false,
      }

      // Call optimistic update callback if provided
      if (onOptimisticUpdate) {
        onOptimisticUpdate(optimisticPost)
      }

      const response = await fetch("/api/feed/create-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(data.authToken && { Authorization: `Bearer ${data.authToken}` }),
        },
        body: JSON.stringify({
          channelId: data.channel_id,
          serverId: data.server_id,
          content: data.content || null,
          attachments: attachments,
        }),
      })

      if (!response.ok) {
        console.error("Error creating post via API")
        return null
      }


      // Return optimistic post for immediate UI feedback
      return optimisticPost
    } catch (error) {
      console.error("Error in createPost:", error)
      return null
    }
  }

  async toggleLike(postId: string, userId?: string): Promise<{ success: boolean; liked: boolean }> {
    try {
      if (!userId) {
        return { success: false, liked: false }
      }

      // Set user context for RLS
      await this.setUserContext(userId)

      const { data, error } = await this.supabase.rpc("toggle_post_like", {
        post_id_param: postId,
        user_id_param: userId,
      })

      if (error) {
        console.error("Error toggling like:", error)
        return { success: false, liked: false }
      }

      return { success: true, liked: data }
    } catch (error) {
      console.error("Error in toggleLike:", error)
      return { success: false, liked: false }
    }
  }

  async toggleRetweet(postId: string, userId?: string): Promise<{ success: boolean; retweeted: boolean }> {
    try {
      if (!userId) {
        return { success: false, retweeted: false }
      }

      // Set user context for RLS
      await this.setUserContext(userId)

      const { data, error } = await this.supabase.rpc("toggle_post_retweet", {
        post_id_param: postId,
        user_id_param: userId,
      })

      if (error) {
        console.error("Error toggling retweet:", error)
        return { success: false, retweeted: false }
      }

      return { success: true, retweeted: data }
    } catch (error) {
      console.error("Error in toggleRetweet:", error)
      return { success: false, retweeted: false }
    }
  }

  async getComments(postId: string): Promise<FeedComment[]> {
    try {
      const { data: comments, error } = await this.supabase
        .from("feed_post_comments")
        .select(`
          *,
          profiles:author_id (
            id,
            username,
            name,
            pfp_url
          )
        `)
        .eq("post_id", postId)
        .order("created_at", { ascending: true })

      if (error) {
        console.error("Error fetching comments:", error)
        return []
      }

      return (comments || []).map((comment) => ({
        ...comment,
        profiles: {
          id: comment.profiles.id,
          username: comment.profiles.username,
          display_name: comment.profiles.name,
          avatar_url: comment.profiles.pfp_url,
        },
      }))
    } catch (error) {
      console.error("Error in getComments:", error)
      return []
    }
  }

  async createComment(data: CreateCommentData): Promise<FeedComment | null> {
    try {
      const userId = data.userId

      if (!userId) {
        console.error("User not authenticated - userId is required")
        return null
      }

      const response = await fetch("/api/feed/create-comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(data.authToken && { Authorization: `Bearer ${data.authToken}` }),
        },
        body: JSON.stringify({
          postId: data.post_id,
          content: data.content,
        }),
      })

      if (!response.ok) {
        console.error("Error creating comment via API")
        return null
      }

      const { comment } = await response.json()

      return {
        ...comment,
        profiles: {
          id: comment.profiles.id,
          username: comment.profiles.username,
          display_name: comment.profiles.name,
          avatar_url: comment.profiles.pfp_url,
        },
      }
    } catch (error) {
      console.error("Error in createComment:", error)
      return null
    }
  }

  // SUBSCRIBE TO POST UPDATES - NOW SERVER-AWARE
  subscribeToPostUpdates(channelId: string, serverId: string, callback: (post: FeedPost) => void, userId?: string) {

    return this.supabase
      .channel(`feed_posts_${serverId}_${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feed_posts",
          filter: `server_id=eq.${serverId}.and.channel_id=eq.${channelId}`, // 🔥 FILTER BY BOTH
        },
        async (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {

            // Fetch the complete post with profile data
            const { data: post } = await this.supabase
              .from("feed_posts")
              .select(`
                *,
                profiles:author_id (
                  id,
                  username,
                  name,
                  pfp_url
                )
              `)
              .eq("id", payload.new.id)
              .single()

            if (post) {
              // Check if the current user has reacted to this post
              let userLiked = false
              let userRetweeted = false

              if (userId) {
                const { data: reactions } = await this.supabase
                  .from("feed_post_reactions")
                  .select("reaction_type")
                  .eq("post_id", post.id)
                  .eq("user_id", userId)

                if (reactions) {
                  userLiked = reactions.some((r) => r.reaction_type === "like")
                  userRetweeted = reactions.some((r) => r.reaction_type === "retweet")
                }
              }

              callback({
                ...post,
                profiles: {
                  id: post.profiles.id,
                  username: post.profiles.username,
                  display_name: post.profiles.name,
                  avatar_url: post.profiles.pfp_url,
                },
                user_liked: userLiked,
                user_retweeted: userRetweeted,
              })
            }
          }
        },
      )
      .subscribe()
  }

  subscribeToReactionUpdates(callback: (data: { postId: string; likesCount: number; retweetsCount: number }) => void) {
    return this.supabase
      .channel("feed_post_reactions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feed_posts",
        },
        (payload) => {
          if (payload.new && payload.eventType === "UPDATE") {
            callback({
              postId: payload.new.id,
              likesCount: payload.new.likes_count,
              retweetsCount: payload.new.retweets_count,
            })
          }
        },
      )
      .subscribe()
  }

  subscribeToCommentUpdates(postId: string, callback: (comment: FeedComment) => void) {
    return this.supabase
      .channel(`feed_comments_${postId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "feed_post_comments",
          filter: `post_id=eq.${postId}`,
        },
        async (payload) => {
          if (payload.new) {
            // Fetch the complete comment with profile data
            const { data: comment } = await this.supabase
              .from("feed_post_comments")
              .select(`
                *,
                profiles:author_id (
                  id,
                  username,
                  name,
                  pfp_url
                )
              `)
              .eq("id", payload.new.id)
              .single()

            if (comment) {
              callback({
                ...comment,
                profiles: {
                  id: comment.profiles.id,
                  username: comment.profiles.username,
                  display_name: comment.profiles.name,
                  avatar_url: comment.profiles.pfp_url,
                },
              })
            }
          }
        },
      )
      .subscribe()
  }
}

export const feedService = new FeedService()
