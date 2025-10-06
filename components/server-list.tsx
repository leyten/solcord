"use client"
import { usePrivy } from "@privy-io/react-auth"
import { User, Trash2 } from "lucide-react"
import type React from "react"

import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Server, Channel } from "@/lib/types"
import { useProfile } from "@/contexts/profile-context"
import { tokenServerService } from "@/lib/services/token-servers"
import { useState } from "react"

interface ServerListProps {
  servers: Server[]
  activeServer: Server
  setActiveServer: (server: Server) => void
  setActiveChannel: (channel: Channel) => void
  onOpenDMs: () => void
  onAddServer: () => void
  unreadDMCount?: number
  onServersUpdate?: () => void
}

export function ServerList({
  servers,
  activeServer,
  setActiveServer,
  setActiveChannel,
  onOpenDMs,
  onAddServer,
  unreadDMCount = 0,
  onServersUpdate,
}: ServerListProps) {
  const { profile } = useProfile()
  const { getAccessToken } = usePrivy()
  const [isLeavingServer, setIsLeavingServer] = useState<string | null>(null)
  const [hoveredServer, setHoveredServer] = useState<string | null>(null)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<Server | null>(null)

  const handleServerClick = (server: Server) => {
    setActiveServer(server)
  }

  const handleLeaveServer = async (server: Server, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!profile?.id || server.id === "solcord") {
      return
    }

    setShowLeaveConfirm(server)
  }

  const confirmLeaveServer = async (server: Server) => {
    if (!profile?.id) return

    setIsLeavingServer(server.id)
    setShowLeaveConfirm(null)

    try {
      const authToken = await getAccessToken()

      const result = await tokenServerService.leaveServer(profile.id, server.id, authToken ?? undefined)

      if (result.success) {
        // If leaving the currently active server, switch to Solcord
        if (activeServer.id === server.id) {
          const solcordServer = servers.find((s) => s.id === "solcord")
          if (solcordServer) {
            setActiveServer(solcordServer)
          }
        }

        // Refresh the server list
        if (onServersUpdate) {
          onServersUpdate()
        }
      } else {
        alert(result.error || "Failed to leave server")
      }
    } catch (error) {
      console.error("Error leaving server:", error)
      alert("Failed to leave server")
    } finally {
      setIsLeavingServer(null)
    }
  }

  return (
    <>
      <div className="w-16 bg-neutral-900 border-r border-neutral-800 flex flex-col items-center py-4">
        {/* Profile / DM Button */}
        <div className="mb-6 relative">
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenDMs}
                  className="w-10 h-10 bg-neutral-800 hover:bg-neutral-700 rounded-none flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition-colors"
                  title="Direct Messages"
                >
                  <User size={16} />
                </button>
              </TooltipTrigger>
            </Tooltip>
          </TooltipProvider>

          {/* DM Notification Badge */}
          {unreadDMCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">{unreadDMCount > 9 ? "9+" : unreadDMCount}</span>
            </div>
          )}
        </div>

        {/* Separator line between DMs and servers */}
        <div className="w-8 h-px bg-neutral-800 mb-6"></div>

        {/* Servers */}
        <div className="flex flex-col space-y-3 mb-6">
          {servers.map((server) => (
            <TooltipProvider key={server.id}>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <div
                    className="relative"
                    onMouseEnter={() => setHoveredServer(server.id)}
                    onMouseLeave={() => setHoveredServer(null)}
                  >
                    <button
                      onClick={() => handleServerClick(server)}
                      className={`w-10 h-10 rounded-none flex items-center justify-center text-xs font-bold transition-colors overflow-hidden ${
                        activeServer.id === server.id
                          ? "bg-neutral-100 text-neutral-900"
                          : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
                      } ${isLeavingServer === server.id ? "opacity-50" : ""}`}
                      disabled={isLeavingServer === server.id}
                    >
                      {server.logo ? (
                        <img
                          src={server.logo || "/placeholder.svg"}
                          alt={server.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to first letter if image fails to load
                            const target = e.target as HTMLImageElement
                            target.style.display = "none"
                            target.nextElementSibling!.textContent = server.name.charAt(0)
                          }}
                        />
                      ) : (
                        server.name.charAt(0)
                      )}
                      <span className="hidden">{server.name.charAt(0)}</span>
                    </button>

                    {server.id !== "solcord" && hoveredServer === server.id && (
                      <button
                        onClick={(e) => handleLeaveServer(server, e)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center text-white transition-colors z-10"
                        disabled={isLeavingServer === server.id}
                        title="Leave Server"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                </TooltipTrigger>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        {/* Separator line before add button */}
        <div className="w-8 h-px bg-neutral-800 mb-3"></div>

        {/* Add Server Button */}
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                onClick={onAddServer}
                className="w-10 h-10 bg-neutral-800 hover:bg-neutral-700 rounded-none flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition-colors"
                title="Add Server"
              >
                <span className="text-lg font-bold">+</span>
              </button>
            </TooltipTrigger>
          </Tooltip>
        </TooltipProvider>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings */}
        <TooltipProvider>
          <Tooltip delayDuration={300}></Tooltip>
        </TooltipProvider>
      </div>

      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-700 p-6 w-96">
            <h3 className="text-white text-lg font-semibold mb-4">Leave Server</h3>
            <p className="text-neutral-300 mb-6">Are you sure you want to leave "{showLeaveConfirm.name}"?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLeaveConfirm(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmLeaveServer(showLeaveConfirm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                Leave Server
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
