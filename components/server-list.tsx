"use client"
import { User } from "lucide-react"
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Server, Channel } from "@/lib/types"

interface ServerListProps {
  servers: Server[]
  activeServer: Server
  setActiveServer: (server: Server) => void
  setActiveChannel: (channel: Channel) => void
  onOpenDMs: () => void
  onAddServer: () => void
  unreadDMCount?: number
}

export function ServerList({
  servers,
  activeServer,
  setActiveServer,
  setActiveChannel,
  onOpenDMs,
  onAddServer,
  unreadDMCount = 0,
}: ServerListProps) {
  const handleServerClick = (server: Server) => {
    setActiveServer(server)
  }

  return (
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
                <button
                  onClick={() => handleServerClick(server)}
                  className={`w-10 h-10 rounded-none flex items-center justify-center text-xs font-bold transition-colors overflow-hidden ${
                    activeServer.id === server.id
                      ? "bg-neutral-100 text-neutral-900"
                      : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
                  }`}
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
  )
}
