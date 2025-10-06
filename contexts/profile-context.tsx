"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { usePrivy } from "@privy-io/react-auth"
import { createClient } from "@/lib/supabase/client"

interface Profile {
  id: string
  name: string
  username: string
  primary_wallet: string
  pfp_url?: string
  bio?: string
  connections?: Record<string, string>
  status: "online" | "dnd" | "offline"
  created_at: string
  updated_at: string
}

interface ProfileContextType {
  profile: Profile | null
  isLoading: boolean
  refreshProfile: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<boolean>
  updateStatus: (status: "online" | "dnd" | "offline") => Promise<boolean>
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, authenticated } = usePrivy()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Load profile function
  const loadProfile = async () => {
    if (!authenticated || !user) {
      setProfile(null)
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single()

      if (error) {
        console.error("Error loading profile:", error)
        setProfile(null)
      } else {
        setProfile(data)
      }
    } catch (error) {
      console.error("Error in loadProfile:", error)
      setProfile(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Refresh profile function (exposed to components)
  const refreshProfile = async () => {
    if (!authenticated || !user) return

    setIsLoading(true)
    await loadProfile()
  }

  // Load profile when user is authenticated
  useEffect(() => {
    loadProfile()
  }, [authenticated, user, supabase])

  // Set user online when they load the app
  useEffect(() => {
    if (!profile?.id) return

    const setOnline = async () => {
      try {
        await updateStatus("online")
      } catch (error) {
        console.error("Error setting user online:", error)
      }
    }

    setOnline()
  }, [profile?.id])

  // Handle browser/tab closing to set user offline
  useEffect(() => {
    if (!profile?.id) return

    const setOfflineOnExit = () => {

      // Use sendBeacon for reliable offline status on page unload
      const data = new FormData()
      data.append("status", "offline")

      try {
        // Try sendBeacon first (most reliable for page unload)
        if (navigator.sendBeacon) {
          const success = navigator.sendBeacon("/api/update-status", data)
        } else {
          // Fallback to synchronous XHR
          const xhr = new XMLHttpRequest()
          xhr.open("POST", "/api/update-status", false) // synchronous
          xhr.send(data)
        }
      } catch (error) {
        console.error("Error setting offline status:", error)
      }
    }

    // Handle page visibility changes
    const handleVisibilityChange = () => {

      if (document.visibilityState === "visible") {
        // User came back to the tab - set them online
        updateStatus("online")
      }
      // Don't set offline on hidden - only on actual tab closing
    }

    // Add event listeners for browser/tab closing
    window.addEventListener("beforeunload", setOfflineOnExit)
    window.addEventListener("unload", setOfflineOnExit)
    window.addEventListener("pagehide", setOfflineOnExit)

    // Add visibility change listener
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("beforeunload", setOfflineOnExit)
      window.removeEventListener("unload", setOfflineOnExit)
      window.removeEventListener("pagehide", setOfflineOnExit)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [profile?.id])

  const updateProfile = async (updates: Partial<Profile>): Promise<boolean> => {
    if (!profile?.id) return false

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
        .select()
        .single()

      if (error) {
        console.error("Error updating profile:", error)
        return false
      }

      setProfile(data)
      return true
    } catch (error) {
      console.error("Error in updateProfile:", error)
      return false
    }
  }

  const updateStatus = async (status: "online" | "dnd" | "offline"): Promise<boolean> => {
    if (!profile?.id) return false

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)

      if (error) {
        console.error("Error updating status:", error)
        return false
      }

      setProfile((prev) => (prev ? { ...prev, status } : null))
      return true
    } catch (error) {
      console.error("Error in updateStatus:", error)
      return false
    }
  }

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        refreshProfile,
        updateProfile,
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
