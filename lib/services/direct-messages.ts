import { createClient } from "@/lib/supabase/client"
import type { MessageAttachment } from "@/lib/types/messages"

export interface DMMessage {
  id: string
  conversation_id: string
  sender_id: string
  recipient_id: string
  content: string
  created_at: string
  read_at?: string
  attachments?: MessageAttachment[]
  sender?: {
    id: string
    name: string
    username: string
    avatar: string
  }
  // Add optimistic update fields
  isOptimistic?: boolean
  isFailed?: boolean
}

export interface DMConversation {
  id: string
  other_user_id: string
  other_user_name: string
  other_user_username: string
  other_user_pfp_url: string
  other_user_status: "online" | "dnd" | "offline"
  last_message: string
  last_message_at: string
  unread_count: number
  created_at: string
}

export class DirectMessagesService {
  private supabase = createClient()
  private messageSubscription: any = null
  private conversationSubscription: any = null

  // Get user's conversations
  async getUserConversations(userId: string): Promise<DMConversation[]> {
    try {
      console.log("🔍 Fetching conversations for user:", userId)

      const { data, error } = await this.supabase.rpc("get_user_conversations", {
        input_user_id: userId,
      })

      if (error) {
        console.error("Error fetching conversations:", error)
        return []
      }

      console.log("📋 Raw conversation data:", data)

      return (data || []).map((conv: any) => ({
        id: conv.id,
        other_user_id: conv.other_user_id,
        other_user_name: conv.other_user_name,
        other_user_username: conv.other_user_username,
        other_user_pfp_url: conv.other_user_pfp_url || "",
        other_user_status: conv.other_user_status as "online" | "dnd" | "offline",
        last_message: conv.last_message,
        last_message_at: conv.last_message_at,
        unread_count: Number(conv.unread_count),
        created_at: conv.created_at,
      }))
    } catch (error) {
      console.error("Error in getUserConversations:", error)
      return []
    }
  }

