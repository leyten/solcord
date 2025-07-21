import { createClient } from "@/lib/supabase/client"

export interface DMMessage {
  id: string
  sender_id: string
  recipient_id: string
  content: string
  message_type: "text" | "image" | "file"
  attachments?: any[]
  read_at?: string
  created_at: string
  updated_at: string
  sender?: {
    id: string
    name: string
    username: string
    avatar: string
  }
}

export interface DMConversation {
  conversation_id: string
  other_user_id: string
  other_user_name: string
  other_user_username: string
  other_user_avatar: string
  other_user_status: "online" | "dnd" | "offline"
  last_message: string
  last_message_at: string
  unread_count: number
}

export class DirectMessagesService {
  private supabase = createClient()
  private subscriptions = new Map<string, any>()

  // Get user's conversations
  async getUserConversations(userId: string): Promise<DMConversation[]> {
    try {
      const { data, error } = await this.supabase.rpc("get_user_conversations", {
        input_user_id: userId,
      })

      if (error) {
        console.error("Error fetching conversations:", error)
        return []
      }

      return data || []
    } catch (error) {
      console.error("Error in getUserConversations:", error)
      return []
    }
  }

  // Get messages for a conversation between two users
  async getConversationMessages(userId: string, otherUserId: string, limit = 50): Promise<DMMessage[]> {
    try {
      // First get messages with a simpler query
      const { data: messages, error } = await this.supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`,
        )
        .order("created_at", { ascending: true })
        .limit(limit)

      if (error) {
        console.error("Error fetching messages:", error)
        return []
      }

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
          sender_id: msg.sender_id,
          recipient_id: msg.recipient_id,
          content: msg.content,
          message_type: msg.message_type,
          attachments: msg.attachments,
          read_at: msg.read_at,
          created_at: msg.created_at,
          updated_at: msg.updated_at,
        }))
      }

      // Create a map of profiles for quick lookup
      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || [])

      return messages.map((msg: any) => {
        const senderProfile = profileMap.get(msg.sender_id)
        return {
          id: msg.id,
          sender_id: msg.sender_id,
          recipient_id: msg.recipient_id,
          content: msg.content,
          message_type: msg.message_type,
          attachments: msg.attachments,
          read_at: msg.read_at,
          created_at: msg.created_at,
          updated_at: msg.updated_at,
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

  // Send a message
  async sendMessage(
    senderId: string,
    recipientId: string,
    content: string,
  ): Promise<{ success: boolean; message?: DMMessage; error?: string }> {
    try {
      // Get or create conversation
      const { data: conversationId, error: convError } = await this.supabase.rpc("get_or_create_conversation", {
        user1: senderId,
        user2: recipientId,
      })

      if (convError) {
        console.error("Error getting/creating conversation:", convError)
        return { success: false, error: "Failed to create conversation" }
      }

      // Insert the message
      const { data: message, error: msgError } = await this.supabase
        .from("direct_messages")
        .insert({
          sender_id: senderId,
          recipient_id: recipientId,
          content,
          message_type: "text",
        })
        .select("*")
        .single()

      if (msgError) {
        console.error("Error sending message:", msgError)
        return { success: false, error: "Failed to send message" }
      }

      // Get sender profile
      const { data: senderProfile } = await this.supabase
        .from("profiles")
        .select("id, name, username, pfp_url")
        .eq("id", senderId)
        .single()

      // Update conversation's last message
      await this.supabase
        .from("dm_conversations")
        .update({
          last_message_id: message.id,
          last_message_at: message.created_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)

      const formattedMessage: DMMessage = {
        id: message.id,
        sender_id: message.sender_id,
        recipient_id: message.recipient_id,
        content: message.content,
        message_type: message.message_type,
        attachments: message.attachments,
        read_at: message.read_at,
        created_at: message.created_at,
        updated_at: message.updated_at,
        sender: senderProfile
          ? {
              id: senderProfile.id,
              name: senderProfile.name,
              username: senderProfile.username,
              avatar: senderProfile.pfp_url || "",
            }
          : undefined,
      }

      return { success: true, message: formattedMessage }
    } catch (error) {
      console.error("Error in sendMessage:", error)
      return { success: false, error: "Failed to send message" }
    }
  }

  // Mark messages as read
  async markMessagesAsRead(userId: string, otherUserId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("sender_id", otherUserId)
        .eq("recipient_id", userId)
        .is("read_at", null)

      if (error) {
        console.error("Error marking messages as read:", error)
        return false
      }

      return true
    } catch (error) {
      console.error("Error in markMessagesAsRead:", error)
      return false
    }
  }

  // Subscribe to new messages for a user (both sent and received)
  subscribeToUserMessages(userId: string, onMessage: (message: DMMessage) => void) {
    const channelName = `dm_messages_${userId}`

    // Clean up existing subscription
    if (this.subscriptions.has(channelName)) {
      this.subscriptions.get(channelName).unsubscribe()
    }

    const subscription = this.supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `or(sender_id.eq.${userId},recipient_id.eq.${userId})`,
        },
        async (payload) => {
          const message = payload.new as any

          // Fetch sender info
          const { data: sender } = await this.supabase
            .from("profiles")
            .select("id, name, username, pfp_url")
            .eq("id", message.sender_id)
            .single()

          const formattedMessage: DMMessage = {
            id: message.id,
            sender_id: message.sender_id,
            recipient_id: message.recipient_id,
            content: message.content,
            message_type: message.message_type,
            attachments: message.attachments,
            read_at: message.read_at,
            created_at: message.created_at,
            updated_at: message.updated_at,
            sender: sender
              ? {
                  id: sender.id,
                  name: sender.name,
                  username: sender.username,
                  avatar: sender.pfp_url || "",
                }
              : undefined,
          }

          onMessage(formattedMessage)
        },
      )
      .subscribe()

    this.subscriptions.set(channelName, subscription)
    return subscription
  }

  // Subscribe to conversation updates
  subscribeToConversations(userId: string, onUpdate: () => void) {
    const channelName = `dm_conversations_${userId}`

    // Clean up existing subscription
    if (this.subscriptions.has(channelName)) {
      this.subscriptions.get(channelName).unsubscribe()
    }

    const subscription = this.supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dm_conversations",
          filter: `or(participant_1.eq.${userId},participant_2.eq.${userId})`,
        },
        () => {
          onUpdate()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages",
        },
        () => {
          // Also update conversations when messages change
          onUpdate()
        },
      )
      .subscribe()

    this.subscriptions.set(channelName, subscription)
    return subscription
  }

  // Clean up subscriptions
  unsubscribe(channelName: string) {
    const subscription = this.subscriptions.get(channelName)
    if (subscription) {
      subscription.unsubscribe()
      this.subscriptions.delete(channelName)
    }
  }

  // Clean up all subscriptions
  cleanup() {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe())
    this.subscriptions.clear()
  }
}

// Singleton instance
export const dmService = new DirectMessagesService()
