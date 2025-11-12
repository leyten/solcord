"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { X, Search, Users, Loader2, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { tokenServerService } from "@/lib/services/token-servers"
import { solanaTracker } from "@/lib/services/solana-tracker"
import { useProfile } from "@/contexts/profile-context"
import { usePrivy } from "@privy-io/react-auth"

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
  userBalance: number
  hasMinimumTokens: boolean
}

interface WalletToken {
  token: {
    name: string
    symbol: string
    mint: string
    image: string
    decimals: number
  }
  balance: number
  value: number
}

export function ServerSearchModal({ onClose }: ServerSearchModalProps) {
  const [tokenCA, setTokenCA] = useState("")
  const [serverPreview, setServerPreview] = useState<ServerPreview | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState("")
  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([])
  const [isLoadingWallet, setIsLoadingWallet] = useState(false)
  const [joiningTokenCA, setJoiningTokenCA] = useState<string | null>(null)
  const { profile } = useProfile()
  const { getAccessToken } = usePrivy()

  useEffect(() => {
    const loadWalletTokens = async () => {
      if (!profile?.primary_wallet) return

      setIsLoadingWallet(true)
      try {
        const walletData = await solanaTracker.getWalletBalances(profile.primary_wallet)
        if (walletData) {
          const tokensWithMinimum = walletData.tokens.filter((t) =>
            solanaTracker.hasMinimumTokens(t.balance, t.token.decimals, 10000),
          )
          setWalletTokens(tokensWithMinimum)
        }
      } catch (err) {
        console.error("Failed to load wallet tokens:", err)
      } finally {
        setIsLoadingWallet(false)
      }
    }

    loadWalletTokens()
  }, [profile?.primary_wallet])

  const handleSearch = async () => {
    if (!tokenCA.trim()) return

    setIsSearching(true)
    setError("")
    setServerPreview(null)

    try {
      if (!profile?.primary_wallet) {
        setError("Wallet not connected")
        return
      }

      const [serverResult, walletData] = await Promise.all([
        tokenServerService.getServerByTokenCA(tokenCA.trim()),
        solanaTracker.getWalletBalances(profile.primary_wallet),
      ])

      if (!serverResult) {
        setError("Token not found or invalid contract address")
        return
      }

      if (!walletData) {
        setError("Could not fetch wallet data")
        return
      }

      const userToken = walletData.tokens.find((t) => t.token.mint === tokenCA.trim())
      const userBalance = userToken?.balance || 0

      const isExistingSolcordServer = serverResult.id === "solcord"
      const hasMinimumTokens = isExistingSolcordServer || solanaTracker.hasMinimumTokens(userBalance, 6, 10000)

      setServerPreview({
        exists: !!serverResult.id,
        server: serverResult.id ? serverResult : null,
        preview: serverResult.id
          ? undefined
          : {
              name: serverResult.name,
              symbol: serverResult.symbol,
              logo_url: serverResult.logo_url,
              token_ca: serverResult.token_ca,
              decimals: 6,
            },
        userBalance,
        hasMinimumTokens,
      })
    } catch (err) {
      setError("Failed to search for server")
      console.error("Search error:", err)
    } finally {
      setIsSearching(false)
    }
  }

  const handleJoinServer = async (contractAddress: string) => {
    if (!profile?.id || !profile?.primary_wallet) {
      setError("User not authenticated or wallet not found")
      return
    }

    setJoiningTokenCA(contractAddress)
    setError("")

    try {
      const authToken = await getAccessToken()

      const result = await tokenServerService.joinServer(contractAddress, profile.id, profile.primary_wallet, authToken ?? undefined)

      if (result.success) {
        onClose()
      } else {
        setError(result.error || "Failed to join server")
      }
    } catch (err) {
      setError("Failed to join server")
      console.error("Join error:", err)
    } finally {
      setJoiningTokenCA(null)
    }
  }

  const handleJoinFromPreview = async () => {
    if (!tokenCA.trim()) return
    await handleJoinServer(tokenCA.trim())
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSearching) {
      if (serverPreview) {
        handleJoinFromPreview()
      } else {
        handleSearch()
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-white">Add Server</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Wallet size={18} className="text-neutral-400" />
                <h3 className="text-sm font-semibold text-white">Your Token Holdings (10k+ minimum)</h3>
              </div>

              {isLoadingWallet ? (
                <div className="flex items-center justify-center py-8 text-neutral-400">
                  <Loader2 size={24} className="animate-spin" />
                </div>
              ) : walletTokens.length === 0 ? (
                <div className="text-sm text-neutral-500 bg-neutral-800/50 border border-neutral-700 p-4">
                  No tokens found with minimum 10,000 balance. You can still search manually below.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {walletTokens.map((token) => (
                    <div
                      key={token.token.mint}
                      className="border border-neutral-700 bg-neutral-800 p-3 hover:bg-neutral-750 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {token.token.image ? (
                            <img
                              src={token.token.image || "/placeholder.svg"}
                              alt={token.token.symbol}
                              className="w-10 h-10 object-cover bg-neutral-700 flex-shrink-0"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = "none"
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 bg-neutral-700 flex items-center justify-center text-neutral-400 flex-shrink-0">
                              <Users size={18} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-white truncate">{token.token.name}</h4>
                            <p className="text-xs text-neutral-400">${token.token.symbol}</p>
                            <p className="text-xs text-neutral-500 mt-1">
                              Balance: {token.balance.toLocaleString()} tokens
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleJoinServer(token.token.mint)}
                          disabled={joiningTokenCA === token.token.mint}
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-none text-sm px-4 py-2 flex-shrink-0"
                        >
                          {joiningTokenCA === token.token.mint ? (
                            <>
                              <Loader2 size={14} className="animate-spin mr-2" />
                              Joining...
                            </>
                          ) : (
                            "Join"
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full h-px bg-neutral-700"></div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Search size={18} className="text-neutral-400" />
                <h3 className="text-sm font-semibold text-white">Search by Contract Address</h3>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300">Token Contract Address</label>
                <div className="flex gap-2">
                  <Input
                    value={tokenCA}
                    onChange={(e) => setTokenCA(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter Solana token contract address..."
                    className="flex-1 bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 rounded-none"
                    disabled={isSearching || joiningTokenCA !== null}
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={!tokenCA.trim() || isSearching || joiningTokenCA !== null}
                    className="bg-neutral-700 hover:bg-neutral-600 text-white rounded-none"
                  >
                    {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  </Button>
                </div>
              </div>

              {error && <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 p-3">{error}</div>}

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

                  <div className="text-sm space-y-2">
                    <div className="text-neutral-300">
                      Your balance:{" "}
                      <span className="font-medium">{serverPreview.userBalance.toLocaleString()} tokens</span>
                    </div>

                    {!serverPreview.exists && !serverPreview.hasMinimumTokens ? (
                      <div className="text-yellow-400">
                        <p>⚠ Server not yet created - You need 10,000+ tokens to create this server</p>
                      </div>
                    ) : serverPreview.exists && !serverPreview.hasMinimumTokens ? (
                      <div className="text-blue-400">
                        <p>ℹ You can view this server as a guest (read-only access to public channels)</p>
                      </div>
                    ) : serverPreview.hasMinimumTokens ? (
                      <div className="text-green-400">
                        {serverPreview.exists ? (
                          <p>✓ You can join this server as a member (10,000+ tokens required)</p>
                        ) : (
                          <p>✓ You can create this server (10,000+ tokens required)</p>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <Button
                    onClick={handleJoinFromPreview}
                    disabled={joiningTokenCA !== null || (!serverPreview.exists && !serverPreview.hasMinimumTokens)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-none disabled:bg-neutral-600 disabled:cursor-not-allowed"
                  >
                    {joiningTokenCA === tokenCA.trim() ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" />
                        {serverPreview.exists ? "Joining..." : "Creating..."}
                      </>
                    ) : serverPreview.exists ? (
                      serverPreview.hasMinimumTokens ? (
                        "Join Server"
                      ) : (
                        "View as Guest"
                      )
                    ) : serverPreview.hasMinimumTokens ? (
                      "Create & Join Server"
                    ) : (
                      "Cannot Create Server"
                    )}
                  </Button>
                </div>
              )}

              <div className="text-xs text-neutral-500">
                <p>Enter a Solana token contract address to find or create a server for that token community.</p>
                <p className="mt-1">You need to hold at least 10,000 tokens to participate as a member.</p>
                <p className="mt-1">If the server exists, you can view it as a guest with read-only access.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
