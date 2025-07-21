"use client"

import { useState, useEffect } from "react"
import { ServerList } from "@/components/server-list"
import { ChannelSidebar } from "@/components/channel-sidebar"
import { ChatArea } from "@/components/chat-area"
import { UserList } from "@/components/user-list"
import { Settings } from "@/components/settings"
import { DirectMessages } from "@/components/direct-messages"
import { ProfileProvider } from "@/contexts/profile-context"
import { servers, channelsByServer } from "@/lib/data"
import type { Server, Channel, ChannelUser } from "@/lib/types"
import { membersService } from "@/lib/services/members"

export function SolcordUI() {
  const [activeServer, setActiveServer] = useState<Server>(servers[0])
  const [activeChannel, setActiveChannel] = useState<Channel>(channelsByServer[activeServer.id][0].channels[0])
  const [channelSidebarCollapsed, setChannelSidebarCollapsed] = useState(false)
  const [userListCollapsed, setUserListCollapsed] = useState(false)
  const [showDMs, setShowDMs] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [serverMembers, setServerMembers] = useState<ChannelUser[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)

  // Load members when server changes (not channel)
  useEffect(() => {
    if (!activeServer?.id) return

    const loadMembers = async () => {
      setIsLoadingMembers(true)
      try {
        console.log("🔄 Loading members for server:", activeServer.name)
        const members = await membersService.getServerMembers(activeServer.id)
        console.log("👥 Loaded server members:", members.length, "total")
        setServerMembers(members)
      } catch (error) {
        console.error("❌ Failed to load server members:", error)
        setServerMembers([])
      } finally {
        setIsLoadingMembers(false)
      }
    }

    loadMembers()

    // Subscribe to real-time member updates for this server
    const subscription = membersService.subscribeToMemberUpdates(activeServer.id, (updatedMembers) => {
      console.log("🔄 Real-time server member update received:", updatedMembers.length, "members")
      setServerMembers(updatedMembers)
    })

    return () => {
      membersService.unsubscribeFromMemberUpdates(subscription)
    }
  }, [activeServer.id]) // Only depend on server, not channel

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to close modals
      if (e.key === "Escape") {
        if (showSettings) {
          setShowSettings(false)
          return
        }
        if (showDMs) {
          setShowDMs(false)
          return
        }
      }

      // Ctrl/Cmd + K for quick search (focus channel search or open DMs)
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setShowDMs(true)
        return
      }

      // Ctrl/Cmd + , for settings
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault()
        setShowSettings(true)
        return
      }

      // Ctrl/Cmd + Shift + A for toggle channel sidebar
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "A") {
        e.preventDefault()
        setChannelSidebarCollapsed(!channelSidebarCollapsed)
        return
      }

      // Ctrl/Cmd + Shift + U for toggle user list
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "U") {
        e.preventDefault()
        setUserListCollapsed(!userListCollapsed)
        return
      }

      // Alt + Up/Down for channel navigation
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault()
        const currentChannels = channelsByServer[activeServer.id]
        const allChannels = currentChannels.flatMap((section) => section.channels)
        const currentIndex = allChannels.findIndex((ch) => ch.id === activeChannel.id)

        if (e.key === "ArrowUp" && currentIndex > 0) {
          setActiveChannel(allChannels[currentIndex - 1])
        } else if (e.key === "ArrowDown" && currentIndex < allChannels.length - 1) {
          setActiveChannel(allChannels[currentIndex + 1])
        }
        return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showSettings, showDMs, channelSidebarCollapsed, userListCollapsed, activeServer, activeChannel])

  return (
    <ProfileProvider>
      <div className="flex h-screen bg-neutral-950">
        <ServerList
          servers={servers}
          activeServer={activeServer}
          setActiveServer={setActiveServer}
          setActiveChannel={setActiveChannel}
          onOpenDMs={() => setShowDMs(true)}
        />
        <ChannelSidebar
          server={activeServer}
          channels={channelsByServer[activeServer.id]}
          activeChannel={activeChannel}
          setActiveChannel={setActiveChannel}
          collapsed={channelSidebarCollapsed}
          onToggleCollapse={() => setChannelSidebarCollapsed(!channelSidebarCollapsed)}
          onOpenSettings={() => setShowSettings(true)}
        />
        <ChatArea
          channel={activeChannel}
          messages={[]}
          users={serverMembers}
          onToggleUserList={() => setUserListCollapsed(!userListCollapsed)}
          userListCollapsed={userListCollapsed}
        />
        <UserList
          users={serverMembers}
          collapsed={userListCollapsed}
          onToggleCollapse={() => setUserListCollapsed(!userListCollapsed)}
          title={isLoadingMembers ? "Loading..." : "Members"}
        />
        {showDMs && <DirectMessages onClose={() => setShowDMs(false)} />}
        {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      </div>
    </ProfileProvider>
  )
}
