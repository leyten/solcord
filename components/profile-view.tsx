"use client"

import { X, Settings, Calendar, Wallet, Link2, Loader2, Copy, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useProfile } from "@/contexts/profile-context"
import { getUserProfile } from "@/app/actions"
import { useState, useEffect } from "react"
import type { ChannelUser } from "@/lib/types"
import { DirectMessages } from "@/components/direct-messages"

interface ProfileViewProps {
  user: ChannelUser | null
  onClose: () => void
  onOpenSettings?: () => void
}

interface FullProfile {
  id: string
  username: string
  name: string
  pfp_url: string | null
  bio: string | null
  primary_wallet: string
  connections: any
  status: "online" | "dnd" | "offline"
  created_at: string
  updated_at: string
}

const statusColors = {
  online: "bg-green-500",
  dnd: "bg-red-500",
  offline: "bg-neutral-600",
}

const statusLabels = {
  online: "Online",
  dnd: "Do Not Disturb",
  offline: "Offline",
}

export function ProfileView({ user, onClose, onOpenSettings }: ProfileViewProps) {
  const { profile } = useProfile()
  const [fullProfile, setFullProfile] = useState<FullProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copiedWallet, setCopiedWallet] = useState(false)
  const [showDirectMessages, setShowDirectMessages] = useState(false)
  const [dmNotificationCount, setDmNotificationCount] = useState(0)

  useEffect(() => {
    if (!user) return

    const fetchFullProfile = async () => {
      setIsLoading(true)
      try {
        const profileData = await getUserProfile(user.id)
        setFullProfile(profileData)
      } catch (error) {
        console.error("Error fetching full profile:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchFullProfile()
  }, [user])

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  if (!user) return null

  const isOwnProfile = profile?.id === user.id
  const status = user.status || "offline"

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    })
  }

  const handleSettingsClick = () => {
    if (onOpenSettings) {
      onOpenSettings()
    }
  }

  const copyWalletAddress = async () => {
    if (!fullProfile?.primary_wallet) return

    try {
      await navigator.clipboard.writeText(fullProfile.primary_wallet)
      setCopiedWallet(true)
      setTimeout(() => setCopiedWallet(false), 2000)
    } catch (error) {
      console.error("Failed to copy wallet address:", error)
    }
  }

  const handleConnectionClick = (platform: string, value: string) => {
    let url = ""

    switch (platform.toLowerCase()) {
      case "twitter":
      case "x":
        url = `https://twitter.com/${value.replace("@", "")}`
        break
      case "github":
        url = `https://github.com/${value.replace("@", "")}`
        break
      case "discord":
        // Discord usernames don't have direct URLs, but we can still make it clickable
        return
      case "telegram":
        url = `https://t.me/${value.replace("@", "")}`
        break
      case "instagram":
        url = `https://instagram.com/${value.replace("@", "")}`
        break
      case "linkedin":
        url = `https://linkedin.com/in/${value}`
        break
      default:
        // If it looks like a URL, use it directly
        if (value.startsWith("http")) {
          url = value
        }
        break
    }

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-md rounded-none">
        {/* Header */}
        <div className="relative p-6 pb-4">
          {/* Header buttons */}
          <div className="absolute top-3 right-3 flex items-center space-x-1">
            {isOwnProfile && onOpenSettings && (
              <button
                onClick={handleSettingsClick}
                className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-none transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-none transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Profile picture and basic info */}
          <div className="flex items-start space-x-4">
            <div className="relative">
              <div className="w-16 h-16 bg-neutral-700 rounded-none flex items-center justify-center overflow-hidden">
                {user.avatar ? (
                  <img src={user.avatar || "/placeholder.svg"} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-neutral-400">{user.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              {/* Status indicator */}
              <div
                className={`absolute -bottom-1 -right-1 w-4 h-4 ${statusColors[status]} border-2 border-neutral-900 rounded-none`}
              />
            </div>

            <div className="flex-1 min-w-0 pr-16">
              <h2 className="text-xl font-bold text-neutral-100 truncate">{user.name}</h2>
              <div className="text-sm text-neutral-400 mb-2">@{fullProfile?.username || user.name.toLowerCase()}</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
          ) : (
            <>
              {/* Bio */}
              {fullProfile?.bio && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-neutral-300 mb-2">About</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">{fullProfile.bio}</p>
                </div>
              )}

              {/* Wallet */}
              {fullProfile?.primary_wallet && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-neutral-300 mb-2">Wallet</h3>
                  <div className="flex items-center space-x-2 p-3 bg-neutral-800 border border-neutral-700 rounded-none">
                    <Wallet className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                    <span className="text-neutral-300 font-mono text-xs break-all flex-1">
                      {fullProfile.primary_wallet}
                    </span>
                    <button
                      onClick={copyWalletAddress}
                      className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded-none transition-colors flex-shrink-0"
                      title="Copy wallet address"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  {copiedWallet && <p className="text-xs text-green-400 mt-1">Wallet address copied!</p>}
                </div>
              )}

              {/* Social Connections */}
              {fullProfile?.connections && Object.keys(fullProfile.connections).length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-neutral-300 mb-2">Connections</h3>
                  <div className="space-y-2">
                    {Object.entries(fullProfile.connections).map(([platform, value]) => (
                      <button
                        key={platform}
                        onClick={() => handleConnectionClick(platform, value as string)}
                        className="flex items-center space-x-2 text-sm w-full p-2 hover:bg-neutral-800 rounded-none transition-colors group"
                      >
                        <Link2 className="w-4 h-4 text-neutral-500 group-hover:text-neutral-400" />
                        <span className="text-neutral-400 capitalize">{platform}:</span>
                        <span className="text-neutral-300 group-hover:text-white">{value as string}</span>
                        <ExternalLink className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400 ml-auto" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Member info */}
              <div className="space-y-3 mb-6">
                {fullProfile?.created_at && (
                  <div className="flex items-center space-x-3 text-sm">
                    <Calendar className="w-4 h-4 text-neutral-500" />
                    <div>
                      <span className="text-neutral-400">Joined Solcord</span>
                      <div className="text-neutral-300">{formatDate(fullProfile.created_at)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {!isOwnProfile && (
                <Button
                  onClick={() => setShowDirectMessages(true)}
                  className="w-full bg-white hover:bg-neutral-200 text-black rounded-none font-medium"
                  size="sm"
                >
                  Send Message
                </Button>
              )}
            </>
          )}
        </div>

        {/* Direct Messages Modal */}
        {showDirectMessages && (
          <DirectMessages
            onClose={() => setShowDirectMessages(false)}
            onNotificationUpdate={setDmNotificationCount}
            initialConversationUserId={user.id}
          />
        )}
      </div>
    </div>
  )
}
