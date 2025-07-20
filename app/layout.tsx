import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

import { PrivyProvider } from "@/components/privy-provider"

export const metadata: Metadata = {
  title: "SolCord",
  description: "The ultimate token-gated chat platform",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <PrivyProvider>{children}</PrivyProvider>
      </body>
    </html>
  )
}
