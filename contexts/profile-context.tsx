"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { getProfile } from "@/app/actions"

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

  useEffect(() => {
    refreshProfile()
  }, [])

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        error,
        refreshProfile,
        updateProfileData,
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
