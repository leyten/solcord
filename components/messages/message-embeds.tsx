"use client"

import { memo } from "react"
import { ExternalLink, Play } from "lucide-react"
import type { MessageEmbed } from "@/lib/types/messages"

interface MessageEmbedsProps {
  embeds: MessageEmbed[]
}

export const MessageEmbeds = memo(function MessageEmbeds({ embeds }: MessageEmbedsProps) {
  return (
    <div className="space-y-3">
      {embeds.map((embed, index) => (
        <div key={index} className="border-l-4 border-blue-500 bg-neutral-800/50 p-4 rounded-none max-w-md">
          {/* Author/Site Name */}
          {(embed.author || embed.site_name) && (
            <div className="text-xs text-neutral-400 mb-2">{embed.author || embed.site_name}</div>
          )}

          {/* Title */}
          {embed.title && (
            <div className="font-semibold text-neutral-100 mb-2 hover:underline">
              <a href={embed.url} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2">
                <span>{embed.title}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Description */}
          {embed.description && <div className="text-sm text-neutral-300 mb-3 line-clamp-3">{embed.description}</div>}

          {/* Media */}
          {embed.type === "image" && embed.thumbnail && (
            <div className="mb-2">
              <img
                src={embed.thumbnail || "/placeholder.svg"}
                alt={embed.title || "Embedded image"}
                className="rounded-none max-h-64 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(embed.url, "_blank")}
                loading="lazy"
              />
            </div>
          )}

          {embed.type === "video" && embed.thumbnail && (
            <div className="relative mb-2 cursor-pointer group" onClick={() => window.open(embed.url, "_blank")}>
              <img
                src={embed.thumbnail || "/placeholder.svg"}
                alt={embed.title || "Video thumbnail"}
                className="rounded-none max-h-64 group-hover:opacity-90 transition-opacity"
                loading="lazy"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/60 rounded-full p-3 group-hover:bg-black/80 transition-colors">
                  <Play className="w-6 h-6 text-white fill-current" />
                </div>
              </div>
            </div>
          )}

          {/* URL */}
          <div className="text-xs text-neutral-500">
            <a href={embed.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {new URL(embed.url).hostname}
            </a>
          </div>
        </div>
      ))}
    </div>
  )
})
