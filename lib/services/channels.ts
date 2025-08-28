import { createClient } from "@/lib/supabase/client"
import type { ChannelSection } from "@/lib/types"

export interface DatabaseChannel {
  id: string
  server_id: string
  name: string
  type: "text" | "voice" | "feed"
  description: string | null
  position: number
  created_at: string
  updated_at: string
  min_token_percentage: number | null
}

class ChannelsService {
  private supabase = createClient()
  private channelCache = new Map<string, ChannelSection[]>()

  async getServerChannels(serverId: string): Promise<ChannelSection[]> {
    try {
      // Check cache first
      if (this.channelCache.has(serverId)) {
        return this.channelCache.get(serverId)!
      }

      console.log(`📋 Fetching channels for server: ${serverId}`)

      const { data: channels, error } = await this.supabase
        .from("channels")
        .select("*")
        .eq("server_id", serverId)
        .order("position")

      if (error) {
        console.error("❌ Error fetching channels:", error)
        return []
      }

      if (!channels || channels.length === 0) {
        console.log(`⚠️ No channels found for server ${serverId}, creating defaults`)
        return await this.createDefaultChannels(serverId)
      }

      // Group channels by section
      const channelSections = this.groupChannelsBySection(channels)

      // Cache the result
      this.channelCache.set(serverId, channelSections)

      console.log(`✅ Loaded ${channels.length} channels for server ${serverId}`)
      return channelSections
    } catch (error) {
      console.error("❌ Failed to fetch server channels:", error)
      return []
    }
  }

  private groupChannelsBySection(channels: DatabaseChannel[]): ChannelSection[] {
    // For now, group by type since we don't have section_label
    const feedChannels = channels.filter((ch) => ch.type === "feed")
    const textChannels = channels.filter((ch) => ch.type === "text")
    const voiceChannels = channels.filter((ch) => ch.type === "voice")

    const sections: ChannelSection[] = []

    if (feedChannels.length > 0) {
      sections.push({
        label: "Feed",
        channels: feedChannels.map((ch) => ({
          id: ch.name,
          name: ch.name,
          type: ch.type,
          description: ch.description || "No description",
          minTokenPercentage: ch.min_token_percentage || undefined,
        })),
      })
    }

    if (textChannels.length > 0 || voiceChannels.length > 0) {
      sections.push({
        label: "General",
        channels: [...textChannels, ...voiceChannels].map((ch) => ({
          id: ch.name,
          name: ch.name,
          type: ch.type,
          description: ch.description || "No description",
          minTokenPercentage: ch.min_token_percentage || undefined,
        })),
      })
    }

    return sections
  }

  async createDefaultChannels(serverId: string): Promise<ChannelSection[]> {
    try {
      console.log(`🏗️ Creating default channels for server: ${serverId}`)

      // First ensure the server exists
      const { data: serverExists } = await this.supabase.from("servers").select("id").eq("id", serverId).single()

      if (!serverExists) {
        console.log(`⚠️ Server ${serverId} doesn't exist, creating it first`)
        const { error: serverError } = await this.supabase.from("servers").insert({
          id: serverId,
          name: serverId === "solcord" ? "Solcord" : serverId,
          description: serverId === "solcord" ? "The original Solcord community server" : `Server for ${serverId}`,
          logo_url: serverId === "solcord" ? "/solcord-logo.png" : null,
        })

        if (serverError) {
          console.error("❌ Error creating server:", serverError)
          return []
        }
      }

      const defaultChannels = [
        // Feed section
        { name: "feed", type: "feed", description: "Community social feed", position: 0 },
        {
          name: "announcements",
          type: "feed",
          description: "Official announcements and updates",
          position: 1,
        },
        // General section
        {
          name: "general",
          type: "text",
          description: "General discussion about anything",
          position: 2,
        },
        {
          name: "trading",
          type: "text",
          description: "Trading discussion and analysis",
          position: 3,
        },
        {
          name: "1%+ holders",
          type: "text",
          description: "Exclusive chat for 1%+ token holders",
          position: 4,
          min_token_percentage: 1.0,
        },
        {
          name: "general-voice",
          type: "voice",
          description: "General voice chat",
          position: 5,
        },
      ]

      const channelsToInsert = defaultChannels.map((channel) => ({
        server_id: serverId,
        ...channel,
      }))

      const { data: insertedChannels, error } = await this.supabase
        .from("channels")
        .insert(channelsToInsert)
        .select("*")

      if (error) {
        console.error("❌ Error creating default channels:", error)
        console.error("Error details:", error)
        return []
      }

      console.log(`✅ Created ${insertedChannels?.length || 0} default channels for server ${serverId}`)

      // Clear cache and return fresh data
      this.channelCache.delete(serverId)
      return await this.getServerChannels(serverId)
    } catch (error) {
      console.error("❌ Failed to create default channels:", error)
      return []
    }
  }

  async createChannel(
    serverId: string,
    channelData: {
      name: string
      type: "text" | "voice" | "feed"
      description?: string
      min_token_percentage?: number
    },
  ): Promise<DatabaseChannel | null> {
    try {
      // Get the next position
      const { data: existingChannels } = await this.supabase
        .from("channels")
        .select("position")
        .eq("server_id", serverId)
        .order("position", { ascending: false })
        .limit(1)

      const nextPosition = (existingChannels?.[0]?.position || 0) + 1

      const { data: newChannel, error } = await this.supabase
        .from("channels")
        .insert({
          server_id: serverId,
          name: channelData.name,
          type: channelData.type,
          description: channelData.description || null,
          position: nextPosition,
          min_token_percentage: channelData.min_token_percentage || null,
        })
        .select("*")
        .single()

      if (error) {
        console.error("❌ Error creating channel:", error)
        return null
      }

      // Clear cache for this server
      this.channelCache.delete(serverId)

      return newChannel
    } catch (error) {
      console.error("❌ Failed to create channel:", error)
      return null
    }
  }

  // Clear cache when needed
  clearCache(serverId?: string) {
    if (serverId) {
      this.channelCache.delete(serverId)
    } else {
      this.channelCache.clear()
    }
  }

  // Subscribe to channel changes
  subscribeToChannelUpdates(serverId: string, callback: (channels: ChannelSection[]) => void) {
    return this.supabase
      .channel(`channels_${serverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channels",
          filter: `server_id=eq.${serverId}`,
        },
        async () => {
          // Clear cache and fetch fresh data
          this.channelCache.delete(serverId)
          const channels = await this.getServerChannels(serverId)
          callback(channels)
        },
      )
      .subscribe()
  }
}

export const channelsService = new ChannelsService()
