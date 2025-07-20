"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { User, Upload, X, Loader2 } from "lucide-react"
import { uploadProfilePicture } from "@/app/actions"

interface ProfilePictureUploadProps {
  currentUrl?: string
  onUpload: (url: string) => void
  size?: "sm" | "md" | "lg"
}

export function ProfilePictureUpload({ currentUrl, onUpload, size = "lg" }: ProfilePictureUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Update preview when currentUrl changes
  useEffect(() => {
    setPreviewUrl(currentUrl || null)
  }, [currentUrl])

  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-20 h-20",
    lg: "w-24 h-24",
  }

  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 28,
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file")
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB")
      return
    }

    setError(null)
    setIsUploading(true)

    // Show preview immediately
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const result = await uploadProfilePicture(formData)

      if (result.error) {
        setError(result.error)
        setPreviewUrl(currentUrl || null) // Revert preview
      } else if (result.url) {
        // Use the new URL with cache-busting
        setPreviewUrl(result.url)
        onUpload(result.url)
      }
    } catch (error) {
      setError("Failed to upload image")
      setPreviewUrl(currentUrl || null) // Revert preview
    } finally {
      setIsUploading(false)
      // Clear the file input to allow re-uploading the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleFileUpload = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    fileInputRef.current?.click()
  }

  const handleRemove = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    setPreviewUrl(null)
    onUpload("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col items-center space-y-3">
      <div className="relative">
        <div
          className={`${sizeClasses[size]} bg-neutral-800 border border-neutral-700 flex items-center justify-center relative overflow-hidden`}
        >
          {previewUrl ? (
            <img
              src={previewUrl || "/placeholder.svg"}
              alt="Profile"
              className="w-full h-full object-cover"
              key={previewUrl} // Force re-render when URL changes
            />
          ) : (
            <User className="text-neutral-500" size={iconSizes[size]} />
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Upload/Remove buttons - repositioned and resized */}
        <div className="absolute -bottom-1 -right-1 flex space-x-1">
          <button
            onClick={handleFileUpload}
            disabled={isUploading}
            className="w-6 h-6 bg-white text-black border border-neutral-700 flex items-center justify-center rounded-none hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            title="Upload image"
          >
            <Upload className="w-3 h-3" />
          </button>

          {previewUrl && (
            <button
              onClick={handleRemove}
              disabled={isUploading}
              className="w-6 h-6 bg-red-600 text-white border border-neutral-700 flex items-center justify-center rounded-none hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              title="Remove image"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-400 text-center max-w-[200px]">{error}</p>}

      <p className="text-xs text-neutral-500 text-center max-w-[200px]">Click to upload • Max 5MB • JPG, PNG, GIF</p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        onClick={(e) => e.stopPropagation()}
        className="hidden"
      />
    </div>
  )
}
