"use client"
import { Hash, Mic, Repeat, ChevronRight, ChevronLeft, TrendingUp, Megaphone, Lock } from "lucide-react"
import type React from "react"

import type { Server, Channel, ChannelSection } from "@/lib/types"
import { UserStatus } from "@/components/user-status"
import { tokenServerService } from "@/lib/services/token-servers"
import { useEffect, useState } from "react"
import { usePrivy } from "@privy-io/react-auth"

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

const Tooltip = ({ children, text }: { children: React.ReactNode; text: string }) => {
  const [isVisible, setIsVisible] = useState(false)

  if (!text) return <>{children}</>

  return (
    <div className="relative w-full" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
      {children}
      {isVisible && (
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 px-3 py-2 bg-neutral-800 border border-neutral-600 text-sm text-neutral-100 whitespace-nowrap shadow-lg">
          {text}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-neutral-800"></div>
        </div>
      )}
    </div>
  )
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
  const [userTokenPercentage, setUserTokenPercentage] = useState<number>(0)
  const { user } = usePrivy()

  useEffect(() => {
    const checkUserTokenPercentage = async () => {
      if (!user?.id) return

      try {
        const percentage = await tokenServerService.getUserHoldingPercentage(user.id, server.id)
        setUserTokenPercentage(percentage)
      } catch (error) {
        console.error("Failed to get user token percentage:", error)
        setUserTokenPercentage(0)
      }
    }

    checkUserTokenPercentage()
  }, [server.id, user?.id])

  const canAccessChannel = (channel: Channel): boolean => {
    if (channel.type === "voice") {
      return false
    }

    if (!channel.minTokenPercentage) {
      return true
    }
    if (server.id === "solcord") {
      return true
    }

    const hasAccess = userTokenPercentage >= channel.minTokenPercentage
    return hasAccess
  }

  const getChannelTooltip = (channel: Channel): string => {
    if (channel.type === "voice") {
      return "Coming Soon"
    }
    if (channel.minTokenPercentage && userTokenPercentage < channel.minTokenPercentage) {
      return `Requires ${channel.minTokenPercentage}% tokens`
    }
    return ""
  }

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
              const hasAccess = canAccessChannel(channel)
              const tooltip = getChannelTooltip(channel)
              return (
                <Tooltip key={channel.id} text={tooltip}>
                  <button
                    onClick={() => hasAccess && setActiveChannel(channel)}
                    disabled={!hasAccess}
                    className={`w-full flex items-center justify-center py-2 transition-colors rounded-none relative ${
                      isActive
                        ? "bg-neutral-800 text-neutral-100"
                        : hasAccess
                          ? "text-neutral-400 hover:bg-neutral-850 hover:text-neutral-200"
                          : "text-neutral-600 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {!hasAccess && <Lock className="w-2 h-2 absolute top-1 right-1" />}
                  </button>
                </Tooltip>
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
          <div className="text-xs text-neutral-500 hidden lg:block"></div>
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
                const hasAccess = canAccessChannel(channel)
                const isTokenGated = channel.minTokenPercentage && channel.minTokenPercentage > 0
                const tooltip = getChannelTooltip(channel)

                return (
                  <Tooltip key={channel.id} text={tooltip}>
                    <button
                      onClick={() => hasAccess && setActiveChannel(channel)}
                      disabled={!hasAccess}
                      className={`w-full flex items-center px-4 py-1.5 text-sm transition-colors rounded-none relative ${
                        isActive
                          ? "bg-neutral-800 text-neutral-100"
                          : hasAccess
                            ? "text-neutral-400 hover:bg-neutral-850 hover:text-neutral-200"
                            : "text-neutral-600 opacity-50 cursor-not-allowed bg-neutral-950"
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{channel.name}</span>
                      {isTokenGated && (
                        <div className="ml-auto flex items-center space-x-1">
                          {!hasAccess && <Lock className="w-3 h-3" />}
                          <span className="text-xs text-neutral-500">{channel.minTokenPercentage}%+</span>
                        </div>
                      )}
                      {channel.type === "voice" && <Lock className="w-3 h-3 ml-auto" />}
                    </button>
                  </Tooltip>
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
