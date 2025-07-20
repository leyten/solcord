"use server"

import { createClient } from "@/lib/supabase/server"
import { PrivyClient } from "@privy-io/server-auth"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

const privy = new PrivyClient(process.env.NEXT_PUBLIC_PRIVY_APP_ID!, process.env.PRIVY_APP_SECRET!)

// Server-side validation limits
const NAME_LIMIT = 50
const BIO_LIMIT = 500
const CONNECTION_LIMIT = 100

export async function getProfile() {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get("privy-token")?.value

    if (!authToken) {
      return null
    }

    const claims = await privy.verifyAuthToken(authToken)
    const supabase = await createClient()

    // Use the Privy DID directly as the id
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", claims.userId).single()

    return profile
  } catch (error) {
    console.error("Error getting profile:", error)
    return null
  }
}

export async function updateUserStatus(status: "online" | "dnd" | "offline") {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get("privy-token")?.value

    if (!authToken) {
      return { error: "Not authenticated" }
    }

    const claims = await privy.verifyAuthToken(authToken)
    const supabase = await createClient()

    const { error } = await supabase
      .from("profiles")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claims.userId)

    if (error) {
      console.error("Supabase error:", error)
      return { error: "Failed to update status" }
    }

    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Error updating status:", error)
    return { error: "Failed to update status" }
  }
}

export async function checkUsernameAvailability(username: string) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get("privy-token")?.value

    if (!authToken) {
      return { available: false, error: "Not authenticated" }
    }

    const claims = await privy.verifyAuthToken(authToken)

    // Basic validation first
    if (!username || username.length < 3 || username.length > 15) {
      return { available: false, error: "Username must be 3-15 characters" }
    }

    if (!/^[a-z0-9_]{3,15}$/.test(username)) {
      return { available: false, error: "Username can only contain lowercase letters, numbers, and underscores" }
    }

    const supabase = await createClient()

    // Check if username exists, excluding current user
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .neq("id", claims.userId)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" which means username is available
      console.error("Database error:", error)
      return { available: false, error: "Failed to check availability" }
    }

    const available = !data // If no data found, username is available
    return {
      available,
      error: available ? null : "Username is already taken",
      suggestion: available ? null : await generateUsernameSuggestion(username, supabase, claims.userId),
    }
  } catch (error) {
    console.error("Error checking username availability:", error)
    return { available: false, error: "Failed to check availability" }
  }
}

async function generateUsernameSuggestion(baseUsername: string, supabase: any, currentUserId: string) {
  // Try adding numbers 1-99 to the base username
  for (let i = 1; i <= 99; i++) {
    const suggestion = `${baseUsername}${i}`
    if (suggestion.length > 15) break // Don't exceed length limit

    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", suggestion)
      .neq("id", currentUserId)
      .single()

    if (!data) {
      return suggestion // This suggestion is available
    }
  }

  // If all numbered suggestions are taken, try with underscores
  for (let i = 1; i <= 9; i++) {
    const suggestion = `${baseUsername}_${i}`
    if (suggestion.length > 15) break

    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", suggestion)
      .neq("id", currentUserId)
      .single()

    if (!data) {
      return suggestion
    }
  }

  return null // No suggestions available
}

export async function uploadProfilePicture(formData: FormData) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get("privy-token")?.value

    if (!authToken) {
      return { error: "Not authenticated" }
    }

    const claims = await privy.verifyAuthToken(authToken)
    const file = formData.get("file") as File

    if (!file) {
      return { error: "No file provided" }
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return { error: "File must be an image" }
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { error: "File size must be less than 5MB" }
    }

    const supabase = await createClient()

    // Create a unique filename with timestamp to avoid caching issues
    const fileExt = file.name.split(".").pop()
    const timestamp = Date.now()
    const fileName = `${claims.userId}_${timestamp}.${fileExt}`

    // Delete old profile pictures for this user to keep storage clean
    const { data: existingFiles } = await supabase.storage.from("profile-pictures").list("", { search: claims.userId })

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.filter((file) => file.name.startsWith(claims.userId)).map((file) => file.name)

      if (filesToDelete.length > 0) {
        await supabase.storage.from("profile-pictures").remove(filesToDelete)
      }
    }

    // Upload the new file
    const { data, error } = await supabase.storage.from("profile-pictures").upload(fileName, file, {
      contentType: file.type,
    })

    if (error) {
      console.error("Storage upload error:", error)
      return { error: "Failed to upload image" }
    }

    // Get the public URL with cache-busting parameter
    const { data: urlData } = supabase.storage.from("profile-pictures").getPublicUrl(fileName)
    const urlWithCacheBust = `${urlData.publicUrl}?t=${timestamp}`

    return { success: true, url: urlWithCacheBust }
  } catch (error) {
    console.error("Error uploading profile picture:", error)
    return { error: "Failed to upload image" }
  }
}

