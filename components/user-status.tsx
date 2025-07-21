"use client"

import { useState } from "react"
import { User, Settings, Mic, MicOff } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useProfile } from "@/contexts/profile-context"
import { usePrivy } from "@privy-io/react-auth"

interface UserStatusProps {
  onOpenSettings: () => void
}

type StatusType = "online" | "dnd" | "offline"

const statusConfig = {
  online: {
    label: "Online",
    color: "bg-green-500",
    description: "Available to chat",
  },
  dnd: {
    label: "Do Not Disturb",
    color: "bg-red-500",
    description: "Busy - only urgent messages",
  },
  offline: {
    label: "Offline",
    color: "bg-neutral-600",
    description: "Not available",
  },
}

export function UserStatus({ onOpenSettings }: UserStatusProps) {
  const [isMuted, setIsMuted] = useState(false)
  const { profile, updateStatus } = useProfile()
  const { authenticated } = usePrivy()

  // Use the profile's actual status directly
  const currentStatus = (profile?.status as StatusType) || "online"
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const handleStatusChange = async (newStatus: StatusType) => {
    if (newStatus !== currentStatus && authenticated && profile && !isUpdatingStatus) {
      console.log(`🎯 USER CLICKED: Change status from ${currentStatus} to ${newStatus}`)
      setIsUpdatingStatus(true)

      try {
        await updateStatus(newStatus)
        console.log(`✅ Status change completed: ${newStatus}`)
      } catch (error) {
        console.error("❌ Failed to update status:", error)
        alert(`Failed to update status: ${error}`)
      } finally {
        setIsUpdatingStatus(false)
      }
    }
  }

  // Don't render if not authenticated or no profile
  if (!authenticated || !profile) {
    return null
  }

  return (
    <div className="h-12 px-4 flex items-center border-t border-neutral-800 bg-neutral-900 w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center hover:bg-neutral-850 transition-colors flex-1 py-2 hover:bg-neutral-800/30">
            <div className="w-8 h-8 bg-neutral-700 rounded-none flex items-center justify-center mr-2 relative overflow-hidden">
              {profile?.pfp_url ? (
                <img
                  src={profile.pfp_url || "/placeholder.svg"}
                  alt={profile.name || profile.username || "Profile"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-neutral-400" />
              )}
              {/* Square status indicator */}
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 ${statusConfig[currentStatus].color} rounded-none border border-neutral-900`}
              />
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium text-neutral-200 truncate text-left">
                {profile?.name || profile?.username || "User"}
              </div>
              <div className="text-xs text-neutral-500 truncate text-left">
                {statusConfig[currentStatus].label}
                {isUpdatingStatus && " (updating...)"}
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          className="bg-neutral-800 border-neutral-700 text-neutral-100 rounded-none w-48"
        >
          {Object.entries(statusConfig).map(([key, config]) => (
            <DropdownMenuItem
              key={key}
              onClick={() => handleStatusChange(key as StatusType)}
              className="hover:bg-neutral-700 cursor-pointer rounded-none flex items-center space-x-3 py-2 focus:bg-neutral-700 focus:text-neutral-100"
              disabled={isUpdatingStatus}
            >
              <div className={`w-3 h-3 ${config.color} rounded-none flex-shrink-0`} />
              <div className="flex-1">
                <div className="text-sm font-medium">{config.label}</div>
                <div className="text-xs text-neutral-400">{config.description}</div>
              </div>
              {currentStatus === key && <div className="w-2 h-2 bg-white rounded-none" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex items-center space-x-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsMuted(!isMuted)
          }}
          className={`p-2 transition-colors rounded-lg hover:bg-neutral-800/30 ${
            isMuted ? "text-red-400" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        <button
          onClick={onOpenSettings}
          className="p-2 text-neutral-500 hover:text-neutral-300 transition-colors rounded-lg hover:bg-neutral-800/30"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
