export interface MessageAttachment {
  id: string
  filename: string
  size: number
  content_type: string
  url: string
  width?: number
  height?: number
  thumbnail_url?: string
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

export interface MessageReaction {
  emoji: string
  count: number
  users: string[]
  reacted: boolean
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
  reactions?: MessageReaction[]
  reply_to?: string
  edited_at?: string
  created_at: string
  updated_at: string
  author: {
    id: string
    name: string
    username: string
    avatar: string
    rank?: string
  }
}

export interface SendMessageData {
  content?: string
  attachments?: MessageAttachment[]
  embeds?: MessageEmbed[]
  reply_to?: string
}
