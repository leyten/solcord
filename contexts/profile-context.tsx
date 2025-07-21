"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { getProfile, updateUserStatus } from "@/app/actions"
import { membersService } from "@/lib/services/members"

interface Profile {
  id: string
  username: string
  name: string
  pfp_url: string | null
  bio: string | null
  primary_wallet: string
  connections: any
  status: "online" | "dnd" | "offline"
  created_at: string
  updated_at: string
}

interface ProfileContextType {
  profile: Profile | null
  isLoading: boolean
  error: string | null
  refreshProfile: () => Promise<void>
  updateProfileData: (newProfile: Profile) => void
  updateStatus: (status: "online" | "dnd" | "offline") => Promise<void>
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshProfile = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const profileData = await getProfile()
      setProfile(profileData)
      console.log("🔄 Profile refreshed:", profileData?.name, "status:", profileData?.status)
    } catch (err) {
      setError("Failed to load profile")
      console.error("Error loading profile:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const updateProfileData = (newProfile: Profile) => {
    console.log("🔄 Profile data updated locally:", newProfile.name, "status:", newProfile.status)
    setProfile(newProfile)
  }

  const updateStatus = async (status: "online" | "dnd" | "offline") => {
    if (!profile) return

    console.log(`🔄 UPDATING STATUS: ${profile.status} -> ${status}`)

    // Optimistic update
    const updatedProfile = { ...profile, status }
    setProfile(updatedProfile)
    console.log("✅ Optimistic update applied")

    try {
      // Update in database
      const result = await updateUserStatus(status)
      if (result.error) {
        console.error("❌ Failed to update status in database:", result.error)
        // Revert optimistic update
        setProfile(profile)
        throw new Error(result.error)
      }

      console.log("✅ Status updated in database")

      // Force refresh the members list immediately
      console.log("🔄 Force refreshing members list...")
      await membersService.forceRefreshMembers("solcord")
      console.log("✅ Members list force refreshed")

      // Also refresh profile from database
      await refreshProfile()
      console.log("✅ Profile refreshed from database")
    } catch (error) {
      console.error("❌ Status update failed:", error)
      // Revert optimistic update
      setProfile(profile)
      throw error
    }
  }

  useEffect(() => {
    const loadProfileAndSetOnline = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Load profile first
        const profileData = await getProfile()
        setProfile(profileData)

        // If profile exists and user is not already online, set them online
        if (profileData && profileData.status !== "online") {
          console.log("🚀 Profile loaded, setting status to online")
          try {
            await updateUserStatus("online")
            // Update local profile status immediately
            setProfile({ ...profileData, status: "online" })
          } catch (error) {
            console.error("Failed to set initial online status:", error)
          }
        }
      } catch (err) {
        setError("Failed to load profile")
        console.error("Error loading profile:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadProfileAndSetOnline()
  }, [])

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        error,
        refreshProfile,
        updateProfileData,
        updateStatus,
      }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider")
  }
  return context
}
