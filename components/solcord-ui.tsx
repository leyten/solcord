"use client"

import { useState, useEffect } from "react"
import { ServerList } from "@/components/server-list"
import { ChannelSidebar } from "@/components/channel-sidebar"
import { ChatArea } from "@/components/chat-area"
import { UserList } from "@/components/user-list"
import { Settings } from "@/components/settings"
import { DirectMessages } from "@/components/direct-messages"
import { ProfileProvider } from "@/contexts/profile-context"
import { servers, channelsByServer, usersByChannel } from "@/lib/data"
import type { Server, Channel } from "@/lib/types"

export function SolcordUI() {
  const [activeServer, setActiveServer] = useState<Server>(servers[0])
  const [activeChannel, setActiveChannel] = useState<Channel>(channelsByServer[activeServer.id][0].channels[0])
  const [channelSidebarCollapsed, setChannelSidebarCollapsed] = useState(false)
  const [userListCollapsed, setUserListCollapsed] = useState(false)
  const [showDMs, setShowDMs] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

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

      // Multiple ways to trigger help - try all of these combinations
      const isHelpShortcut =
        (e.ctrlKey || e.metaKey) &&
        (e.key === "/" || // Standard QWERTY
          e.key === ":" || // AZERTY with shift
          e.code === "Slash" || // Physical key position
          (e.shiftKey && e.code === "Semicolon") || // AZERTY : key
          e.keyCode === 191 || // Keycode for /
          (e.shiftKey && e.keyCode === 186)) // Keycode for : on AZERTY

      if (isHelpShortcut) {
        e.preventDefault()
        // For now, let's just open settings to test if the key detection works
        // The help modal is handled by the KeyboardShortcutsHelp component
        return
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
          messages={[]} // This prop is no longer used since ChatArea loads its own messages
          users={usersByChannel[activeChannel.id] || []}
          onToggleUserList={() => setUserListCollapsed(!userListCollapsed)}
          userListCollapsed={userListCollapsed}
        />
        <UserList
          users={usersByChannel[activeChannel.id] || []}
          collapsed={userListCollapsed}
          onToggleCollapse={() => setUserListCollapsed(!userListCollapsed)}
          title={activeChannel.type === "voice" ? "Connected Users" : "Members"}
        />
        {showDMs && <DirectMessages onClose={() => setShowDMs(false)} />}
        {showSettings && <Settings onClose={() => setShowSettings(false)} />}

        {/* Keyboard shortcuts help - show on Ctrl/Cmd + / */}
        <KeyboardShortcutsHelp />
      </div>
    </ProfileProvider>
  )
}

function KeyboardShortcutsHelp() {
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Multiple ways to trigger help
      const isHelpShortcut =
        (e.ctrlKey || e.metaKey) &&
        (e.key === "/" || // Standard QWERTY
          e.key === ":" || // AZERTY with shift
          e.code === "Slash" || // Physical key position
          (e.shiftKey && e.code === "Semicolon") || // AZERTY : key
          e.keyCode === 191 || // Keycode for /
          (e.shiftKey && e.keyCode === 186)) // Keycode for : on AZERTY

      if (isHelpShortcut) {
        e.preventDefault()
        setShowHelp(true)
      }

      if (e.key === "Escape" && showHelp) {
        setShowHelp(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showHelp])

  if (!showHelp) return null

  const shortcuts = [
    { key: "Esc", description: "Close modal or dialog" },
    { key: "Ctrl/Cmd + K", description: "Open Direct Messages" },
    { key: "Ctrl/Cmd + ,", description: "Open Settings" },
    { key: "Ctrl/Cmd + Enter", description: "Send message" },
    { key: "Ctrl/Cmd + Shift + A", description: "Toggle channel sidebar" },
    { key: "Ctrl/Cmd + Shift + U", description: "Toggle user list" },
    { key: "Alt + ↑/↓", description: "Navigate channels" },
    { key: "Ctrl/Cmd + / or :", description: "Show this help" },
  ]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-neutral-900 border border-neutral-700 rounded-none w-full max-w-md">
        <div className="p-4 border-b border-neutral-800">
          <h3 className="text-lg font-semibold text-neutral-100">Keyboard Shortcuts</h3>
        </div>
        <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-neutral-300">{shortcut.description}</span>
              <kbd className="px-2 py-1 bg-neutral-800 border border-neutral-600 rounded-none text-xs font-mono text-neutral-200">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-neutral-800 text-center">
          <button onClick={() => setShowHelp(false)} className="text-sm text-neutral-400 hover:text-neutral-200">
            Press Esc to close
          </button>
        </div>
      </div>
    </div>
  )
}
