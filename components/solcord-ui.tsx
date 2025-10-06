"use client"

import { useState, useEffect, useCallback } from "react"
import { ServerList } from "@/components/server-list"
import { ChannelSidebar } from "@/components/channel-sidebar"
import { ChatArea } from "@/components/chat-area"
import { UserList } from "@/components/user-list"
import { Settings } from "@/components/settings"
import { DirectMessages } from "@/components/direct-messages"
import { ProfileView } from "@/components/profile-view"
import { ServerSearchModal } from "@/components/server-search-modal"
import { ProfileProvider } from "@/contexts/profile-context"
import { servers } from "@/lib/data"
import type { Server, Channel, ChannelUser, ChannelSection } from "@/lib/types"
import { membersService } from "@/lib/services/members"
import { dmService } from "@/lib/services/direct-messages"
import { tokenServerService } from "@/lib/services/token-servers"
import { channelsService } from "@/lib/services/channels"
import { useProfile } from "@/contexts/profile-context"
import { usePrivy } from "@privy-io/react-auth"

function SolcordUIInner() {
  const [activeServer, setActiveServer] = useState<Server>(servers[0])
  const [dynamicChannelsByServer, setDynamicChannelsByServer] = useState<Record<string, ChannelSection[]>>({})
  const [activeChannel, setActiveChannel] = useState<Channel>({
    id: "general",
    name: "general",
    type: "text" as const,
    description: "General discussion",
  })
  const [channelSidebarCollapsed, setChannelSidebarCollapsed] = useState(false)
  const [userListCollapsed, setUserListCollapsed] = useState(false)
  const [showDMs, setShowDMs] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showServerSearch, setShowServerSearch] = useState(false)
  const [serverMembers, setServerMembers] = useState<ChannelUser[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [selectedUser, setSelectedUser] = useState<ChannelUser | null>(null)
  const [showProfileView, setShowProfileView] = useState(false)
  const [unreadDMCount, setUnreadDMCount] = useState(0)
  const [userServers, setUserServers] = useState<any[]>([])
  const [allServers, setAllServers] = useState<Server[]>(servers)
  const { profile } = useProfile()
  const { getAccessToken } = usePrivy()

  // Load channels for a specific server
  const loadServerChannels = useCallback(async (serverId: string) => {
    try {
      console.log(`📋 Loading channels for server: ${serverId}`)
      const channels = await channelsService.getServerChannels(serverId)

      setDynamicChannelsByServer((prev) => ({
        ...prev,
        [serverId]: channels,
      }))

      console.log(`✅ Loaded channels for server ${serverId}:`, channels)
    } catch (error) {
      console.error(`❌ Failed to load channels for server ${serverId}:`, error)
    }
  }, [])

  // Load user's token servers
  const loadUserServers = useCallback(async () => {
    if (!profile?.id) return

    try {
      const tokenServers = await tokenServerService.getUserServers(profile.id)
      console.log("Loaded user servers:", tokenServers)
      setUserServers(tokenServers)

      // Create server objects for token servers
      const tokenServerObjects = tokenServers.map((tokenServer) => ({
        id: tokenServer.id,
        name: tokenServer.name,
        logo: tokenServer.logo_url,
        icon: tokenServer.logo_url,
        token_ca: tokenServer.token_ca,
      }))

      // Combine default servers with user's token servers
      const combinedServers = [...servers, ...tokenServerObjects]
      setAllServers(combinedServers)

      // Load channels for all servers (including token servers)
      for (const server of combinedServers) {
        await loadServerChannels(server.id)
      }
    } catch (error) {
      console.error("Error loading user servers:", error)
    }
  }, [profile?.id, loadServerChannels])

  // Refresh user balances
  const refreshUserBalances = useCallback(
    async (specificServerId?: string) => {
      if (!profile?.id || !profile.primary_wallet) return

      try {
        console.log("[v0] Refreshing user token balances...")
        const authToken = await getAccessToken()

        await tokenServerService.updateUserMemberships(profile.id, profile.primary_wallet, specificServerId, authToken ?? undefined)
        console.log("[v0] Token balances refreshed successfully")

        // Reload servers to reflect updated balances/roles
        await loadUserServers()
      } catch (error) {
        console.error("[v0] Error refreshing token balances:", error)
      }
    },
    [profile?.id, profile?.primary_wallet, loadUserServers, getAccessToken],
  )

  useEffect(() => {
    const initializeUserData = async () => {
      if (!profile?.id) return

      // First refresh token balances, then load servers
      await refreshUserBalances()
    }

    initializeUserData()
  }, [profile?.id, refreshUserBalances])

  // Refresh user balances every 60 seconds
  useEffect(() => {
    if (!profile?.id || !profile.primary_wallet) return

    // Initial refresh
    refreshUserBalances()

    // Set up 60-second interval
    const intervalId = setInterval(() => {
      console.log("[v0] Periodic balance refresh triggered")
      refreshUserBalances()
    }, 60000) // 60 seconds

    return () => clearInterval(intervalId)
  }, [profile?.id, profile?.primary_wallet, refreshUserBalances])

  useEffect(() => {
    if (!activeServer?.id || !profile?.id || !profile.primary_wallet) return

    // Skip refresh for default Solcord server
    if (activeServer.id === "solcord") return

    console.log(`[v0] Server switched to ${activeServer.id}, refreshing balance...`)
    refreshUserBalances(activeServer.id)
  }, [activeServer?.id, profile?.id, profile?.primary_wallet, refreshUserBalances])

  // Update active channel when server changes
  useEffect(() => {
    if (activeServer?.id) {
      const serverChannels = dynamicChannelsByServer[activeServer.id]
      if (serverChannels && serverChannels.length > 0 && serverChannels[0].channels.length > 0) {
        setActiveChannel(serverChannels[0].channels[0])
        console.log(`🔄 Switched to server ${activeServer.id}, channel: ${serverChannels[0].channels[0].name}`)
      } else {
        // Load channels for this server if not loaded yet
        loadServerChannels(activeServer.id)
      }
    }
  }, [activeServer, dynamicChannelsByServer, loadServerChannels])

  // Load members when server changes (not channel)
  useEffect(() => {
    if (!activeServer?.id) return

    const loadMembers = async () => {
      setIsLoadingMembers(true)
      try {
        console.log(`👥 Loading members for server: ${activeServer.id}`)
        const members = await membersService.getServerMembers(activeServer.id)
        setServerMembers(members)
        console.log(`✅ Loaded ${members.length} members for server ${activeServer.id}`)
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
      console.log(`👥 Real-time member update for server ${activeServer.id}:`, updatedMembers.length)
      setServerMembers(updatedMembers)
    })

    return () => {
      membersService.unsubscribeFromMemberUpdates(subscription)
    }
  }, [activeServer.id])

  // Load unread DM count - this gets the total from all conversations
  const loadUnreadDMCount = useCallback(async () => {
    if (!profile?.id) return

    try {
      const conversations = await dmService.getUserConversations(profile.id)
      const totalUnread = conversations.reduce((sum, conv) => sum + conv.unread_count, 0)
      setUnreadDMCount(totalUnread)
    } catch (error) {
      console.error("Failed to load unread DM count:", error)
    }
  }, [profile?.id])

  // Set up real-time DM subscription for notifications ONLY when NOT in DMs
  useEffect(() => {
    if (!profile?.id) return

    // Load initial unread count
    loadUnreadDMCount()

    // Only set up notification subscription when NOT viewing DMs
    if (!showDMs) {
      dmService.subscribeToMessages(
        profile.id,
        (newMessage) => {
          // Only count as unread if it's not from the current user
          if (newMessage.sender_id !== profile.id) {
            setUnreadDMCount((prev) => prev + 1)
          }
        },
        () => {
          // Refresh unread count when conversations update
          loadUnreadDMCount()
        },
      )
    }

    return () => {
      if (!showDMs) {
        dmService.cleanup()
      }
    }
  }, [profile?.id, showDMs, loadUnreadDMCount])

  const handleUserClick = (userId: string) => {
    const user = serverMembers.find((u) => u.id === userId)
    if (user) {
      setSelectedUser(user)
      setShowProfileView(true)
    }
  }

  const handleCloseProfileView = () => {
    setShowProfileView(false)
    setSelectedUser(null)
  }

  const handleOpenSettings = () => {
    setShowProfileView(false)
    setShowSettings(true)
  }

  const handleOpenDMs = () => {
    setShowDMs(true)
  }

  const handleCloseDMs = () => {
    setShowDMs(false)
    loadUnreadDMCount()
  }

  const handleOpenServerSearch = () => {
    setShowServerSearch(true)
  }

  const handleCloseServerSearch = () => {
    setShowServerSearch(false)
    loadUserServers()
  }

  // Handle notification updates from the DM component
  const handleDMNotificationUpdate = useCallback((newCount: number) => {
    setUnreadDMCount(newCount)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to close modals
      if (e.key === "Escape") {
        if (showProfileView) {
          setShowProfileView(false)
          return
        }
        if (showSettings) {
          setShowSettings(false)
          return
        }
        if (showDMs) {
          setShowDMs(false)
          return
        }
        if (showServerSearch) {
          setShowServerSearch(false)
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
        const currentChannels = dynamicChannelsByServer[activeServer.id]
        if (!currentChannels) return

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
  }, [
    showSettings,
    showDMs,
    showProfileView,
    showServerSearch,
    channelSidebarCollapsed,
    userListCollapsed,
    activeServer,
    activeChannel,
    dynamicChannelsByServer,
  ])

  return (
    <div className="flex h-screen bg-neutral-950">
      <ServerList
        servers={allServers}
        activeServer={activeServer}
        setActiveServer={setActiveServer}
        setActiveChannel={setActiveChannel}
        onOpenDMs={handleOpenDMs}
        onAddServer={handleOpenServerSearch}
        unreadDMCount={unreadDMCount}
        onServersUpdate={loadUserServers}
      />
      <ChannelSidebar
        server={activeServer}
        channels={dynamicChannelsByServer[activeServer.id] || []}
        activeChannel={activeChannel}
        setActiveChannel={setActiveChannel}
        collapsed={channelSidebarCollapsed}
        onToggleCollapse={() => setChannelSidebarCollapsed(!channelSidebarCollapsed)}
        onOpenSettings={() => setShowSettings(true)}
      />
      <ChatArea
        server={activeServer}
        channel={activeChannel}
        messages={[]}
        users={serverMembers}
        onToggleUserList={() => setUserListCollapsed(!userListCollapsed)}
        userListCollapsed={userListCollapsed}
        onOpenSettings={handleOpenSettings}
      />
      <UserList
        users={serverMembers}
        collapsed={userListCollapsed}
        onToggleCollapse={() => setUserListCollapsed(!userListCollapsed)}
        title={isLoadingMembers ? "Loading..." : "Members"}
        onUserClick={handleUserClick}
      />
      {showDMs && <DirectMessages onClose={handleCloseDMs} onNotificationUpdate={handleDMNotificationUpdate} />}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showServerSearch && <ServerSearchModal onClose={handleCloseServerSearch} />}
      {showProfileView && (
        <ProfileView
          user={selectedUser}
          onClose={handleCloseProfileView}
          onOpenSettings={handleOpenSettings}
          activeServer={activeServer}
        />
      )}
    </div>
  )
}

export function SolcordUI() {
  return (
    <ProfileProvider>
      <SolcordUIInner />
    </ProfileProvider>
  )
}
