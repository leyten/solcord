"use client"

import type React from "react"

import { useState } from "react"
import { X, Search, Users, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { tokenServerService } from "@/lib/services/token-servers"
import { useProfile } from "@/contexts/profile-context"

interface ServerSearchModalProps {
  onClose: () => void
}

interface ServerPreview {
  exists: boolean
  server?: any
  preview?: {
    name: string
    symbol: string
    logo_url: string
    token_ca: string
    decimals: number
  }
}

export function ServerSearchModal({ onClose }: ServerSearchModalProps) {
  const [tokenCA, setTokenCA] = useState("")
  const [serverPreview, setServerPreview] = useState<ServerPreview | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState("")
  const { profile } = useProfile()

  const handleSearch = async () => {
    if (!tokenCA.trim()) return

    setIsSearching(true)
    setError("")
    setServerPreview(null)

    try {
      const result = await tokenServerService.getServerByTokenCA(tokenCA.trim())
      if (result) {
        setServerPreview({
          exists: !!result.id,
          server: result.id ? result : null,
          preview: result.id
            ? undefined
            : {
                name: result.name,
                symbol: result.symbol,
                logo_url: result.logo_url,
                token_ca: result.token_ca,
                decimals: 6, // Default decimals, will be updated from token data
              },
        })
      } else {
        setError("Token not found or invalid contract address")
      }
    } catch (err) {
      setError("Failed to search for server")
      console.error("Search error:", err)
    } finally {
      setIsSearching(false)
    }
  }

  const handleJoinServer = async () => {
    if (!profile?.id || !profile?.primary_wallet || !tokenCA.trim()) {
      setError("User not authenticated or wallet not found")
      return
    }

    setIsJoining(true)
    setError("")

    try {
      const result = await tokenServerService.joinServer(tokenCA.trim(), profile.id, profile.primary_wallet)

      if (result.success) {
        // Success - close modal and potentially refresh servers
        onClose()
        // TODO: Trigger server list refresh in parent component
      } else {
        setError(result.error || "Failed to join server")
      }
    } catch (err) {
      setError("Failed to join server")
      console.error("Join error:", err)
    } finally {
      setIsJoining(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSearching) {
      if (serverPreview) {
        handleJoinServer()
      } else {
        handleSearch()
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-white">Add Server</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Token Contract Address</label>
            <div className="flex gap-2">
              <Input
                value={tokenCA}
                onChange={(e) => setTokenCA(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter Solana token contract address..."
                className="flex-1 bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 rounded-none"
                disabled={isSearching || isJoining}
              />
              <Button
                onClick={handleSearch}
                disabled={!tokenCA.trim() || isSearching || isJoining}
                className="bg-neutral-700 hover:bg-neutral-600 text-white rounded-none"
              >
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </Button>
            </div>
          </div>

          {/* Error Message */}
          {error && <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 p-3">{error}</div>}

          {/* Server Preview */}
          {serverPreview && (
            <div className="border border-neutral-700 bg-neutral-800 p-4 space-y-3">
              <div className="flex items-center gap-3">
                {serverPreview.preview?.logo_url || serverPreview.server?.logo_url ? (
                  <img
                    src={serverPreview.preview?.logo_url || serverPreview.server?.logo_url}
                    alt="Server logo"
                    className="w-12 h-12 object-cover bg-neutral-700"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = "none"
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 bg-neutral-700 flex items-center justify-center text-neutral-400">
                    <Users size={20} />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-white">
                    {serverPreview.preview?.name || serverPreview.server?.name}
                  </h3>
                  <p className="text-sm text-neutral-400">
                    ${serverPreview.preview?.symbol || serverPreview.server?.symbol}
                  </p>
                </div>
              </div>

              <div className="text-sm text-neutral-300">
                {serverPreview.exists ? (
                  <p>This server already exists. You can join if you hold at least 10,000 tokens.</p>
                ) : (
                  <p>This server doesn't exist yet. You can create it if you hold at least 10,000 tokens.</p>
                )}
              </div>

              <Button
                onClick={handleJoinServer}
                disabled={isJoining}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-none"
              >
                {isJoining ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" />
                    {serverPreview.exists ? "Joining..." : "Creating..."}
                  </>
                ) : serverPreview.exists ? (
                  "Join Server"
                ) : (
                  "Create & Join Server"
                )}
              </Button>
            </div>
          )}

          {/* Help Text */}
          <div className="text-xs text-neutral-500">
            <p>Enter a Solana token contract address to find or create a server for that token community.</p>
            <p className="mt-1">You need to hold at least 10,000 tokens to participate as a member.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
