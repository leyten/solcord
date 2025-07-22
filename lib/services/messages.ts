import { createClient } from "@/lib/supabase/client"
import type { Message, MessageAttachment, SendMessageData } from "@/lib/types/messages"
import { extractUrls, generateLinkPreview } from "@/lib/utils/link-preview"
import { spamPreventionService } from "./spam-prevention"

// Simple compression function since we don't have the library yet
async function compressImage(file: File): Promise<File> {
  // For now, just return the original file
  // You can install browser-image-compression later if needed
  return file
}

interface User {
  id: string
  name: string
  username: string
  avatar: string
  rank?: string
}

export class OptimizedMessagesService {
  private supabase = createClient()
  private authorCache = new Map<string, User>()
  private messageCache = new Map<string, Message[]>()
  private replyCache = new Map<string, Message>()
  private subscriptions = new Map<string, any>()

  // Cache management - more targeted clearing
  private clearCacheForChannel(channelId: string) {
    const keysToDelete = Array.from(this.messageCache.keys()).filter((key) => key.startsWith(`${channelId}-`))
    keysToDelete.forEach((key) => this.messageCache.delete(key))
  }

  // Get a single message by ID (for replies)
  async getMessage(messageId: string): Promise<Message | null> {
    // Check cache first
    if (this.replyCache.has(messageId)) {
      return this.replyCache.get(messageId)!
    }

    try {
      const { data: msg, error } = await this.supabase.from("messages").select("*").eq("id", messageId).single()

      if (error || !msg) {
        console.error("Error fetching message:", error)
        return null
      }

      // Get author info
      let author = this.authorCache.get(msg.author_id)
      if (!author) {
        const { data: authorData } = await this.supabase
          .from("profiles")
          .select("id, name, username, pfp_url")
          .eq("id", msg.author_id)
          .single()

        if (authorData) {
          author = {
            id: authorData.id,
            name: authorData.name,
            username: authorData.username,
            avatar: authorData.pfp_url || "",
            rank: "Holder",
          }
          this.authorCache.set(authorData.id, author)
        }
      }

      const message: Message = {
        id: msg.id,
        channel_id: msg.channel_id,
        server_id: msg.server_id,
        author_id: msg.author_id,
        content: msg.content,
        message_type: msg.message_type,
        attachments: msg.attachments || [],
        embeds: msg.embeds || [],
        reactions: [],
        reply_to: msg.reply_to,
        edited_at: msg.edited_at,
        created_at: msg.created_at,
        updated_at: msg.updated_at,
        author: author || {
          id: msg.author_id,
          name: "Unknown User",
          username: "unknown",
          avatar: "",
          rank: "Holder",
        },
      }

      // Cache the message
      this.replyCache.set(messageId, message)
      return message
    } catch (error) {
      console.error("Error in getMessage:", error)
      return null
    }
  }

  // Get messages with intelligent caching
  async getChannelMessages(
    channelId: string,
    limit = 25,
    before?: string,
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const cacheKey = `${channelId}-${before || "latest"}-${limit}`

    // Check cache first
    if (this.messageCache.has(cacheKey)) {
      return {
        messages: this.messageCache.get(cacheKey)!,
        hasMore: this.messageCache.get(cacheKey)!.length === limit,
      }
    }

    try {
      // Fetch messages
      let query = this.supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: false })
        .limit(limit + 1) // Fetch one extra to check if there are more

      if (before) {
        query = query.lt("created_at", before)
      }

      const { data: rawMessages, error } = await query

      if (error) {
        console.error("Error fetching messages:", error)
        return { messages: [], hasMore: false }
      }

      if (!rawMessages || rawMessages.length === 0) {
        return { messages: [], hasMore: false }
      }

      // Check if there are more messages
      const hasMore = rawMessages.length > limit
      const messages = hasMore ? rawMessages.slice(0, -1) : rawMessages

      // Get unique author IDs
      const authorIds = [...new Set(messages.map((m) => m.author_id))]

