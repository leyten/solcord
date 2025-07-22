"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { getProfile, updateUserStatus } from "@/app/actions"

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

    console.log(`🔄 Updating status from ${profile.status} to ${status}`)

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

      console.log(`✅ Status updated successfully in database: ${status}`)

      // The real-time subscription will handle updating the members list automatically
      // No need to force refresh anymore since we have real-time updates

      // Also refresh profile from database to ensure consistency
      await refreshProfile()
    } catch (error) {
      console.error("❌ Status update failed:", error)
      // Revert optimistic update
      setProfile(profile)
      throw error
    }
  }

  // Set user offline when closing browser/tab
  const setOfflineOnExit = () => {
    if (profile && profile.status !== "offline") {
      console.log("🚪 Browser/tab closing, setting status to offline")

      // Use sendBeacon for reliable delivery during page unload
      const formData = new FormData()
      formData.append("status", "offline")

      if (navigator.sendBeacon) {
        const success = navigator.sendBeacon("/api/update-status", formData)
        console.log(`📡 SendBeacon result: ${success}`)
      } else {
        // Fallback - make synchronous request (less reliable but better than nothing)
        try {
          const xhr = new XMLHttpRequest()
          xhr.open("POST", "/api/update-status", false) // synchronous
          xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded")
          xhr.send("status=offline")
          console.log("📡 Fallback XHR request sent")
        } catch (error) {
          console.error("Failed to send fallback request:", error)
        }
      }
    }
  }

  // Handle app visibility changes and page unload
  useEffect(() => {
    if (!profile) return

    const handleVisibilityChange = async () => {
      console.log(`👁️ Visibility changed: ${document.visibilityState}`)

      if (document.visibilityState === "visible") {
        // Page became visible - set to online (unless user manually set to DND)
        if (profile.status === "offline") {
          try {
            console.log("📱 Page became visible, setting status to online")
            await updateStatus("online")
          } catch (error) {
            console.error("Failed to set online status on visibility change:", error)
          }
        }
      }
      // Don't set offline on visibility hidden - could be file dialogs, other windows, etc.
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      console.log("🚨 beforeunload event triggered - tab/browser closing")
      setOfflineOnExit()
      // Don't prevent the unload, just set status
    }

    const handleUnload = () => {
      console.log("🚨 unload event triggered - tab/browser closing")
      setOfflineOnExit()
    }

    const handlePageHide = () => {
      console.log("🚨 pagehide event triggered - tab/browser closing")
      setOfflineOnExit()
    }

    // Only add the events that actually indicate tab/browser closing
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("beforeunload", handleBeforeUnload)
    window.addEventListener("unload", handleUnload)
    window.addEventListener("pagehide", handlePageHide)

    // Cleanup event listeners
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      window.removeEventListener("unload", handleUnload)
      window.removeEventListener("pagehide", handlePageHide)
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
            console.log("🚀 App loaded, setting initial status to online")
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
