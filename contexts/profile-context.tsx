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
    } catch (err) {
      setError("Failed to load profile")
      console.error("Error loading profile:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const updateProfileData = (newProfile: Profile) => {
    setProfile(newProfile)
  }

  const updateStatus = async (status: "online" | "dnd" | "offline") => {
    if (!profile) return

    // Optimistic update
    const updatedProfile = { ...profile, status }
    setProfile(updatedProfile)

    try {
      // Update in database
      const result = await updateUserStatus(status)
      if (result.error) {
        console.error("❌ Failed to update status in database:", result.error)
        // Revert optimistic update
        setProfile(profile)
        throw new Error(result.error)
      }

      // Force refresh the members list immediately
      await membersService.forceRefreshMembers("solcord")

      // Also refresh profile from database
      await refreshProfile()
    } catch (error) {
      console.error("❌ Status update failed:", error)
      // Revert optimistic update
      setProfile(profile)
      throw error
    }
  }

  // Handle app visibility changes and page unload
  useEffect(() => {
    if (!profile) return

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        // Page became visible - set to online (unless user manually set to DND)
        if (profile.status === "offline") {
          try {
            await updateStatus("online")
          } catch (error) {
            console.error("Failed to set online status on visibility change:", error)
          }
        }
      } else {
        // Page became hidden - set to offline (unless user is DND)
        if (profile.status === "online") {
          try {
            await updateUserStatus("offline")
            setProfile({ ...profile, status: "offline" })
          } catch (error) {
            console.error("Failed to set offline status on visibility change:", error)
          }
        }
      }
    }

    const handleBeforeUnload = async () => {
      // User is closing the app - set to offline
      if (profile.status !== "offline") {
        try {
          // Use sendBeacon for reliable delivery during page unload
          const formData = new FormData()
          formData.append("status", "offline")

          if (navigator.sendBeacon) {
            navigator.sendBeacon("/api/update-status", formData)
          } else {
            // Fallback for browsers that don't support sendBeacon
            await updateUserStatus("offline")
          }
        } catch (error) {
          console.error("Failed to set offline status on page unload:", error)
        }
      }
    }

    const handleFocus = async () => {
      // Window gained focus - set to online (unless user manually set to DND)
      if (profile.status === "offline") {
        try {
          await updateStatus("online")
        } catch (error) {
          console.error("Failed to set online status on focus:", error)
        }
      }
    }

    const handleBlur = async () => {
      // Window lost focus - set to offline (unless user is DND)
      if (profile.status === "online") {
        try {
          await updateUserStatus("offline")
          setProfile({ ...profile, status: "offline" })
        } catch (error) {
          console.error("Failed to set offline status on blur:", error)
        }
      }
    }

    // Add event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("beforeunload", handleBeforeUnload)
    window.addEventListener("focus", handleFocus)
    window.addEventListener("blur", handleBlur)

    // Cleanup event listeners
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("blur", handleBlur)
    }
  }, [profile])

  useEffect(() => {
    const loadProfileAndSetOnline = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Load profile first
        const profileData = await getProfile()
        setProfile(profileData)

        // Set user to online when they open the app
        if (profileData) {
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
