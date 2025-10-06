"use client"

import { useState, useEffect, useActionState, useRef, useCallback } from "react"
import { X, Plus, Trash2, Check, AlertCircle, Loader2, Wallet, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ProfilePictureUpload } from "@/components/profile-picture-upload"
import { updateProfile, checkUsernameAvailability, updateUserStatus } from "@/app/actions"
import { useProfile } from "@/contexts/profile-context"
import { usePrivy } from "@privy-io/react-auth"

interface EditProfileProps {
  onClose: () => void
  isEmbedded?: boolean
  onSave?: () => void
  onHasChanges?: (hasChanges: boolean) => void
}

interface Connection {
  platform: string
  value: string
}

interface UsernameStatus {
  checking: boolean
  available: boolean | null
  error: string | null
  suggestion: string | null
}

const socialPlatforms = [
  {
    id: "twitter",
    name: "X",
    placeholder: "username",
    prefix: "@",
    validate: (value: string) => /^[a-zA-Z0-9_]{1,15}$/.test(value),
    format: (value: string) => `@${value.replace("@", "")}`,
  },
  {
    id: "email",
    name: "Email",
    placeholder: "your@email.com",
    validate: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    format: (value: string) => value,
  },
  {
    id: "github",
    name: "GitHub",
    placeholder: "username",
    validate: (value: string) => /^[a-zA-Z0-9]([a-zA-Z0-9-]){0,38}$/.test(value),
    format: (value: string) => value,
  },
  {
    id: "discord",
    name: "Discord",
    placeholder: "username",
    prefix: "@",
    validate: (value: string) => /^[a-zA-Z0-9_]{2,32}$/.test(value),
    format: (value: string) => `@${value.replace("@", "")}`,
  },
  {
    id: "telegram",
    name: "Telegram",
    placeholder: "username",
    prefix: "@",
    validate: (value: string) => /^[a-zA-Z0-9_]{5,32}$/.test(value),
    format: (value: string) => `@${value.replace("@", "")}`,
  },
  {
    id: "website",
    name: "Website",
    placeholder: "yoursite.com",
    validate: (value: string) => {
      try {
        new URL(value.startsWith("http") ? value : `https://${value}`)
        return true
      } catch {
        return false
      }
    },
    format: (value: string) => (value.startsWith("http") ? value : `https://${value}`),
  },
]

// Character limits
const NAME_LIMIT = 50
const BIO_LIMIT = 500
const CONNECTION_LIMIT = 100

