"use client"

import type { MessageAttachment } from "@/lib/types/messages"
import { Download, FileText, ImageIcon, Video, ExternalLink } from "lucide-react"

interface DMMessageAttachmentsProps {
  attachments: MessageAttachment[]
  isOwn: boolean
}

export function DMMessageAttachments({ attachments, isOwn }: DMMessageAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith("image/")) return <ImageIcon className="w-3 h-3" />
    if (contentType.startsWith("video/")) return <Video className="w-3 h-3" />
    return <FileText className="w-3 h-3" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  return (
    <div className="space-y-1 mt-1">
      {attachments.map((attachment) => (
        <div key={attachment.id}>
          {attachment.content_type.startsWith("image/") ? (
            <div className="relative group max-w-xs">
              <img
                src={attachment.url || "/placeholder.svg"}
                alt={attachment.filename}
                className="rounded border border-neutral-600 cursor-pointer hover:opacity-90 transition-opacity max-h-48 object-cover"
                onClick={() => window.open(attachment.url, "_blank")}
              />
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(attachment.url, "_blank")
                  }}
                  className="p-1 bg-black/50 hover:bg-black/70 rounded transition-colors"
                >
                  <ExternalLink className="w-3 h-3 text-white" />
                </button>
              </div>
            </div>
          ) : attachment.content_type.startsWith("video/") ? (
            <div className="relative max-w-xs">
              <video
                src={attachment.url}
                controls
                className="rounded border border-neutral-600 max-h-48"
                preload="metadata"
              />
            </div>
          ) : (
            <div
              className="flex items-center space-x-2 p-2 bg-neutral-800/50 border border-neutral-600 rounded cursor-pointer hover:bg-neutral-700/50 transition-colors max-w-xs"
              onClick={() => window.open(attachment.url, "_blank")}
            >
              <div className="flex-shrink-0 text-neutral-400">{getFileIcon(attachment.content_type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-neutral-200">{attachment.filename}</p>
                <p className="text-xs text-neutral-500">{formatFileSize(attachment.size)}</p>
              </div>
              <div className="flex-shrink-0 text-neutral-400">
                <Download className="w-3 h-3" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
