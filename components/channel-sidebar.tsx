"use client"
import { Hash, Mic, Repeat, ChevronRight, ChevronLeft, TrendingUp, Megaphone } from "lucide-react"
import type { Server, Channel, ChannelSection } from "@/lib/types"
import { UserStatus } from "@/components/user-status"

interface ChannelSidebarProps {
  server: Server
  channels: ChannelSection[]
  activeChannel: Channel
  setActiveChannel: (channel: Channel) => void
  collapsed: boolean
  onToggleCollapse: () => void
  onOpenSettings: () => void
}

const channelIcons: { [key: string]: any } = {
  text: Hash,
  voice: Mic,
  feed: TrendingUp,
  trade: Repeat,
}

export function ChannelSidebar({
  server,
  channels,
  activeChannel,
  setActiveChannel,
  collapsed,
  onToggleCollapse,
  onOpenSettings,
}: ChannelSidebarProps) {
  if (collapsed) {
    return (
      <div className="w-12 bg-neutral-925 border-r border-neutral-800 flex flex-col">
        {/* Expand Button */}
        <div className="h-12 flex items-center justify-center border-b border-neutral-800 bg-neutral-900">
          <button
            onClick={onToggleCollapse}
            className="p-2 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 rounded-none transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Collapsed Channel Icons */}
        <div className="flex-1 overflow-y-auto py-2">
          {channels.map((section) =>
            section.channels.map((channel) => {
              const Icon = channelIcons[channel.type] || Hash
              const isActive = activeChannel.id === channel.id
              return (
                <button
                  key={channel.id}
                  onClick={() => setActiveChannel(channel)}
                  className={`w-full flex items-center justify-center py-2 transition-colors rounded-none ${
                    isActive
                      ? "bg-neutral-800 text-neutral-100"
                      : "text-neutral-400 hover:bg-neutral-850 hover:text-neutral-200"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              )
            }),
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-60 bg-neutral-925 border-r border-neutral-800 flex flex-col">
      {/* Server Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-neutral-800 bg-neutral-900">
        <span className="text-sm font-semibold text-neutral-100 truncate">{server.name}</span>
        <div className="flex items-center space-x-2">
          <div className="text-xs text-neutral-500 hidden lg:block">
            
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 rounded-none transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto py-2">
        {channels.map((section) => (
          <div key={section.label} className="mb-4">
            <div className="px-4 py-1">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{section.label}</h3>
            </div>
            <div className="space-y-0.5">
              {section.channels.map((channel) => {
                let Icon = channelIcons[channel.type] || Hash

                // Special icon for announcements
                if (channel.id === "announcements") {
                  Icon = Megaphone
                }

                const isActive = activeChannel.id === channel.id
                return (
                  <button
                    key={channel.id}
                    onClick={() => setActiveChannel(channel)}
                    className={`w-full flex items-center px-4 py-1.5 text-sm transition-colors rounded-none ${
                      isActive
                        ? "bg-neutral-800 text-neutral-100"
                        : "text-neutral-400 hover:bg-neutral-850 hover:text-neutral-200"
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate">{channel.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User Info */}
      <UserStatus onOpenSettings={onOpenSettings} />
    </div>
  )
}
