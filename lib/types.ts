export interface Server {
  icon: any
  id: string
  name: string
  logo: string
}

export interface Channel {
  id: string
  name: string
  type: "text" | "voice" | "trade" | "feed"
  description: string
  requiredRank?: string
  minTokenPercentage?: number // Added token percentage requirement for VIP channels
}

export interface ChannelSection {
  label: string
  channels: Channel[]
}

export interface User {
  id: string
  name: string
  username: string
  avatar: string
  rank?: string
}

export interface MessageAttachment {
  id: string
  filename: string
  size: number
  content_type: string
  url: string
  width?: number
  height?: number
}

export interface MessageEmbed {
  type: "link" | "image" | "video"
  url: string
  title?: string
  description?: string
  thumbnail?: string
  author?: string
  site_name?: string
  width?: number
  height?: number
}

export interface Message {
  id: string
  channel_id: string
  server_id: string
  author_id: string
  content: string | null
  message_type: "text" | "image" | "file" | "embed" | "system"
  attachments?: MessageAttachment[]
  embeds?: MessageEmbed[]
  reply_to?: string
  edited_at?: string
  created_at: string
  updated_at: string
  author: User
}

export interface ChannelUser {
  id: string
  name: string
  online: boolean
  activity?: string
  lastSeen: string
  avatar?: string
  status?: "online" | "dnd" | "offline" // Add status field
}
