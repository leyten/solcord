"use client"

import { useState, memo } from "react"
import { Plus } from "lucide-react"
import type { MessageReaction } from "@/lib/types/messages"

interface MessageReactionsProps {
  messageId: string
  reactions: MessageReaction[]
}

export const MessageReactions = memo(function MessageReactions({ messageId, reactions }: MessageReactionsProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const commonEmojis = ["👍", "👎", "❤️", "😂", "😮", "😢", "😡", "🎉"]

  const handleReaction = (emoji: string) => {
    // TODO: Implement reaction logic with messagesService
    console.log("React with", emoji, "to message", messageId)
  }

  return (
    <div className="flex items-center space-x-2 flex-wrap">
      {reactions.map((reaction, index) => (
        <button
          key={index}
          onClick={() => handleReaction(reaction.emoji)}
          className={`flex items-center space-x-1 px-2 py-1 rounded-none text-xs transition-colors ${
            reaction.reacted
              ? "bg-blue-600/20 border border-blue-500/50 text-blue-300"
              : "bg-neutral-800 border border-neutral-700 text-neutral-300 hover:bg-neutral-700"
          }`}
        >
          <span>{reaction.emoji}</span>
          <span>{reaction.count}</span>
        </button>
      ))}

      {/* Add Reaction Button */}
      <div className="relative">
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="flex items-center justify-center w-8 h-8 bg-neutral-800 border border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700 transition-colors rounded-none"
          title="Add reaction"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Simple Emoji Picker */}
        {showEmojiPicker && (
          <div className="absolute bottom-full left-0 mb-2 bg-neutral-800 border border-neutral-700 p-2 rounded-none shadow-lg z-10">
            <div className="grid grid-cols-4 gap-1">
              {commonEmojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    handleReaction(emoji)
                    setShowEmojiPicker(false)
                  }}
                  className="w-8 h-8 flex items-center justify-center hover:bg-neutral-700 rounded-none transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
