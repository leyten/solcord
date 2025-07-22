import { createClient } from "@/lib/supabase/client"
import type { ChannelUser } from "@/lib/types"
import type { RealtimeChannel } from "@supabase/supabase-js"

const supabase = createClient()

class MembersService {
  private subscriptions = new Map<string, RealtimeChannel>()
  private memberCache = new Map<string, ChannelUser[]>()
  private subscriberCallbacks = new Map<string, (members: ChannelUser[]) => void>()

  async getServerMembers(serverId: string): Promise<ChannelUser[]> {
    try {
      console.log(`👥 Fetching server members for: ${serverId}`)

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, username, name, pfp_url, status, updated_at")
        .order("name")

      if (error) {
        console.error("❌ Error fetching server members:", error)
        return []
      }

      const members = profiles.map((profile: any) => ({
        id: profile.id,
        name: profile.name || profile.username || "Unknown User",
        online: profile.status === "online",
        activity: profile.status === "online" ? "Active" : profile.status === "dnd" ? "Do Not Disturb" : undefined,
        lastSeen: profile.status === "online" ? "now" : this.formatLastSeen(profile.updated_at),
        avatar: profile.pfp_url || "",
        status: profile.status || "offline",
      }))

      console.log(`✅ Fetched ${members.length} members, online: ${members.filter((m) => m.online).length}`)

      // Cache the members
      this.memberCache.set(serverId, members)
      return members
    } catch (error) {
      console.error("❌ Failed to fetch server members:", error)
      return []
    }
  }

  // Force refresh members and notify all subscribers
  async forceRefreshMembers(serverId: string): Promise<ChannelUser[]> {
    console.log(`🔄 Force refreshing members for server: ${serverId}`)
    const members = await this.getServerMembers(serverId)

    // Notify all active subscriptions for this server
    this.notifySubscribers(serverId, members)

    return members
  }

  private notifySubscribers(serverId: string, members: ChannelUser[]) {
    const callback = this.subscriberCallbacks.get(serverId)
    if (callback) {
      console.log(`📢 Notifying subscribers for server ${serverId} with ${members.length} members`)
      callback(members)
    }
  }

  subscribeToMemberUpdates(serverId: string, callback: (members: ChannelUser[]) => void): RealtimeChannel {
    console.log(`🔌 Setting up real-time subscription for server members: ${serverId}`)

    // Store the callback for manual notifications
    this.subscriberCallbacks.set(serverId, callback)

    // Clean up existing subscription if any
    const existingSubscription = this.subscriptions.get(serverId)
    if (existingSubscription) {
      console.log(`🧹 Cleaning up existing subscription for server: ${serverId}`)
      supabase.removeChannel(existingSubscription)
    }

    // Create unique channel name with timestamp
    const channelName = `server-members-${serverId}-${Date.now()}`
    console.log(`📡 Creating real-time channel: ${channelName}`)

    const subscription = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "profiles",
        },
        async (payload: any) => {
          console.log(`🔄 Real-time profiles change detected:`, {
            eventType: payload.eventType,
            userId: payload.new?.id || payload.old?.id,
            newStatus: payload.new?.status,
            oldStatus: payload.old?.status,
          })

          // Get fresh data from database
          const updatedMembers = await this.getServerMembers(serverId)

          // Notify the callback
          callback(updatedMembers)
        },
      )
      .subscribe((status, err) => {
        console.log(`📡 Subscription status for ${channelName}:`, status)

        if (err) {
          console.error(`❌ Subscription error for ${channelName}:`, err)
        }

        if (status === "SUBSCRIBED") {
          console.log(`✅ Successfully subscribed to member updates for server: ${serverId}`)
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`❌ Subscription failed for server ${serverId}, attempting reconnect...`)
          this.handleReconnect(serverId, callback)
        }
      })

    this.subscriptions.set(serverId, subscription)

    // Set up a heartbeat to ensure connection stays alive
    this.setupHeartbeat(serverId, callback)

    return subscription
  }

  private handleReconnect(serverId: string, callback: (members: ChannelUser[]) => void) {
    console.log(`🔄 Attempting to reconnect member subscription for server: ${serverId}`)

    setTimeout(() => {
      this.subscribeToMemberUpdates(serverId, callback)
    }, 2000)
  }

  private setupHeartbeat(serverId: string, callback: (members: ChannelUser[]) => void) {
    console.log(`💓 Setting up heartbeat for server: ${serverId}`)

    // Refresh every 30 seconds as a fallback
    const heartbeatInterval = setInterval(async () => {
      const subscription = this.subscriptions.get(serverId)
      if (!subscription) {
        console.log(`💓 Heartbeat stopped for server ${serverId} - no subscription`)
        clearInterval(heartbeatInterval)
        return
      }

      console.log(`💓 Heartbeat refresh for server: ${serverId}`)
      const members = await this.getServerMembers(serverId)
      callback(members)
    }, 30000)

    // Store interval for cleanup
    ;(this.subscriptions.get(serverId) as any)._heartbeatInterval = heartbeatInterval
  }

  unsubscribeFromMemberUpdates(subscription: RealtimeChannel): void {
    if (subscription) {
      console.log(`🔌 Unsubscribing from member updates`)

      // Clean up intervals
      const heartbeatInterval = (subscription as any)._heartbeatInterval

      if (heartbeatInterval) {
        console.log(`🧹 Cleaning up heartbeat interval`)
        clearInterval(heartbeatInterval)
      }

      supabase.removeChannel(subscription)
    }
  }

  private formatLastSeen(timestamp: string): string {
    const now = new Date()
    const lastSeen = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return "just now"
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }
}

export const membersService = new MembersService()