      // Fetch missing authors in batch
      const missingAuthorIds = authorIds.filter((id) => !this.authorCache.has(id))

      if (missingAuthorIds.length > 0) {
        const { data: authors } = await this.supabase
          .from("profiles")
          .select("id, name, username, pfp_url")
          .in("id", missingAuthorIds)

        authors?.forEach((author) => {
          this.authorCache.set(author.id, {
            id: author.id,
            name: author.name,
            username: author.username,
            avatar: author.pfp_url || "",
            rank: "Holder", // TODO: Calculate actual rank
          })
        })
      }

      // Transform messages
      const transformedMessages: Message[] = messages.reverse().map((msg) => ({
        id: msg.id,
        channel_id: msg.channel_id,
        server_id: msg.server_id,
        author_id: msg.author_id,
        content: msg.content,
        message_type: msg.message_type,
        attachments: msg.attachments || [],
        embeds: msg.embeds || [],
        reactions: [], // TODO: Fetch reactions
        reply_to: msg.reply_to,
        edited_at: msg.edited_at,
        created_at: msg.created_at,
        updated_at: msg.updated_at,
        author: this.authorCache.get(msg.author_id) || {
          id: msg.author_id,
          name: "Unknown User",
          username: "unknown",
          avatar: "",
          rank: "Holder",
        },
      }))

      // Cache the result
      this.messageCache.set(cacheKey, transformedMessages)

