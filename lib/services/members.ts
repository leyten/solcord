import { createClient } from "@/lib/supabase/client"
import type { ChannelUser } from "@/lib/types"
import type { RealtimeChannel } from "@supabase/supabase-js"

const supabase = createClient()

// GLOBAL SINGLETON STATE - ONLY ONE SERVER CAN BE ACTIVE
let ACTIVE_SERVER_ID: string | null = null
let ACTIVE_CALLBACK: ((members: ChannelUser[]) => void) | null = null
let ACTIVE_SUBSCRIPTION: RealtimeChannel | null = null
let ACTIVE_HEARTBEAT: NodeJS.Timeout | null = null

class MembersService {
  private memberCache = new Map<string, ChannelUser[]>()

  async getServerMembers(serverId: string): Promise<ChannelUser[]> {
    try {

      // Check if this is the default Solcord server - show all users
      if (serverId === "solcord") {
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, username, name, pfp_url, status, updated_at")
          .order("name")

        if (error) {
          console.error("❌ Error fetching Solcord members:", error)
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

        this.memberCache.set(serverId, members)
        return members
      }

      // For token servers, only show members who have joined that specific server
      const { data: serverMembers, error } = await supabase
        .from("server_memberships")
        .select(`
          user_id,
          role,
          joined_at,
          profiles!server_memberships_user_id_fkey (
            id,
            username,
            name,
            pfp_url,
            status,
            updated_at
          )
        `)
        .eq("server_id", serverId)
        .order("joined_at", { ascending: true })

      if (error) {
        console.error("❌ Error fetching server members:", error)
        return []
      }

      const members = (serverMembers || [])
        .filter((membership: any) => membership.profiles)
        .map((membership: any) => ({
          id: membership.profiles.id,
          name: membership.profiles.name || membership.profiles.username || "Unknown User",
          online: membership.profiles.status === "online",
          activity:
            membership.profiles.status === "online"
              ? "Active"
              : membership.profiles.status === "dnd"
                ? "Do Not Disturb"
                : undefined,
          lastSeen:
            membership.profiles.status === "online" ? "now" : this.formatLastSeen(membership.profiles.updated_at),
          avatar: membership.profiles.pfp_url || "",
          status: membership.profiles.status || "offline",
        }))



      this.memberCache.set(serverId, members)
      return members
    } catch (error) {
      console.error("❌ Failed to fetch server members:", error)
      return []
    }
  }

  async forceRefreshMembers(serverId: string): Promise<ChannelUser[]> {
    const members = await this.getServerMembers(serverId)

    if (ACTIVE_SERVER_ID === serverId && ACTIVE_CALLBACK) {
      ACTIVE_CALLBACK(members)
    }

    return members
  }

  subscribeToMemberUpdates(serverId: string, callback: (members: ChannelUser[]) => void): RealtimeChannel {

    // KILL EVERYTHING FIRST
    this.destroyEverything()

    // SET NEW ACTIVE STATE
    ACTIVE_SERVER_ID = serverId
    ACTIVE_CALLBACK = callback


    // CREATE SUBSCRIPTION
    const channelName = `members-${serverId}-${Date.now()}`

    const subscription = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        async (payload: any) => {
          // ONLY process if this is STILL the active server
          if (ACTIVE_SERVER_ID !== serverId) {
            return
          }

          const updatedMembers = await this.getServerMembers(serverId)

          if (ACTIVE_CALLBACK && ACTIVE_SERVER_ID === serverId) {
            ACTIVE_CALLBACK(updatedMembers)
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "server_memberships",
          filter: `server_id=eq.${serverId}`,
        },
        async (payload: any) => {
          // ONLY process if this is STILL the active server
          if (ACTIVE_SERVER_ID !== serverId) {
            return
          }

          const updatedMembers = await this.getServerMembers(serverId)

          if (ACTIVE_CALLBACK && ACTIVE_SERVER_ID === serverId) {
            ACTIVE_CALLBACK(updatedMembers)
          }
        },
      )
      .subscribe((status, err) => {
        if (err) {
          console.error(`❌ Subscription error:`, err)
        }
        if (status === "SUBSCRIBED") {
        }
      })

    ACTIVE_SUBSCRIPTION = subscription

    // START HEARTBEAT
    this.startHeartbeat()

    return subscription
  }

  private startHeartbeat() {

    ACTIVE_HEARTBEAT = setInterval(async () => {
      if (!ACTIVE_SERVER_ID) {
        if (ACTIVE_HEARTBEAT) {
          clearInterval(ACTIVE_HEARTBEAT)
          ACTIVE_HEARTBEAT = null
        }
        return
      }

      const members = await this.getServerMembers(ACTIVE_SERVER_ID)

      if (ACTIVE_CALLBACK) {
        ACTIVE_CALLBACK(members)
      }
    }, 30000)
  }

  private destroyEverything() {

    // Kill heartbeat
    if (ACTIVE_HEARTBEAT) {
      clearInterval(ACTIVE_HEARTBEAT)
      ACTIVE_HEARTBEAT = null
    }

    // Kill subscription
    if (ACTIVE_SUBSCRIPTION) {
      try {
        supabase.removeChannel(ACTIVE_SUBSCRIPTION)
      } catch (error) {
        console.error("Error removing subscription:", error)
      }
      ACTIVE_SUBSCRIPTION = null
    }

    // Clear state
    ACTIVE_SERVER_ID = null
    ACTIVE_CALLBACK = null

  }

  unsubscribeFromMemberUpdates(subscription: RealtimeChannel): void {
    this.destroyEverything()
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
