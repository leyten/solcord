export interface Server {
  id: string
  name: string
  logo: string
}

export interface Channel {
  id: string
  name: string
  type: "text" | "voice" | "trade" | "feed"
  description: string
}

export interface ChannelSection {
  label: string
  channels: Channel[]
}

export interface User {
  name: string
  avatar: string
}

export interface Message {
  id: string
  text: string
  timestamp: string
  user: User
}

export interface ChannelUser {
  id: string
  name: string
  online: boolean
  activity?: string
  lastSeen: string
}