export async function createProfile(prevState: any, formData: FormData) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get("privy-token")?.value

    if (!authToken) {
      return { error: "Not authenticated" }
    }

    const claims = await privy.verifyAuthToken(authToken)
    const user = await privy.getUser(claims.userId)

    const username = formData.get("username") as string
    const name = formData.get("name") as string
    const bio = formData.get("bio") as string
    const pfpUrl = formData.get("pfp_url") as string

    // Basic validation
    if (!username || !name) {
      return { error: "Username and Name are required." }
    }

    // Server-side length validation
    if (name.length > NAME_LIMIT) {
      return { error: `Name must be ${NAME_LIMIT} characters or less` }
    }

    if (bio && bio.length > BIO_LIMIT) {
      return { error: `Bio must be ${BIO_LIMIT} characters or less` }
    }

    if (username.length < 3 || username.length > 15) {
      return { error: "Username must be between 3 and 15 characters" }
    }

    // Get the primary wallet address with proper type checking
    const solanaWallet = user.linkedAccounts.find(
      (account) => account.type === "wallet" && account.chainType === "solana",
    )

    if (!solanaWallet || solanaWallet.type !== "wallet") {
      return { error: "No Solana wallet found" }
    }

    // Now TypeScript knows solanaWallet is a wallet type with an address
    const walletAddress = solanaWallet.address

    const supabase = await createClient()

    // Use the Privy DID directly as the id (no UUID conversion needed)
    const { error } = await supabase.from("profiles").insert({
      id: claims.userId, // This is the Privy DID like "did:privy:cmd7j2kbx002rkz0nmmksydmx"
      username,
      name,
      bio,
      pfp_url: pfpUrl || null,
      primary_wallet: walletAddress,
      status: "online", // Default status when creating profile
    })

    if (error) {
      console.error("Supabase error:", error)
      if (error.code === "23505") {
        // Unique constraint violation
        return { error: "Username is already taken" }
      }
      return { error: "Failed to create profile" }
    }

    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Error creating profile:", error)
    return { error: "Failed to create profile" }
  }
}

export async function updateProfile(prevState: any, formData: FormData) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get("privy-token")?.value

    if (!authToken) {
      return { error: "Not authenticated" }
    }

    const claims = await privy.verifyAuthToken(authToken)
    const supabase = await createClient()

    const username = formData.get("username") as string
    const name = formData.get("name") as string
    const bio = formData.get("bio") as string
    const pfpUrl = formData.get("pfp_url") as string
    const primaryWallet = formData.get("primary_wallet") as string
    const socialConnectionsStr = formData.get("social_connections") as string

    // Basic validation
    if (!username || !name) {
      return { error: "Username and Name are required." }
    }

    // Server-side length validation
    if (name.length > NAME_LIMIT) {
      return { error: `Name must be ${NAME_LIMIT} characters or less` }
    }

    if (bio && bio.length > BIO_LIMIT) {
      return { error: `Bio must be ${BIO_LIMIT} characters or less` }
    }

    if (username.length < 3 || username.length > 15) {
      return { error: "Username must be between 3 and 15 characters" }
    }

    // Parse JSON data
    let socialConnections = {}

    try {
      if (socialConnectionsStr) {
        socialConnections = JSON.parse(socialConnectionsStr)

        // Validate social connection values
        for (const [platform, value] of Object.entries(socialConnections)) {
          if (typeof value === "string" && value.length > CONNECTION_LIMIT) {
            return { error: `Social connection values must be ${CONNECTION_LIMIT} characters or less` }
          }
        }
      }
    } catch (error) {
      console.error("Error parsing JSON data:", error)
      return { error: "Invalid data format" }
    }

    // Use the Privy DID directly as the id
    const { error } = await supabase
      .from("profiles")
      .update({
        username,
        name,
        bio,
        pfp_url: pfpUrl || null,
        primary_wallet: primaryWallet || null,
        connections: Object.keys(socialConnections).length > 0 ? socialConnections : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claims.userId)

    if (error) {
      console.error("Supabase error:", error)
      if (error.code === "23505") {
        return { error: "Username is already taken" }
      }
      return { error: "Failed to update profile" }
    }

    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Error updating profile:", error)
    return { error: "Failed to update profile" }
  }
}
