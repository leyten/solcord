"use client"

import { useState, memo } from "react"
import { Download, FileText, ImageIcon, Video, Music, Archive } from "lucide-react"
import type { MessageAttachment } from "@/lib/types/messages"

interface MessageAttachmentsProps {
  attachments: MessageAttachment[]
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

const getFileIcon = (contentType: string) => {
  if (contentType.startsWith("image/")) return ImageIcon
  if (contentType.startsWith("video/")) return Video
  if (contentType.startsWith("audio/")) return Music
  if (contentType.includes("zip") || contentType.includes("rar") || contentType.includes("tar")) return Archive
  return FileText
}

export const MessageAttachments = memo(function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const handleImageError = (attachmentId: string) => {
    setImageErrors((prev) => new Set(prev).add(attachmentId))
  }

  const isImage = (contentType: string) => contentType.startsWith("image/")
  const isVideo = (contentType: string) => contentType.startsWith("video/")

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => {
        const FileIcon = getFileIcon(attachment.content_type)
        const hasImageError = imageErrors.has(attachment.id)

        if (isImage(attachment.content_type) && !hasImageError) {
          return (
            <div key={attachment.id} className="max-w-md">
              <img
                src={attachment.url || "/placeholder.svg"}
                alt={attachment.filename}
                className="rounded-none max-h-96 cursor-pointer hover:opacity-90 transition-opacity"
                onError={() => handleImageError(attachment.id)}
                onClick={() => window.open(attachment.url, "_blank")}
                loading="lazy"
              />
              <div className="text-xs text-neutral-500 mt-1">
                {attachment.filename} • {formatFileSize(attachment.size)}
              </div>
            </div>
          )
        }

        if (isVideo(attachment.content_type)) {
          return (
            <div key={attachment.id} className="max-w-md">
              <video controls className="rounded-none max-h-96 w-full" preload="metadata">
                <source src={attachment.url} type={attachment.content_type} />
                Your browser does not support the video tag.
              </video>
              <div className="text-xs text-neutral-500 mt-1">
                {attachment.filename} • {formatFileSize(attachment.size)}
              </div>
            </div>
          )
        }

        // Generic file attachment
        return (
          <div
            key={attachment.id}
            className="flex items-center space-x-3 bg-neutral-800 border border-neutral-700 p-3 rounded-none max-w-md hover:bg-neutral-750 transition-colors cursor-pointer"
            onClick={() => window.open(attachment.url, "_blank")}
          >
            <div className="p-2 bg-neutral-700 rounded-none">
              <FileIcon className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-neutral-200 truncate">{attachment.filename}</div>
              <div className="text-xs text-neutral-500">{formatFileSize(attachment.size)}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const link = document.createElement("a")
                link.href = attachment.url
                link.download = attachment.filename
                link.click()
              }}
              className="p-2 text-neutral-500 hover:text-neutral-300 transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
})
