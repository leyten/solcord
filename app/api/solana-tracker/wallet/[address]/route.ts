import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { address: string } }) {
  try {
    const { address } = params

    if (!address) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 400 })
    }

    const apiKey = process.env.SOLANA_TRACKER_API_KEY
    if (!apiKey) {
      console.error("SOLANA_TRACKER_API_KEY environment variable is not set")
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    const response = await fetch(`https://data.solanatracker.io/wallet/${address}`, {
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
        "User-Agent": "Solcord/1.0",
      },
    })

    if (!response.ok) {
      console.error(`Solana Tracker API error: ${response.status} ${response.statusText}`)
      return NextResponse.json({ error: "Wallet not found or invalid address" }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching wallet data:", error)
    return NextResponse.json({ error: "Failed to fetch wallet data" }, { status: 500 })
  }
}
