import type { Server, ChannelSection } from "./types"

// Server data (keeping minimal structure)
export const servers: Server[] = [
  {
    id: "solcord",
    name: "Solcord",
    logo: "/solcord-logo.png",
  },
]

// Channel structure (keeping existing structure)
export const channelsByServer: Record<string, ChannelSection[]> = {
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