  // Get messages for a conversation
  async getConversationMessages(
    userId: string,
    otherUserId: string,
    limit = 50,
    authToken?: string,
  ): Promise<DMMessage[]> {
    try {
      console.log(`🔍 Getting messages between ${userId} and ${otherUserId}`)

      const conversationId = await this.getOrCreateConversation(userId, otherUserId, authToken)

      if (!conversationId) {
        console.error("Failed to get conversation ID")
        return []
      }

      console.log(`🔍 Found conversation ID: ${conversationId}`)

      // Get messages for this conversation
      const { data: messages, error } = await this.supabase
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(limit)

      if (error) {
        console.error("Error fetching messages:", error)
        return []
      }

      console.log(`🔍 Found ${messages?.length || 0} messages`)

      if (!messages || messages.length === 0) {
        return []
      }

      // Get unique sender IDs
      const senderIds = [...new Set(messages.map((msg) => msg.sender_id))]

      // Fetch sender profiles separately
      const { data: profiles, error: profileError } = await this.supabase
        .from("profiles")
        .select("id, name, username, pfp_url")
        .in("id", senderIds)

      if (profileError) {
        console.error("Error fetching profiles:", profileError)
        // Return messages without sender info if profile fetch fails
        return messages.map((msg: any) => ({
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_id: msg.sender_id,
          recipient_id: msg.recipient_id,
          content: msg.content,
          created_at: msg.created_at,
          read_at: msg.read_at,
          attachments: msg.attachments || [],
        }))
      }

      // Create a map of profiles for quick lookup
      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || [])

      return messages.map((msg: any) => {
        const senderProfile = profileMap.get(msg.sender_id)
        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_id: msg.sender_id,
          recipient_id: msg.recipient_id,
          content: msg.content,
          created_at: msg.created_at,
          read_at: msg.read_at,
          attachments: msg.attachments || [],
          sender: senderProfile
            ? {
                id: senderProfile.id,
                name: senderProfile.name,
                username: senderProfile.username,
                avatar: senderProfile.pfp_url || "",
              }
            : undefined,
        }
      })
    } catch (error) {
      console.error("Error in getConversationMessages:", error)
      return []
    }
  }

  // Send a message with optimistic update support
  async sendMessage(
    senderId: string,
    recipientId: string,
    content: string,
    attachments?: MessageAttachment[],
    optimisticId?: string,
    authToken?: string,
  ): Promise<{ success: boolean; message?: DMMessage; error?: string; optimisticId?: string }> {
    try {
      console.log("📤 Attempting to send DM via API:", { senderId, recipientId, content, attachments, optimisticId })

      const conversationId = await this.getOrCreateConversation(senderId, recipientId, authToken)

      if (!conversationId) {
        return { success: false, error: "Failed to get conversation", optimisticId }
      }

      const response = await fetch("/api/dm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify({
          conversationId,
          content,
          attachments,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("❌ API error sending DM:", errorData)
        return { success: false, error: errorData.error || "Failed to send message", optimisticId }
      }

      const { message } = await response.json()
      console.log("✅ DM successfully sent via API:", message.id)

      return { success: true, message, optimisticId }
    } catch (error) {
      console.error("Error in sendMessage:", error)
      return { success: false, error: "Failed to send message", optimisticId }
    }
  }

  // Mark messages as read
  async markMessagesAsRead(userId: string, otherUserId: string, authToken?: string): Promise<boolean> {
    try {
      const conversationId = await this.getOrCreateConversation(userId, otherUserId, authToken)

      if (!conversationId) {
        console.error("Failed to get conversation ID")
        return false
      }

      const response = await fetch("/api/dm/mark-read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify({
          conversationId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("❌ API error marking messages as read:", errorData)
        return false
      }

      return true
    } catch (error) {
      console.error("Error in markMessagesAsRead:", error)
      return false
    }
  }

  // Upload attachment for DM
  async uploadAttachment(file: File, authorId: string): Promise<MessageAttachment | null> {
    try {
      const fileExt = file.name.split(".").pop()
      const timestamp = Date.now()
      const fileName = `dm/${authorId}/${timestamp}.${fileExt}`

      const { data, error } = await this.supabase.storage.from("message-attachments").upload(fileName, file, {
        contentType: file.type,
        cacheControl: "3600",
      })

      if (error) {
        console.error("Error uploading DM attachment:", error)
        return null
      }

      const { data: urlData } = this.supabase.storage.from("message-attachments").getPublicUrl(fileName)

      return {
        id: timestamp.toString(),
        filename: file.name,
        size: file.size,
        content_type: file.type,
        url: urlData.publicUrl,
        width: undefined,
        height: undefined,
      }
    } catch (error) {
      console.error("Error in uploadAttachment:", error)
      return null
    }
  }

  // Subscribe to real-time DM messages for a user
  subscribeToMessages(userId: string, onMessage: (message: DMMessage) => void, onConversationUpdate: () => void) {
    console.log("🔌 Setting up DM real-time subscription for user:", userId)

    // Clean up existing subscriptions
    this.cleanup()

    // Create a unique channel name
    const channelName = `dm_realtime_${userId}_${Date.now()}`
    console.log("🔌 Creating channel:", channelName)

    // Subscribe to new DM messages
    this.messageSubscription = this.supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages",
        },
        async (payload) => {
          console.log("📨 Raw DM real-time event:", payload)

          if (payload.eventType === "INSERT") {
            const message = payload.new as any
            console.log("📨 New DM message:", message)

            // Check if this message involves the current user
            if (message.sender_id === userId || message.recipient_id === userId) {
              console.log("📨 Message is for current user, processing...")

              // Fetch sender info
              const { data: sender } = await this.supabase
                .from("profiles")
                .select("id, name, username, pfp_url")
                .eq("id", message.sender_id)
                .single()

              const formattedMessage: DMMessage = {
                id: message.id,
                conversation_id: message.conversation_id,
                sender_id: message.sender_id,
                recipient_id: message.recipient_id,
                content: message.content,
                created_at: message.created_at,
                read_at: message.read_at,
                attachments: message.attachments || [],
                sender: sender
                  ? {
                      id: sender.id,
                      name: sender.name,
                      username: sender.username,
                      avatar: sender.pfp_url || "",
                    }
                  : undefined,
              }

              console.log("📨 Formatted message:", formattedMessage)
              onMessage(formattedMessage)

              // Update the conversation's last_message_id and last_message_at
              const { error: updateError } = await this.supabase
                .from("dm_conversations")
                .update({
                  last_message_id: message.id,
                  last_message_at: new Date().toISOString(),
                })
                .eq("id", message.conversation_id)

              if (updateError) {
                console.error("Error updating conversation:", updateError)
              }

              // Trigger conversation list update after a short delay to ensure DB is updated
              setTimeout(() => {
                console.log("🔄 Triggering conversation update after new message")
                onConversationUpdate()
              }, 100)
            } else {
              console.log("📨 Message not for current user, ignoring")
            }
          } else if (payload.eventType === "UPDATE") {
            console.log("📝 DM message updated (read status)")
            onConversationUpdate() // Update conversation list for read status
          }
        },
      )
      .subscribe((status) => {
        console.log("🔌 DM messages subscription status:", status)
        if (status === "SUBSCRIBED") {
          console.log("✅ DM real-time subscription active!")
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ DM subscription error")
        }
      })

    return this.messageSubscription
  }

  // Clean up subscriptions
  cleanup() {
    console.log("🧹 Cleaning up DM subscriptions")
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe()
      this.messageSubscription = null
    }
    if (this.conversationSubscription) {
      this.conversationSubscription.unsubscribe()
      this.conversationSubscription = null
    }
  }

  private async getOrCreateConversation(user1: string, user2: string, authToken?: string): Promise<string | null> {
    try {
      const response = await fetch("/api/dm/get-or-create-conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify({ user1, user2 }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("❌ API error getting conversation:", errorData)
        return null
      }

      const { conversationId } = await response.json()
      return conversationId
    } catch (error) {
      console.error("Error in getOrCreateConversation:", error)
      return null
    }
  }
}

// Singleton instance
export const dmService = new DirectMessagesService()
