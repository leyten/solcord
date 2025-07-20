"use client"

import { usePrivy } from "@privy-io/react-auth"
import { SolcordUI } from "@/components/solcord-ui"
import { LoginFlow } from "@/components/login-flow"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface ClientPageProps {
  hasProfile: boolean
}

export function ClientPage({ hasProfile: initialHasProfile }: ClientPageProps) {
  const { ready, authenticated, login } = usePrivy()
  const [hasProfile, setHasProfile] = useState(initialHasProfile)

  if (!ready) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-950">
        <div className="text-neutral-400">Loading...</div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative bg-neutral-950 border border-neutral-800 w-full max-w-md p-6">
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Welcome to SolCord</h1>
              <p className="text-neutral-400">The Solana-native community platform</p>
            </div>
            <div className="space-y-4">
              <div className="text-left space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white"></div>
                  <span className="text-sm text-neutral-300">SPL token-gated servers</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white"></div>
                  <span className="text-sm text-neutral-300">Solana wallet verification</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white"></div>
                  <span className="text-sm text-neutral-300">{"Ranks based on SOL & token holdings"}</span>
                </div>
              </div>
            </div>
            <Button onClick={login} className="w-full bg-white text-black hover:bg-neutral-200 h-10 rounded-none">
              Connect Solana Wallet
            </Button>
            <p className="text-xs text-neutral-500">Supports Phantom, Solflare, and other Solana wallets</p>
          </div>
        </div>
      </div>
    )
  }

  if (authenticated && !hasProfile) {
    return <LoginFlow onComplete={() => setHasProfile(true)} />
  }

  return <SolcordUI />
}
