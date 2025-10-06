import { PrivyClient } from "@privy-io/server-auth"

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!
const privyAppSecret = process.env.PRIVY_APP_SECRET!

if (!privyAppSecret) {
  throw new Error("PRIVY_APP_SECRET is not set")
}

export const privyServer = new PrivyClient(privyAppId, privyAppSecret)

// Helper to verify Privy auth token from request
export async function verifyPrivyToken(authToken: string): Promise<{ userId: string } | null> {
  try {
    const verifiedClaims = await privyServer.verifyAuthToken(authToken)
    return { userId: verifiedClaims.userId }
  } catch (error) {
    console.error("Error verifying Privy token:", error)
    return null
  }
}
