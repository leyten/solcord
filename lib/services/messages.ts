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
  private clearCacheForChannel(channelId: string, serverId: string) {
    const keysToDelete = Array.from(this.messageCache.keys()).filter((key) =>
      key.startsWith(`${serverId}-${channelId}-`),
    )
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

  // Get messages with intelligent caching - NOW SERVER-AWARE
  async getChannelMessages(
    channelId: string,
    serverId: string,
    limit = 25,
    before?: string,
    currentUserId?: string,
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const cacheKey = `${serverId}-${channelId}-${before || "latest"}-${limit}`

    // Check cache first
    if (this.messageCache.has(cacheKey)) {
      return {
        messages: this.messageCache.get(cacheKey)!,
        hasMore: this.messageCache.get(cacheKey)!.length === limit,
      }
    }

    try {

      // Fetch messages - FILTER BY BOTH SERVER AND CHANNEL
      let query = this.supabase
        .from("messages")
        .select("*")
        .eq("server_id", serverId) // 🔥 SERVER FILTER
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
      const transformedMessages: Message[] = []

      for (const msg of messages.reverse()) {
        transformedMessages.push({
          id: msg.id,
          channel_id: msg.channel_id,
          server_id: msg.server_id,
          author_id: msg.author_id,
          content: msg.content,
          message_type: msg.message_type,
          attachments: msg.attachments || [],
          embeds: msg.embeds || [],
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
        })
      }

      // Cache the result
      this.messageCache.set(cacheKey, transformedMessages)

      return { messages: transformedMessages, hasMore }
    } catch (error) {
      console.error("Error in getChannelMessages:", error)
      return { messages: [], hasMore: false }
    }
  }

  // Send message with spam prevention - NOW SERVER-AWARE AND OPTIMISTIC
  async sendMessage(
    channelId: string,
    serverId: string,
    authorId: string,
    data: SendMessageData,
    authToken?: string,
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

      // Get or create author info FIRST
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

      // Create optimistic message FIRST
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`, // Temporary ID
        channel_id: channelId,
        server_id: serverId,
        author_id: authorId,
        content: data.content || "",
        message_type: data.attachments?.length ? "image" : embeds.length ? "embed" : "text",
        attachments: data.attachments || [],
        embeds: embeds,
        reply_to: data.reply_to || undefined,
        edited_at: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: author || {
          id: authorId,
          name: "Unknown User",
          username: "unknown",
          avatar: "",
          rank: "Holder",
        },
      }

      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify({
          channelId,
          serverId,
          content: data.content || null,
          messageType: data.attachments?.length ? "image" : embeds.length ? "embed" : "text",
          attachments: data.attachments || null,
          embeds: embeds.length > 0 ? embeds : null,
          replyTo: data.reply_to || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("❌ API error sending message:", errorData)
        return {
          success: false,
          error: errorData.error || "Failed to send message",
        }
      }

      const { message: newMessage } = await response.json()

      // Record message for spam prevention
      spamPreventionService.recordMessage(authorId, data.content || "")

      // Clear cache for this channel
      this.clearCacheForChannel(channelId, serverId)

      // Return successful message with REAL ID
      const finalMessage: Message = {
        ...optimisticMessage,
        id: newMessage.id,
        created_at: newMessage.created_at,
        updated_at: newMessage.updated_at,
      }

      return {
        success: true,
        message: finalMessage,
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
  async editMessage(messageId: string, content: string, authToken?: string): Promise<boolean> {
    try {
      const response = await fetch("/api/messages/edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify({ messageId, content }),
      })

      if (!response.ok) {
        console.error("Error editing message via API")
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
  async deleteMessage(messageId: string, authToken?: string): Promise<boolean> {
    try {
      const response = await fetch("/api/messages/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify({ messageId }),
      })

      if (!response.ok) {
        console.error("Error deleting message via API")
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

  // REAL-TIME SUBSCRIPTION - BACK TO SIMPLE VERSION THAT WORKED
  subscribeToChannel(
    channelId: string,
    serverId: string,
    callbacks: {
      onInsert?: (message: Message) => void
      onUpdate?: (message: Message) => void
      onDelete?: (messageId: string) => void
    },
  ) {
    const subscriptionKey = `${serverId}-${channelId}`

    if (this.subscriptions.has(subscriptionKey)) {
      const existingSub = this.subscriptions.get(subscriptionKey)
      try {
        existingSub.unsubscribe()
      } catch (error) {
        console.error("Error cleaning up existing subscription:", error)
      }
      this.subscriptions.delete(subscriptionKey)
    }


    // Create a completely fresh subscription
    const channelName = `realtime_messages_${serverId}_${channelId}_${Math.random().toString(36).substring(7)}`

    const subscription = this.supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events
          schema: "public",
          table: "messages",
          filter: `server_id=eq.${serverId}.and.channel_id=eq.${channelId}`, // 🔥 FILTER BY BOTH
        },
        async (payload) => {

          if (payload.eventType === "INSERT" && callbacks.onInsert) {
            const msg = payload.new

            // Get author info
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
                reply_to: msg.reply_to,
                edited_at: msg.edited_at,
                created_at: msg.created_at,
                updated_at: msg.updated_at,
                author,
              }

              callbacks.onInsert(message)
            } else {
              console.error(`❌ No author found for message: ${msg.id}`)
            }
          }

          if (payload.eventType === "UPDATE" && callbacks.onUpdate) {
            const msg = payload.new

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
            this.replyCache.delete(payload.old.id)
            callbacks.onDelete(payload.old.id)
          }
        },
      )
      .subscribe((status, err) => {
        if (err) {
          console.error(`❌ Subscription error for ${serverId}/${channelId}:`, err)
        }
        if (status === "SUBSCRIBED") {
        } else if (status === "CHANNEL_ERROR") {
          console.error(`❌ CHANNEL ERROR for ${serverId}/${channelId}`)
        } else if (status === "TIMED_OUT") {
          console.error(`⏰ SUBSCRIPTION TIMED OUT for ${serverId}/${channelId}`)
        } else if (status === "CLOSED") {
        }
      })

    this.subscriptions.set(subscriptionKey, subscription)
    return subscription
  }

  unsubscribeFromChannel(channelId: string, serverId: string) {
    const subscriptionKey = `${serverId}-${channelId}`
    const subscription = this.subscriptions.get(subscriptionKey)
    if (subscription) {
      try {
        subscription.unsubscribe()
      } catch (error) {
        console.error(`Error unsubscribing from ${subscriptionKey}:`, error)
      }
      this.subscriptions.delete(subscriptionKey)
    }
  }

  cleanup() {
    this.subscriptions.forEach((subscription, key) => {
      try {
        subscription.unsubscribe()
      } catch (error) {
        console.error(`Error unsubscribing from ${key}:`, error)
      }
    })
    this.subscriptions.clear()
    this.messageCache.clear()
    this.replyCache.clear()
  }
}

// Singleton instance
export const messagesService = new OptimizedMessagesService()
