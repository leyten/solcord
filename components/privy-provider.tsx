"use client"

import type React from "react"
import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth"
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana"

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  return (
    <BasePrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        // Configure Solana wallets
        embeddedWallets: {
          solana: {
            createOnLogin: "users-without-wallets",
          },
        },
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors(),
          },
        },
        appearance: {
          theme: "dark",
          accentColor: "#FFFFFF",
        },
        // Only allow wallet connections for Solana-native experience
        loginMethods: ["wallet"],
        legal: {
          termsAndConditionsUrl: "",
          privacyPolicyUrl: "",
        },
      }}
    >
      {children}
    </BasePrivyProvider>
  )
}
