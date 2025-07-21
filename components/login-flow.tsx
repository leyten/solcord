"use client"

import React from "react"
import { useState, useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SolcordUI } from "@/components/solcord-ui"
import { usePrivy } from "@privy-io/react-auth"
import { createProfile, getProfile, updateUserStatus } from "@/app/actions"
import { ProfilePictureUpload } from "@/components/profile-picture-upload"

interface LoginFlowProps {
  onComplete: () => void
}

type LoginStep = "welcome" | "connect" | "profile"

export function LoginFlow({ onComplete }: LoginFlowProps) {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const [currentStep, setCurrentStep] = useState<LoginStep>("welcome")
  const [profileState, profileAction, isPending] = useActionState(createProfile, null)
  const [pfpUrl, setPfpUrl] = useState<string>("")

  const handleConnect = async () => {
    try {
      await login()
      // After successful connection, check if profile exists
      const existingProfile = await getProfile()
      if (existingProfile) {
        onComplete()
        return
      }
      // No profile exists, go to profile creation
      setCurrentStep("profile")
    } catch (error) {
      console.log("Connection failed or no existing profile found")
      // If connection succeeded but no profile, go to profile step
      if (authenticated) {
        setCurrentStep("profile")
      }
    }
  }

  const handleBackFromProfile = async () => {
    try {
      // Set status to offline before logging out
      console.log("🔄 Setting status to offline before logout from profile setup")
      try {
        await updateUserStatus("offline")
        console.log("✅ Successfully set status to offline before logout")
      } catch (error) {
        console.error("❌ Failed to set status to offline before logout:", error)
        // Continue with logout even if status update fails
      }

      await logout()
      setCurrentStep("connect")
    } catch (error) {
      console.error("Failed to logout:", error)
    }
  }

  // Handle successful profile creation
  React.useEffect(() => {
    if (profileState?.success) {
      onComplete()
    }
  }, [profileState, onComplete])

  const renderStep = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Welcome to SolCord</h1>
              <p className="text-neutral-400">Connect with crypto communities like never before</p>
            </div>

            <div className="space-y-4">
              <div className="text-left space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white"></div>
                  <span className="text-sm text-neutral-300">Token-gated servers only for holders</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white"></div>
                  <span className="text-sm text-neutral-300">Social feeds combined with channels</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white"></div>
                  <span className="text-sm text-neutral-300">{"Ranks based on % holding"}</span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setCurrentStep("connect")}
              className="w-full bg-white text-black hover:bg-neutral-200 h-10 rounded-none"
            >
              Get Started
            </Button>
          </div>
        )

      case "connect":
        return (
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Connect Your Wallet</h2>
              <p className="text-neutral-400">
                Connect your Solana wallet to verify token holdings and access token-gated channels
              </p>
            </div>

            <div className="bg-neutral-900 border border-neutral-700 p-4 space-y-3">
              <div className="text-left space-y-2">
                <div className="text-sm font-medium text-neutral-300">What we'll check:</div>
                <div className="space-y-1 text-xs text-neutral-400">
                  <div>• SPL token balances for channel access</div>
                  <div>• SOL balance for rank calculation</div>
                  <div>• Wallet history for verification</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex space-x-3">
                <Button
                  onClick={() => setCurrentStep("welcome")}
                  variant="outline"
                  className="flex-1 border-neutral-600 text-neutral-300 bg-transparent hover:bg-neutral-800 h-10 rounded-none"
                >
                  Back
                </Button>
                <Button
                  onClick={handleConnect}
                  disabled={!ready}
                  className="flex-1 bg-white text-black hover:bg-neutral-200 h-10 rounded-none disabled:bg-neutral-700 disabled:text-neutral-500"
                >
                  {!ready ? "Loading..." : "Connect Solana Wallet"}
                </Button>
              </div>
              <p className="text-xs text-neutral-500">Supports Phantom, Solflare, and other Solana wallets</p>
            </div>
          </div>
        )

      case "profile":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-white">Set Up Your Profile</h2>
              <p className="text-neutral-400">Customize how you appear in the community</p>
              {user?.linkedAccounts.find((account) => account.type === "wallet" && account.chainType === "solana") && (
                <p className="text-xs text-neutral-500 font-mono">
                  Connected: {(() => {
                    const wallet = user.linkedAccounts.find(
                      (account) => account.type === "wallet" && account.chainType === "solana",
                    )
                    if (wallet?.type === "wallet") {
                      return `${wallet.address.slice(0, 8)}...${wallet.address.slice(-8)}`
                    }
                    return "Wallet connected"
                  })()}
                </p>
              )}
            </div>

            <form action={profileAction} className="space-y-4">
              {/* Profile Picture Upload */}
              <div className="text-center">
                <ProfilePictureUpload currentUrl={pfpUrl} onUpload={setPfpUrl} size="lg" />
              </div>

              {/* Hidden input to pass pfp_url to form */}
              <input type="hidden" name="pfp_url" value={pfpUrl} />

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Display Name *</label>
                <Input
                  name="name"
                  placeholder="Enter your display name"
                  className="bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 h-10 rounded-none"
                  required
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Username *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">@</span>
                  <Input
                    name="username"
                    placeholder="username"
                    className="bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 pl-8 h-10 rounded-none"
                    required
                    pattern="^[a-z0-9_]{3,15}$"
                    title="Username must be 3-15 characters long and can only contain lowercase letters, numbers, and underscores."
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Bio</label>
                <Textarea
                  name="bio"
                  placeholder="Tell the community about yourself..."
                  className="bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 resize-none rounded-none"
                  rows={3}
                />
              </div>

              {/* Error Display */}
              {profileState?.error && (
                <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 p-3 rounded-none">
                  {profileState.error}
                </div>
              )}

              <div className="flex space-x-3">
                <Button
                  type="button"
                  onClick={handleBackFromProfile}
                  variant="outline"
                  className="flex-1 border-neutral-600 text-neutral-300 bg-transparent hover:bg-neutral-800 h-10 rounded-none"
                  disabled={isPending}
                >
                  Disconnect & Back
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-500 h-10 rounded-none"
                >
                  {isPending ? "Creating Profile..." : "Complete Setup"}
                </Button>
              </div>
            </form>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred background with SolCord UI */}
      <div className="absolute inset-0">
        <div className="w-full h-full blur-sm opacity-30">
          <SolcordUI />
        </div>
        <div className="absolute inset-0 bg-black/60"></div>
      </div>

      {/* Login window */}
      <div className="relative bg-neutral-950 border border-neutral-800 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 ${currentStep === "welcome" || currentStep === "connect" || currentStep === "profile" ? "bg-white" : "bg-neutral-600"}`}
            ></div>
            <div
              className={`w-2 h-2 ${currentStep === "connect" || currentStep === "profile" ? "bg-white" : "bg-neutral-600"}`}
            ></div>
            <div className={`w-2 h-2 ${currentStep === "profile" ? "bg-white" : "bg-neutral-600"}`}></div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">{renderStep()}</div>
      </div>
    </div>
  )
}
