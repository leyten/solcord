"use client"
import { User } from "lucide-react"
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Server, Channel } from "@/lib/types"
import { channelsByServer } from "@/lib/data"

interface ServerListProps {
  servers: Server[]
  activeServer: Server
  setActiveServer: (server: Server) => void
  setActiveChannel: (channel: Channel) => void
  onOpenDMs: () => void
}

export function ServerList({ servers, activeServer, setActiveServer, setActiveChannel, onOpenDMs }: ServerListProps) {
  const handleServerClick = (server: Server) => {
    setActiveServer(server)
    // Set the first channel of the first section as active
    const firstChannel = channelsByServer[server.id]?.[0]?.channels?.[0]
    if (firstChannel) {
      setActiveChannel(firstChannel)
    }
  }

  return (
    <div className="w-16 bg-neutral-900 border-r border-neutral-800 flex flex-col items-center py-4">
      {/* Profile */}
      <div className="mb-6">
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
      </div>

      {/* Servers */}
      <div className="flex flex-col space-y-3 mb-6">
        {servers.map((server) => (
          <TooltipProvider key={server.id}>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleServerClick(server)}
                  className={`w-10 h-10 rounded-none flex items-center justify-center text-xs font-bold transition-colors ${
                    activeServer.id === server.id
                      ? "bg-neutral-100 text-neutral-900"
                      : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
                  }`}
                >
                  {server.name.charAt(0)}
                </button>
              </TooltipTrigger>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings */}
      <TooltipProvider>
        <Tooltip delayDuration={300}></Tooltip>
      </TooltipProvider>
    </div>
  )
}