      return { messages: transformedMessages, hasMore }
    } catch (error) {
      console.error("Error in getChannelMessages:", error)
      return { messages: [], hasMore: false }
    }
  }

  // Send message with spam prevention
  async sendMessage(
    channelId: string,
    authorId: string,
    data: SendMessageData,
  ): Promise<{ success: boolean; message?: Message; error?: string; cooldownRemaining?: number }> {
    try {
      // Check spam prevention
      const spamCheck = spamPreventionService.checkSpam(authorId, data.content || "")
      if (!spamCheck.allowed) {
        return {
          success: false,
          error: spamCheck.reason,
          cooldownRemaining: spamCheck.cooldownRemaining,
        }
      }

      // Generate embeds from URLs in content
      const embeds = data.embeds || []
      if (data.content) {
        const urls = extractUrls(data.content)
        for (const url of urls.slice(0, 3)) {
          // Limit to 3 embeds
          const embed = await generateLinkPreview(url)
          if (embed) {
            embeds.push(embed)
          }
        }
      }

      const messageData = {
        channel_id: channelId,
        server_id: "solcord",
        author_id: authorId,
        content: data.content || null,
        message_type: data.attachments?.length ? "image" : embeds.length ? "embed" : "text",
        attachments: data.attachments || null,
        embeds: embeds.length > 0 ? embeds : null,
        reply_to: data.reply_to || null,
      }

      console.log("📤 Sending message to database:", messageData)

      const { data: newMessage, error } = await this.supabase.from("messages").insert(messageData).select("*").single()

      if (error) {
        console.error("❌ Database error sending message:", error)
        return {
          success: false,
          error: "Failed to send message",
        }
      }

      console.log("✅ Message successfully inserted:", newMessage.id)

      // Record message for spam prevention
      spamPreventionService.recordMessage(authorId, data.content || "")

      // Clear cache for this channel
      this.clearCacheForChannel(channelId)

      // Get or create author info
      let author = this.authorCache.get(authorId)
      if (!author) {
        const { data: authorData } = await this.supabase
          .from("profiles")
          .select("id, name, username, pfp_url")
          .eq("id", authorId)
          .single()

        if (authorData) {
          author = {
            id: authorData.id,
            name: authorData.name,
            username: authorData.username,
            avatar: authorData.pfp_url || "",
            rank: "Holder",
          }
          this.authorCache.set(authorId, author)
        }
      }

      // Return successful message
      const message: Message = {
        ...newMessage,
        attachments: newMessage.attachments || [],
        embeds: newMessage.embeds || [],
        reactions: [],
        author: author || {
          id: authorId,
          name: "Unknown User",
          username: "unknown",
          avatar: "",
          rank: "Holder",
        },
      }

      return {
        success: true,
        message,
      }
    } catch (error) {
      console.error("Error in sendMessage:", error)
      return {
        success: false,
        error: "Failed to send message",
      }
    }
  }

  // Edit message with optimistic update
  async editMessage(messageId: string, content: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from("messages")
        .update({
          content,
          edited_at: new Date().toISOString(),
        })
        .eq("id", messageId)

      if (error) {
        console.error("Error editing message:", error)
        return false
      }

      // Update reply cache if this message is cached
      if (this.replyCache.has(messageId)) {
        const cachedMessage = this.replyCache.get(messageId)!
        this.replyCache.set(messageId, {
          ...cachedMessage,
          content,
          edited_at: new Date().toISOString(),
        })
      }

      return true
    } catch (error) {
      console.error("Error in editMessage:", error)
      return false
    }
  }

  // Delete message with optimistic update
  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.from("messages").delete().eq("id", messageId)

      if (error) {
        console.error("Error deleting message:", error)
        return false
      }

      // Remove from reply cache
      this.replyCache.delete(messageId)

      return true
    } catch (error) {
      console.error("Error in deleteMessage:", error)
      return false
    }
  }

  // Upload attachment with compression
  async uploadAttachment(file: File, authorId: string): Promise<MessageAttachment | null> {
    try {
      // Compress if it's an image
      const processedFile = await compressImage(file)

      const fileExt = processedFile.name.split(".").pop()
      const timestamp = Date.now()
      const fileName = `${authorId}/${timestamp}.${fileExt}`

      const { data, error } = await this.supabase.storage.from("message-attachments").upload(fileName, processedFile, {
        contentType: processedFile.type,
        cacheControl: "3600",
      })

      if (error) {
        console.error("Error uploading attachment:", error)
        return null
      }

      const { data: urlData } = this.supabase.storage.from("message-attachments").getPublicUrl(fileName)

      return {
        id: timestamp.toString(),
        filename: file.name,
        size: processedFile.size,
        content_type: processedFile.type,
        url: urlData.publicUrl,
        width: undefined, // TODO: Get image dimensions
        height: undefined,
      }
    } catch (error) {
      console.error("Error in uploadAttachment:", error)
      return null
    }
  }

  // Get spam prevention cooldown
  getSpamCooldown(userId: string): number {
    return spamPreventionService.getCooldownRemaining(userId)
  }

  // COMPLETELY REWRITTEN REAL-TIME SUBSCRIPTION
  subscribeToChannel(
    channelId: string,
    callbacks: {
      onInsert?: (message: Message) => void
      onUpdate?: (message: Message) => void
      onDelete?: (messageId: string) => void
    },
  ) {
    // Clean up existing subscription
    if (this.subscriptions.has(channelId)) {
      console.log(`🧹 Cleaning up existing subscription for: ${channelId}`)
      this.subscriptions.get(channelId).unsubscribe()
    }

    console.log(`🔌 Creating NEW subscription for channel: ${channelId}`)

    // Create a completely fresh subscription
    const channelName = `realtime_messages_${channelId}_${Math.random().toString(36).substring(7)}`
    console.log(`📡 Using channel name: ${channelName}`)

    const subscription = this.supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          console.log(`🔥 REAL-TIME EVENT RECEIVED for ${channelId}:`, payload.eventType, payload)

          if (payload.eventType === "INSERT" && callbacks.onInsert) {
            const msg = payload.new
            console.log(`📨 Processing INSERT event:`, msg)

            // Get author info
            let author = this.authorCache.get(msg.author_id)
            if (!author) {
              console.log(`👤 Fetching author for: ${msg.author_id}`)
              const { data } = await this.supabase
                .from("profiles")
                .select("id, name, username, pfp_url")
                .eq("id", msg.author_id)
                .single()

              if (data) {
                author = {
                  id: data.id,
                  name: data.name,
                  username: data.username,
                  avatar: data.pfp_url || "",
                  rank: "Holder",
                }
                this.authorCache.set(data.id, author)
                console.log(`✅ Author cached:`, author)
              }
            }

            if (author) {
              const message: Message = {
                id: msg.id,
                channel_id: msg.channel_id,
                server_id: msg.server_id,
                author_id: msg.author_id,
                content: msg.content,
                message_type: msg.message_type,
                attachments: msg.attachments || [],
                embeds: msg.embeds || [],
                reactions: [],
                reply_to: msg.reply_to,
                edited_at: msg.edited_at,
                created_at: msg.created_at,
                updated_at: msg.updated_at,
                author,
              }

              console.log(`🚀 CALLING onInsert callback with message:`, message.content)
              callbacks.onInsert(message)
            } else {
              console.error(`❌ No author found for message: ${msg.id}`)
            }
          }

          if (payload.eventType === "UPDATE" && callbacks.onUpdate) {
            const msg = payload.new
            console.log(`✏️ Processing UPDATE event:`, msg)

            let author = this.authorCache.get(msg.author_id)
            if (!author) {
              const { data } = await this.supabase
                .from("profiles")
                .select("id, name, username, pfp_url")
                .eq("id", msg.author_id)
                .single()

              if (data) {
                author = {
                  id: data.id,
                  name: data.name,
                  username: data.username,
                  avatar: data.pfp_url || "",
                  rank: "Holder",
                }
                this.authorCache.set(data.id, author)
              }
            }

            if (author) {
              const message: Message = {
                id: msg.id,
                channel_id: msg.channel_id,
                server_id: msg.server_id,
                author_id: msg.author_id,
                content: msg.content,
                message_type: msg.message_type,
                attachments: msg.attachments || [],
                embeds: msg.embeds || [],
                reactions: [],
                reply_to: msg.reply_to,
                edited_at: msg.edited_at,
                created_at: msg.created_at,
                updated_at: msg.updated_at,
                author,
              }

              // Update reply cache
              if (this.replyCache.has(msg.id)) {
                this.replyCache.set(msg.id, message)
              }

              callbacks.onUpdate(message)
            }
          }

          if (payload.eventType === "DELETE" && callbacks.onDelete) {
            console.log(`🗑️ Processing DELETE event:`, payload.old.id)
            this.replyCache.delete(payload.old.id)
            callbacks.onDelete(payload.old.id)
          }
        },
      )
      .subscribe((status, err) => {
        console.log(`📡 Subscription status for ${channelId}:`, status)
        if (err) {
          console.error(`❌ Subscription error for ${channelId}:`, err)
        }
        if (status === "SUBSCRIBED") {
          console.log(`✅ SUCCESSFULLY SUBSCRIBED to real-time updates for ${channelId}`)
        } else if (status === "CHANNEL_ERROR") {
          console.error(`❌ CHANNEL ERROR for ${channelId}`)
        } else if (status === "TIMED_OUT") {
          console.error(`⏰ SUBSCRIPTION TIMED OUT for ${channelId}`)
        } else if (status === "CLOSED") {
          console.log(`🔒 SUBSCRIPTION CLOSED for ${channelId}`)
        }
      })

    this.subscriptions.set(channelId, subscription)
    return subscription
  }

  // Clean up subscriptions
  unsubscribeFromChannel(channelId: string) {
    console.log(`🔌 Unsubscribing from channel: ${channelId}`)
    const subscription = this.subscriptions.get(channelId)
    if (subscription) {
      subscription.unsubscribe()
      this.subscriptions.delete(channelId)
      console.log(`✅ Successfully unsubscribed from ${channelId}`)
    }
  }

  // Clean up all subscriptions
  cleanup() {
    console.log(`🧹 Cleaning up all subscriptions`)
    this.subscriptions.forEach((subscription, channelId) => {
      console.log(`🔌 Unsubscribing from ${channelId}`)
      subscription.unsubscribe()
    })
    this.subscriptions.clear()
    this.messageCache.clear()
    this.replyCache.clear()
  }
}

// Singleton instance
export const messagesService = new OptimizedMessagesService()
