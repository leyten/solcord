import { createClient } from "@/lib/supabase/client"
import type { ChannelUser } from "@/lib/types"
import type { RealtimeChannel } from "@supabase/supabase-js"

const supabase = createClient()

class MembersService {
  private subscriptions = new Map<string, RealtimeChannel>()
  private memberCache = new Map<string, ChannelUser[]>()
  private subscriberCallbacks = new Map<string, (members: ChannelUser[]) => void>()
  private reconnectAttempts = new Map<string, number>()

  async getServerMembers(serverId: string): Promise<ChannelUser[]> {
    try {
      console.log("🔄 Fetching server members for:", serverId)
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, username, name, pfp_url, status, updated_at")
        .order("name")

      if (error) {
        console.error("Error fetching server members:", error)
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

      console.log(
        "👥 Fetched members:",
        members.length,
        "- Online:",
        members.filter((m) => m.status === "online").length,
        "- DND:",
        members.filter((m) => m.status === "dnd").length,
        "- Offline:",
        members.filter((m) => m.status === "offline").length,
      )

      // Cache the members
      this.memberCache.set(serverId, members)
      return members
    } catch (error) {
      console.error("Failed to fetch server members:", error)
      return []
    }
  }

  // Force refresh members and notify all subscribers
  async forceRefreshMembers(serverId: string): Promise<ChannelUser[]> {
    console.log("🔄 FORCE REFRESH members for server:", serverId)
    const members = await this.getServerMembers(serverId)

    // Notify all active subscriptions for this server
    this.notifySubscribers(serverId, members)

    return members
  }

  private notifySubscribers(serverId: string, members: ChannelUser[]) {
    const callback = this.subscriberCallbacks.get(serverId)
    if (callback) {
      console.log("📢 Notifying subscribers of member changes for server:", serverId)
      callback(members)
    }
  }

  subscribeToMemberUpdates(serverId: string, callback: (members: ChannelUser[]) => void): RealtimeChannel {
    console.log("🔄 Setting up server member status subscription for server:", serverId)

    // Store the callback for manual notifications
    this.subscriberCallbacks.set(serverId, callback)

    // Clean up existing subscription if any
    const existingSubscription = this.subscriptions.get(serverId)
    if (existingSubscription) {
      console.log("🧹 Cleaning up existing subscription")
      supabase.removeChannel(existingSubscription)
    }

    const subscription = supabase
      .channel(`server-members-${serverId}-${Date.now()}`) // Add timestamp to ensure unique channel
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "profiles",
        },
        async (payload: any) => {
          console.log("👤 REALTIME: Profile changed:", {
            event: payload.eventType,
            user: payload.new?.name || payload.old?.name || payload.new?.username || payload.old?.username,
            oldStatus: payload.old?.status,
            newStatus: payload.new?.status,
          })

          // Get fresh data from database
          const updatedMembers = await this.getServerMembers(serverId)
          console.log(
            "📊 Updated member list - Online:",
            updatedMembers.filter((m) => m.status === "online").length,
            "- DND:",
            updatedMembers.filter((m) => m.status === "dnd").length,
            "- Offline:",
            updatedMembers.filter((m) => m.status === "offline").length,
          )

          // Notify the callback
          callback(updatedMembers)
        },
      )
      .subscribe((status, err) => {
        console.log("📡 Server member subscription status:", status)
        if (err) {
          console.error("❌ Subscription error:", err)
        }

        if (status === "SUBSCRIBED") {
          console.log("✅ Successfully subscribed to member updates")
          this.reconnectAttempts.set(serverId, 0)
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.log("⚠️ Subscription failed, attempting to reconnect...")
          this.handleReconnect(serverId, callback)
        }
      })

    this.subscriptions.set(serverId, subscription)

    // Set up a heartbeat to ensure connection stays alive
    this.setupHeartbeat(serverId, callback)

    return subscription
  }

  private handleReconnect(serverId: string, callback: (members: ChannelUser[]) => void) {
    const attempts = this.reconnectAttempts.get(serverId) || 0
    if (attempts < 3) {
      console.log(`🔄 Reconnection attempt ${attempts + 1}/3`)
      this.reconnectAttempts.set(serverId, attempts + 1)

      setTimeout(
        () => {
          this.subscribeToMemberUpdates(serverId, callback)
        },
        2000 * (attempts + 1),
      ) // Exponential backoff
    } else {
      console.log("❌ Max reconnection attempts reached, falling back to periodic refresh")
      this.setupPeriodicRefresh(serverId, callback)
    }
  }

  private setupHeartbeat(serverId: string, callback: (members: ChannelUser[]) => void) {
    // Refresh every 30 seconds as a fallback
    const heartbeatInterval = setInterval(async () => {
      const subscription = this.subscriptions.get(serverId)
      if (!subscription) {
        clearInterval(heartbeatInterval)
        return
      }

      console.log("💓 Heartbeat: Checking member status")
      const members = await this.getServerMembers(serverId)
      callback(members)
    }, 30000)

    // Store interval for cleanup
    ;(this.subscriptions.get(serverId) as any)._heartbeatInterval = heartbeatInterval
  }

  private setupPeriodicRefresh(serverId: string, callback: (members: ChannelUser[]) => void) {
    console.log("🔄 Setting up periodic refresh every 10 seconds")
    const refreshInterval = setInterval(async () => {
      console.log("🔄 Periodic refresh: Fetching member updates")
      const members = await this.getServerMembers(serverId)
      callback(members)
    }, 10000)

    // Store for cleanup
    ;(this.subscriptions.get(serverId) as any)._refreshInterval = refreshInterval
  }

  unsubscribeFromMemberUpdates(subscription: RealtimeChannel): void {
    if (subscription) {
      console.log("🔌 Unsubscribing from member updates")

      // Clean up intervals
      const heartbeatInterval = (subscription as any)._heartbeatInterval
      const refreshInterval = (subscription as any)._refreshInterval

      if (heartbeatInterval) clearInterval(heartbeatInterval)
      if (refreshInterval) clearInterval(refreshInterval)

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
