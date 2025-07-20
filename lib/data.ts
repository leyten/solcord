import type { Server, ChannelSection, ChannelUser } from "./types"

// A single, default server for all users
export const servers: Server[] = [
  {
    id: "solcord",
    name: "SolCord",
    logo: "/solcord-logo.png",
  },
]

// Default channels for the SolCord server
export const channelsByServer: { [key: string]: ChannelSection[] } = {
  solcord: [
    {
      label: "Feed",
      channels: [
        {
          id: "feed",
          name: "feed",
          type: "feed",
          description: "Community social feed",
        },
        {
          id: "announcements",
          name: "announcements",
          type: "feed",
          description: "Official announcements and updates",
        },
      ],
    },
    {
      label: "General",
      channels: [
        {
          id: "general",
          name: "general",
          type: "text",
          description: "General discussion about anything",
        },
        {
          id: "general-voice",
          name: "general voice",
          type: "voice",
          description: "General voice chat",
        },
      ],
    },
  ],
}

// Mock users for channels (you can remove this later when implementing real user lists)
export const usersByChannel: { [key: string]: ChannelUser[] } = {
  general: [
    {
      id: "1",
      name: "alice",
      online: true,
      activity: "Playing Solana DeFi",
      lastSeen: "now",
    },
    {
      id: "2",
      name: "bob",
      online: false,
      lastSeen: "2 hours ago",
    },
  ],
}
