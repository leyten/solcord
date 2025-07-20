"use client"
import { useState } from "react"
import {
  Hash,
  Lock,
  Mic,
  Repeat,
  Crown,
  Star,
  Users,
  Send,
  Smile,
  Paperclip,
  Search,
  Bell,
  Settings,
  User,
  Zap,
  TrendingUp,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { Server, Channel, ChannelSection, Message } from "@/lib/types"

interface ChatInterfaceProps {
  server: Server
  channels: ChannelSection[]
  activeChannel: Channel
  setActiveChannel: (channel: Channel) => void
  messages: Message[]
  userRank: string | null
}

const rankHierarchy: { [key: string]: number } = {
  Whale: 3,
  "OG Holder": 2,
  Holder: 1,
}

const sectionIcons: { [key: string]: any } = {
  "Whale Zone": Crown,
  "OG Chat": Star,
  General: Users,
  Trading: TrendingUp,
}

const rankColors: { [key: string]: string } = {
  Whale: "from-purple-400 via-violet-400 to-purple-500",
  "OG Holder": "from-amber-400 via-yellow-400 to-orange-500",
  Holder: "from-blue-400 via-cyan-400 to-blue-500",
}

export function ChatInterface({
  server,
  channels,
  activeChannel,
  setActiveChannel,
  messages,
  userRank,
}: ChatInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const userLevel = userRank ? rankHierarchy[userRank] : 0

  const canAccessChannel = (channel: Channel) => {
    if (!channel.requiredRank) return true
    const requiredLevel = rankHierarchy[channel.requiredRank]
    return userLevel >= requiredLevel
  }

  return (
    <div className="flex-1 flex gap-6">
      {/* Channel Sidebar - Floating Card */}
      <div className="w-80">
        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl h-full flex flex-col overflow-hidden">
          {/* Server Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse"></div>
                <h1 className="font-bold text-white text-xl bg-gradient-to-r from-white to-white/80 bg-clip-text">
                  {server.name}
                </h1>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-white/40 hover:text-white/80 hover:bg-white/10 rounded-xl transition-all duration-300">
                  <Bell size={18} />
                </button>
                <button className="p-2 text-white/40 hover:text-white/80 hover:bg-white/10 rounded-xl transition-all duration-300">
                  <Settings size={18} />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                placeholder="Search channels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder-white/40 rounded-xl focus:border-violet-500/50 focus:ring-violet-500/20"
              />
            </div>
          </div>

          {/* Channels */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {channels.map((section) => {
              const SectionIcon = sectionIcons[section.label] || Users
              return (
                <div key={section.label}>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-gradient-to-br from-white/10 to-white/5 rounded-xl">
                      <SectionIcon className="w-4 h-4 text-white/60" />
                    </div>
                    <h2 className="text-sm font-bold text-white/80 tracking-wide">{section.label}</h2>
                  </div>

                  <div className="space-y-2">
                    {section.channels.map((channel) => {
                      const isAccessible = canAccessChannel(channel)
                      const Icon = channel.type === "text" ? Hash : channel.type === "voice" ? Mic : Repeat
                      const isActive = activeChannel.id === channel.id

                      return (
                        <TooltipProvider key={channel.id}>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => isAccessible && setActiveChannel(channel)}
                                disabled={!isAccessible}
                                className={`w-full flex items-center px-4 py-3 rounded-2xl group transition-all duration-300 ${
                                  isActive
                                    ? "bg-gradient-to-r from-violet-500/20 to-cyan-500/20 text-white border border-violet-500/30 shadow-lg shadow-violet-500/10"
                                    : isAccessible
                                      ? "text-white/70 hover:bg-white/5 hover:text-white"
                                      : "text-white/30 cursor-not-allowed"
                                }`}
                              >
                                <Icon className={`w-5 h-5 mr-3 ${isActive ? "text-violet-400" : "text-white/50"}`} />
                                <span className="truncate font-medium">{channel.name}</span>
                                {!isAccessible && <Lock className="w-4 h-4 ml-auto text-white/30" />}
                                {isActive && <Zap className="w-4 h-4 ml-auto text-violet-400 animate-pulse" />}
                              </button>
                            </TooltipTrigger>
                            {!isAccessible && (
                              <TooltipContent className="bg-black/90 backdrop-blur-xl border-red-500/20 text-white">
                                <p>Requires {channel.requiredRank} status</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* User Status */}
          <div className="p-6 border-t border-white/10">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 p-0.5">
                  <div className="w-full h-full rounded-2xl bg-black/60 flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-r from-green-400 to-emerald-500 border-2 border-black rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                </div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white">User#1234</p>
                <div
                  className={`inline-flex px-2 py-1 rounded-full text-xs font-medium text-white bg-gradient-to-r ${rankColors[userRank || "Holder"]}`}
                >
                  {userRank}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1">
        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl h-full flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-br from-violet-500/20 to-cyan-500/20 rounded-2xl">
                  <Hash className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-2xl">{activeChannel.name}</h2>
                  <p className="text-white/60 text-sm">{activeChannel.description}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="px-3 py-1 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-full border border-green-500/30">
                  <span className="text-green-400 text-sm font-medium">1,247 online</span>
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="group hover:bg-white/5 -mx-6 px-6 py-4 rounded-2xl transition-all duration-300"
                >
                  <div className="flex items-start space-x-4">
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${rankColors[msg.user.rank]} p-0.5`}>
                        <div className="w-full h-full rounded-2xl bg-black/60 flex items-center justify-center">
                          <span className="text-white font-bold">{msg.user.name.charAt(0)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="font-bold text-white text-lg">{msg.user.name}</span>
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${rankColors[msg.user.rank]}`}
                        >
                          {msg.user.rank}
                        </div>
                        <span className="text-white/40 text-sm">{msg.timestamp}</span>
                      </div>
                      <p className="text-white/90 text-base leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <div className="p-6 border-t border-white/10">
            <div className="relative">
              <div className="bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-center space-x-4">
                  <Input
                    placeholder={`Message #${activeChannel.name}...`}
                    className="flex-1 bg-transparent border-none text-white placeholder-white/50 focus:ring-0 text-lg h-auto p-0"
                  />
                  <div className="flex items-center space-x-3">
                    <button className="p-3 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-300">
                      <Smile size={22} />
                    </button>
                    <button className="p-3 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-300">
                      <Paperclip size={22} />
                    </button>
                    <Button className="bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white border-none shadow-lg px-6 py-3 rounded-xl font-semibold">
                      <Send size={18} className="mr-2" />
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