export function EditProfile({ onClose, isEmbedded = false, onSave, onHasChanges }: EditProfileProps) {
  const { profile, isLoading, refreshProfile } = useProfile()
  const { user, linkWallet, unlinkWallet, logout } = usePrivy()
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>({
    checking: false,
    available: null,
    error: null,
    suggestion: null,
  })
  const [bio, setBio] = useState("")
  const [workingPfpUrl, setWorkingPfpUrl] = useState("") // This is what user is currently working with
  const [originalPfpUrl, setOriginalPfpUrl] = useState("") // This is what's saved in DB
  const [connections, setConnections] = useState<Connection[]>([])
  const [showAddConnection, setShowAddConnection] = useState(false)
  const [newConnection, setNewConnection] = useState({ platform: "", value: "" })
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isChangingWallet, setIsChangingWallet] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const [updateState, updateAction, isUpdating] = useActionState(updateProfile, null)
  const formRef = useRef<HTMLFormElement>(null)
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Get current wallet info
  const currentWallet = user?.linkedAccounts.find(
    (account) => account.type === "wallet" && account.chainType === "solana",
  )

  // Debounced username availability check
  const checkUsername = useCallback(
    async (usernameToCheck: string) => {
      if (!usernameToCheck || usernameToCheck === (profile?.username || "")) {
        setUsernameStatus({ checking: false, available: null, error: null, suggestion: null })
        return
      }

      if (usernameToCheck.length < 3) {
        setUsernameStatus({
          checking: false,
          available: false,
          error: "Username must be at least 3 characters",
          suggestion: null,
        })
        return
      }

      if (!/^[a-z0-9_]{3,15}$/.test(usernameToCheck)) {
        setUsernameStatus({
          checking: false,
          available: false,
          error: "Username can only contain lowercase letters, numbers, and underscores",
          suggestion: null,
        })
        return
      }

      setUsernameStatus({ checking: true, available: null, error: null, suggestion: null })

      try {
        const result = await checkUsernameAvailability(usernameToCheck)
        setUsernameStatus({
          checking: false,
          available: result.available,
          error: result.error,
          suggestion: result.suggestion || null,
        })
      } catch (error) {
        setUsernameStatus({
          checking: false,
          available: false,
          error: "Failed to check availability",
          suggestion: null,
        })
      }
    },
    [profile?.username],
  )

  // Debounced username check
  useEffect(() => {
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current)
    }

    checkTimeoutRef.current = setTimeout(() => {
      checkUsername(username)
    }, 500) // 500ms debounce

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current)
      }
    }
  }, [username, checkUsername])

  // Load profile data when profile changes - only set initial values
  useEffect(() => {
    if (profile) {
      setName(profile.name || "")
      setUsername(profile.username || "")
      setBio(profile.bio || "")

      // Set both working and original URLs
      const pfpUrl = profile.pfp_url || ""
      setWorkingPfpUrl(pfpUrl)
      setOriginalPfpUrl(pfpUrl)

      // Set up social connections
      if (profile.connections) {
        const connections = Object.entries(profile.connections).map(([platform, value]) => ({
          platform,
          value: value as string,
        }))
        setConnections(connections)
      }
      setHasChanges(false)

      // Reset username status when profile loads
      setUsernameStatus({ checking: false, available: null, error: null, suggestion: null })
    }
  }, [profile])

  // Handle successful update
  useEffect(() => {
    if (updateState?.success) {
      // Update the original URL to match what we just saved
      setOriginalPfpUrl(workingPfpUrl)
      refreshProfile()
      setHasChanges(false)
      if (onSave) {
        onSave()
      } else {
        onClose()
      }
    }
  }, [updateState, workingPfpUrl, onClose, onSave, refreshProfile])

  // Track changes and notify parent
  useEffect(() => {
    if (profile) {
      const hasNameChange = name !== (profile.name || "")
      const hasUsernameChange = username !== (profile.username || "")
      const hasBioChange = bio !== (profile.bio || "")
      const hasPfpChange = workingPfpUrl !== originalPfpUrl

      // Check if wallet has changed
      const currentWalletAddress = currentWallet?.type === "wallet" ? currentWallet.address : ""
      const hasWalletChange = currentWalletAddress !== (profile.primary_wallet || "")

      // Check social connections changes
      const currentConnections = connections.reduce((acc, conn) => ({ ...acc, [conn.platform]: conn.value }), {})
      const originalConnections = profile.connections || {}
      const hasSocialChange = JSON.stringify(currentConnections) !== JSON.stringify(originalConnections)

      const hasAnyChanges =
        hasNameChange || hasUsernameChange || hasBioChange || hasPfpChange || hasSocialChange || hasWalletChange
      setHasChanges(hasAnyChanges)

      // Notify parent component about changes
      if (onHasChanges) {
        onHasChanges(hasAnyChanges)
      }
    }
  }, [name, username, bio, workingPfpUrl, originalPfpUrl, connections, profile, onHasChanges, currentWallet])

  // Expose submit function to parent
  useEffect(() => {
    if (isEmbedded) {
      // Store submit function on window for parent to access
      ;(window as any).submitProfileForm = () => {
        if (formRef.current && hasChanges) {
          formRef.current.requestSubmit()
        }
      }
    }
  }, [isEmbedded, hasChanges])

  const handleChangeWallet = async () => {
    try {
      setIsChangingWallet(true)

      // If there's already a wallet connected, unlink it first
      if (currentWallet && currentWallet.type === "wallet") {
        await unlinkWallet(currentWallet.address)
      }

      // Then link the new wallet
      await linkWallet()

      // After linking, refresh profile to get updated wallet info
      await refreshProfile()
    } catch (error) {
      console.error("Failed to change wallet:", error)
    } finally {
      setIsChangingWallet(false)
    }
  }

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)

      // Set status to offline before logging out
      try {
        await updateUserStatus("offline")
      } catch (error) {
        console.error("❌ Failed to set status to offline before logout:", error)
        // Continue with logout even if status update fails
      }

      // Now logout
      await logout()
      // The logout will redirect the user automatically
    } catch (error) {
      console.error("Failed to logout:", error)
      setIsLoggingOut(false)
    }
  }

  const addConnection = () => {
    const platform = socialPlatforms.find((p) => p.id === newConnection.platform)
    if (!platform || !newConnection.value) return

    const formattedValue = platform.format(newConnection.value)
    if (!platform.validate(newConnection.value.replace(platform.prefix || "", ""))) return

    setConnections([...connections, { platform: newConnection.platform, value: formattedValue }])
    setNewConnection({ platform: "", value: "" })
    setShowAddConnection(false)
  }

  const removeConnection = (index: number) => {
    setConnections(connections.filter((_, i) => i !== index))
  }

  const startEdit = (index: number) => {
    const conn = connections[index]
    const platform = socialPlatforms.find((p) => p.id === conn.platform)
    let editValue = conn.value
    if (platform?.prefix) {
      editValue = editValue.replace(platform.prefix, "")
    }
    setNewConnection({ platform: conn.platform, value: editValue })
    setEditingIndex(index)
    setShowAddConnection(true)
  }

  const saveEdit = () => {
    if (editingIndex === null) return

    const platform = socialPlatforms.find((p) => p.id === newConnection.platform)
    if (!platform || !newConnection.value) return

    const formattedValue = platform.format(newConnection.value)
    if (!platform.validate(newConnection.value.replace(platform.prefix || "", ""))) return

    const updated = [...connections]
    updated[editingIndex] = { platform: newConnection.platform, value: formattedValue }
    setConnections(updated)
    setNewConnection({ platform: "", value: "" })
    setShowAddConnection(false)
    setEditingIndex(null)
  }

  const cancelAdd = () => {
    setNewConnection({ platform: "", value: "" })
    setShowAddConnection(false)
    setEditingIndex(null)
  }

  const useSuggestion = () => {
    if (usernameStatus.suggestion) {
      setUsername(usernameStatus.suggestion)
    }
  }

  // Helper function to show character count when approaching limit
  const shouldShowCount = (current: number, limit: number) => {
    return current > limit * 0.8 // Show when 80% of limit is reached
  }

  // Check if form can be submitted
  const canSubmit = () => {
    return (
      hasChanges &&
      username.length >= 3 &&
      name.length > 0 &&
      (usernameStatus.available === true || username === (profile?.username || "")) &&
      !usernameStatus.checking
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">Loading profile...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Failed to load profile</div>
      </div>
    )
  }

  const renderContent = () => (
    <form ref={formRef} action={updateAction} className="h-full flex flex-col">
      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Profile Picture */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-3">Profile Picture</label>
              <ProfilePictureUpload currentUrl={workingPfpUrl} onUpload={setWorkingPfpUrl} size="md" />
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Display Name
                {shouldShowCount(name.length, NAME_LIMIT) && (
                  <span className="text-xs text-neutral-500 ml-2">
                    ({name.length}/{NAME_LIMIT})
                  </span>
                )}
              </label>
              <Input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, NAME_LIMIT))}
                className="bg-neutral-800 border-neutral-700 text-neutral-100 h-9 rounded-none"
                placeholder="Your display name"
                required
                maxLength={NAME_LIMIT}
              />
            </div>

            {/* Username with availability check */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 z-10">@</span>
                <Input
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.slice(0, 15).toLowerCase())}
                  className={`bg-neutral-800 border-neutral-700 text-neutral-100 pl-8 pr-10 h-9 rounded-none ${
                    usernameStatus.available === false
                      ? "border-red-500"
                      : usernameStatus.available === true
                        ? "border-green-500"
                        : ""
                  }`}
                  placeholder="username"
                  pattern="^[a-z0-9_]{3,15}$"
                  title="Username must be 3-15 characters long and can only contain lowercase letters, numbers, and underscores."
                  required
                  maxLength={15}
                />

                {/* Status indicator */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus.checking && <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />}
                  {!usernameStatus.checking && usernameStatus.available === true && (
                    <Check className="w-4 h-4 text-green-500" />
                  )}
                  {!usernameStatus.checking && usernameStatus.available === false && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>

              {/* Status messages */}
              {usernameStatus.error && (
                <div className="mt-1 flex items-start space-x-2">
                  <p className="text-xs text-red-400 flex-1">{usernameStatus.error}</p>
                  {usernameStatus.suggestion && (
                    <button
                      type="button"
                      onClick={useSuggestion}
                      className="text-xs text-blue-400 hover:text-blue-300 underline whitespace-nowrap"
                    >
                      Try "{usernameStatus.suggestion}"
                    </button>
                  )}
                </div>
              )}
              {usernameStatus.available === true && username !== (profile?.username || "") && (
                <p className="text-xs text-green-400 mt-1">Username is available!</p>
              )}
              {username.length < 3 && username.length > 0 && !usernameStatus.error && (
                <p className="text-xs text-neutral-500 mt-1">Username must be at least 3 characters</p>
              )}
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Bio
                {shouldShowCount(bio.length, BIO_LIMIT) && (
                  <span className="text-xs text-neutral-500 ml-2">
                    ({bio.length}/{BIO_LIMIT})
                  </span>
                )}
              </label>
              <Textarea
                name="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, BIO_LIMIT))}
                className="bg-neutral-800 border-neutral-700 text-neutral-100 resize-none rounded-none"
                placeholder="Tell us about yourself..."
                rows={3}
                maxLength={BIO_LIMIT}
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Connected Wallet */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-3">Connected Wallet</label>
              <div className="bg-neutral-800 border border-neutral-700 p-3 rounded-none">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm text-neutral-300 font-mono">
                      {currentWallet && currentWallet.type === "wallet" ? (
                        <>
                          {currentWallet.address.slice(0, 8)}...{currentWallet.address.slice(-8)}
                        </>
                      ) : (
                        "No wallet connected"
                      )}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">Primary Solana wallet</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {currentWallet && currentWallet.type === "wallet" && (
                      <div className="w-5 h-5 bg-transparent border border-green-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-green-500" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Wallet Actions */}
                <div className="mt-3">
                  <Button
                    type="button"
                    onClick={handleChangeWallet}
                    disabled={isChangingWallet}
                    size="sm"
                    className="bg-white text-black hover:bg-neutral-200 h-7 px-3 text-xs rounded-none disabled:bg-neutral-700 disabled:text-neutral-500"
                  >
                    {isChangingWallet ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Wallet className="w-3 h-3 mr-1" />
                        {currentWallet ? "Change Wallet" : "Connect Wallet"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Social Connections */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-neutral-300">Social Connections</label>
                {!showAddConnection && (
                  <Button
                    type="button"
                    onClick={() => setShowAddConnection(true)}
                    size="sm"
                    variant="outline"
                    className="border-neutral-600 bg-transparent h-7 px-3 text-xs rounded-none"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                )}
              </div>

              <div className="flex-1 space-y-3 min-h-0">
                {/* Existing Connections */}
                {connections.map((connection, index) => {
                  const platform = socialPlatforms.find((p) => p.id === connection.platform)
                  return (
                    <div key={index} className="bg-neutral-800 border border-neutral-700 p-3 rounded-none space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-neutral-400 font-medium">{platform?.name}</div>
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => startEdit(index)}
                            className="p-1.5 text-neutral-500 hover:text-neutral-300 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeConnection(index)}
                            className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-neutral-200 font-mono break-all">{connection.value}</div>
                    </div>
                  )
                })}

                {/* Add/Edit Form */}
                {showAddConnection && (
                  <div className="bg-neutral-800 border border-neutral-700 p-4 rounded-none space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Platform</label>
                        <select
                          value={newConnection.platform}
                          onChange={(e) => setNewConnection({ ...newConnection, platform: e.target.value, value: "" })}
                          className="w-full bg-neutral-900 border border-neutral-600 text-neutral-100 text-sm p-2 pr-8 rounded-none appearance-none"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                            backgroundPosition: "right 8px center",
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "16px 16px",
                          }}
                        >
                          <option value="">Select Platform</option>
                          {socialPlatforms.map((platform) => (
                            <option key={platform.id} value={platform.id}>
                              {platform.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Only show value input if platform is selected */}
                      {newConnection.platform && (
                        <div>
                          <label className="block text-xs text-neutral-400 mb-1">
                            {newConnection.platform === "website"
                              ? "Website URL"
                              : `${socialPlatforms.find((p) => p.id === newConnection.platform)?.name} Handle`}
                          </label>
                          <div className="relative">
                            <Input
                              value={newConnection.value}
                              onChange={(e) =>
                                setNewConnection({ ...newConnection, value: e.target.value.slice(0, CONNECTION_LIMIT) })
                              }
                              placeholder={
                                socialPlatforms.find((p) => p.id === newConnection.platform)?.placeholder ||
                                "Enter value..."
                              }
                              className={`bg-neutral-900 border-neutral-600 text-neutral-100 h-9 text-sm rounded-none ${
                                socialPlatforms.find((p) => p.id === newConnection.platform)?.prefix ? "pl-8" : ""
                              }`}
                              maxLength={CONNECTION_LIMIT}
                            />
                            {socialPlatforms.find((p) => p.id === newConnection.platform)?.prefix && (
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm pointer-events-none z-10">
                                {socialPlatforms.find((p) => p.id === newConnection.platform)?.prefix}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Validation Error */}
                    {newConnection.platform &&
                      newConnection.value &&
                      (() => {
                        const platform = socialPlatforms.find((p) => p.id === newConnection.platform)
                        const cleanValue = newConnection.value.replace(platform?.prefix || "", "")
                        const isValid = platform?.validate(cleanValue)
                        if (!isValid) {
                          return (
                            <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 p-2 rounded-none">
                              {platform?.id === "email" && "Please enter a valid email address"}
                              {platform?.id === "twitter" &&
                                "Username must be 1-15 characters, letters/numbers/underscore only"}
                              {platform?.id === "github" && "Invalid GitHub username format"}
                              {platform?.id === "discord" &&
                                "Username must be 2-32 characters, letters/numbers/underscore only"}
                              {platform?.id === "telegram" &&
                                "Username must be 5-32 characters, letters/numbers/underscore only"}
                              {platform?.id === "website" && "Please enter a valid URL"}
                            </div>
                          )
                        }
                        return null
                      })()}

                    <div className="flex justify-end space-x-2 pt-2">
                      <Button
                        type="button"
                        onClick={cancelAdd}
                        size="sm"
                        variant="ghost"
                        className="h-8 px-3 text-xs text-neutral-400 hover:text-neutral-200 rounded-none"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={editingIndex !== null ? saveEdit : addConnection}
                        size="sm"
                        className="h-8 px-3 text-xs bg-white text-black hover:bg-neutral-200 rounded-none"
                        disabled={
                          !newConnection.platform ||
                          !newConnection.value ||
                          (() => {
                            const platform = socialPlatforms.find((p) => p.id === newConnection.platform)
                            const cleanValue = newConnection.value.replace(platform?.prefix || "", "")
                            return !platform?.validate(cleanValue)
                          })()
                        }
                      >
                        {editingIndex !== null ? "Save" : "Add"}
                      </Button>
                    </div>
                  </div>
                )}

                {connections.length === 0 && !showAddConnection && (
                  <div className="text-center py-8 text-neutral-500 text-sm">No social connections added yet</div>
                )}
              </div>
            </div>

            {/* Account Actions */}
            <div className="pt-4 border-t border-neutral-800">
              <label className="block text-sm font-medium text-neutral-300 mb-3">Account Actions</label>
              <div className="space-y-2">
                <Button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  variant="outline"
                  className="w-full border-red-600 text-red-400 bg-transparent hover:bg-red-600 hover:text-white rounded-none h-9"
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing Out...
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden inputs */}
      <input type="hidden" name="pfp_url" value={workingPfpUrl} />
      <input
        type="hidden"
        name="primary_wallet"
        value={currentWallet?.type === "wallet" ? currentWallet.address : ""}
      />
      <input
        type="hidden"
        name="social_connections"
        value={JSON.stringify(connections.reduce((acc, conn) => ({ ...acc, [conn.platform]: conn.value }), {}))}
      />

      {/* Error Display */}
      {updateState?.error && (
        <div className="mx-4 mb-4 text-sm text-red-400 bg-red-900/20 border border-red-800 p-3 rounded-none">
          {updateState.error}
        </div>
      )}

      {/* Footer - only show if not embedded */}
      {!isEmbedded && (
        <div className="flex items-center justify-end space-x-3 p-4 border-t border-neutral-800">
          <Button
            type="button"
            onClick={onClose}
            variant="ghost"
            className="text-neutral-400 hover:text-neutral-200 h-8 rounded-none"
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="hover:bg-blue-700 h-8 rounded-none text-black bg-white disabled:bg-neutral-700 disabled:text-neutral-500"
            disabled={isUpdating || !canSubmit()}
          >
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-neutral-900 border border-neutral-700 rounded-none w-full max-w-md p-6">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-red-600/20 rounded-none flex items-center justify-center mx-auto">
                <LogOut className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-100 mb-2">Sign Out</h3>
                <p className="text-sm text-neutral-400">
                  Are you sure you want to sign out? You'll need to reconnect your wallet to access your account again.
                </p>
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={() => setShowLogoutConfirm(false)}
                  variant="outline"
                  className="flex-1 border-neutral-600 text-neutral-300 bg-transparent hover:bg-neutral-800 rounded-none"
                  disabled={isLoggingOut}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleLogout}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-none"
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing Out...
                    </>
                  ) : (
                    "Sign Out"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  )

  if (isEmbedded) {
    return renderContent()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-neutral-100">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            disabled={isUpdating}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {renderContent()}
      </div>
    </div>
  )
}
