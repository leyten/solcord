import { createClient } from "@/lib/supabase/client"

export interface DMMessage {
  id: string
  conversation_id: string
  sender_id: string
  recipient_id: string
  content: string
  created_at: string
  read_at?: string
  sender?: {
    id: string
    name: string
    username: string
    avatar: string
  }
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
      const { data, error } = await this.supabase.rpc("get_user_conversations", {
        input_user_id: userId,
      })

      if (error) {
        console.error("Error fetching conversations:", error)
        return []
      }

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
  async getConversationMessages(userId: string, otherUserId: string, limit = 50): Promise<DMMessage[]> {
    try {
      console.log(`🔍 Getting messages between ${userId} and ${otherUserId}`)

      // First, get or create the conversation to get the conversation_id
      const { data: conversationId, error: convError } = await this.supabase.rpc("get_or_create_conversation", {
        input_user1_id: userId,
        input_user2_id: otherUserId,
      })

      if (convError) {
        console.error("Error getting conversation:", convError)
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
      console.log("📤 Attempting to send DM:", { senderId, recipientId, content })

      // Get or create conversation
      const { data: conversationId, error: convError } = await this.supabase.rpc("get_or_create_conversation", {
        input_user1_id: senderId,
        input_user2_id: recipientId,
      })

      if (convError) {
        console.error("Error getting/creating conversation:", convError)
        return { success: false, error: "Failed to create conversation" }
      }

      console.log(`📤 Using conversation ID: ${conversationId}`)

      // Insert the message
      const { data: message, error: msgError } = await this.supabase
        .from("direct_messages")
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          recipient_id: recipientId,
          content,
        })
        .select("*")
        .single()

      if (msgError) {
        console.error("Error sending message:", msgError)
        return { success: false, error: "Failed to send message" }
      }

      console.log("✅ DM successfully inserted:", message.id)

      // Get sender profile
      const { data: senderProfile } = await this.supabase
        .from("profiles")
        .select("id, name, username, pfp_url")
        .eq("id", senderId)
        .single()

      const formattedMessage: DMMessage = {
        id: message.id,
        conversation_id: message.conversation_id,
        sender_id: message.sender_id,
        recipient_id: message.recipient_id,
        content: message.content,
        created_at: message.created_at,
        read_at: message.read_at,
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
      // Get the conversation ID first
      const { data: conversationId, error: convError } = await this.supabase.rpc("get_or_create_conversation", {
        input_user1_id: userId,
        input_user2_id: otherUserId,
      })

      if (convError) {
        console.error("Error getting conversation for read marking:", convError)
        return false
      }

      // Mark messages as read for this conversation
      const { error } = await this.supabase
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
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
              onConversationUpdate() // Update conversation list
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
}

// Singleton instance
export const dmService = new DirectMessagesService()
