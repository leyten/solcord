"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { MoreHorizontal, Reply, Edit, Trash2, Pin, Copy, Flag } from "lucide-react"
import { MessageAttachments } from "./message-attachments"
import { MessageEmbeds } from "./message-embeds"
import { MessageReactions } from "./message-reactions"
import type { Message } from "@/lib/types/messages"
import { useProfile } from "@/contexts/profile-context"
import { Textarea } from "@/components/ui/textarea"

interface MessageItemProps {
  message: Message
  showAvatar?: boolean
  onReply?: (message: Message) => void
  onEdit?: (message: Message) => void
  onDelete?: (messageId: string) => void
  isEditing?: boolean
  onEditSubmit?: (messageId: string, newContent: string) => void
  onEditCancel?: () => void
  onUserClick?: (userId: string) => void
}

export function MessageItem({
  message,
  showAvatar = true,
  onReply,
  onEdit,
  onDelete,
  isEditing = false,
  onEditSubmit,
  onEditCancel,
  onUserClick,
}: MessageItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [editContent, setEditContent] = useState(message.content || "")
  const menuRef = useRef<HTMLDivElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)
  const { profile } = useProfile()

  const isOwnMessage = profile?.id === message.author_id
  const messageTime = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus()
      editTextareaRef.current.setSelectionRange(editContent.length, editContent.length)
    }
  }, [isEditing, editContent.length])

  const handleEditSubmit = () => {
    if (editContent.trim() && onEditSubmit) {
      onEditSubmit(message.id, editContent.trim())
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleEditSubmit()
    }
    if (e.key === "Escape") {
      onEditCancel?.()
    }
  }

  const handleUserClick = () => {
    if (onUserClick) {
      onUserClick(message.author_id)
    }
  }

  return (
    <div className="group flex items-start space-x-3 px-4 py-2 hover:bg-neutral-900/50 transition-colors">
      {/* Avatar */}
      {showAvatar ? (
        <button
          onClick={handleUserClick}
          className="flex-shrink-0 w-10 h-10 bg-neutral-700 rounded-none flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity"
        >
          {message.author.avatar ? (
            <img
              src={message.author.avatar || "/placeholder.svg"}
              alt={message.author.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-bold text-neutral-400">{message.author.name.charAt(0).toUpperCase()}</span>
          )}
        </button>
      ) : (
        <div className="w-10 flex-shrink-0 flex justify-center">
          <span className="text-xs text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity">
            {messageTime}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        {showAvatar && (
          <div className="flex items-baseline space-x-2 mb-1">
            <button onClick={handleUserClick} className="font-semibold text-neutral-200 hover:underline text-sm">
              {message.author.name}
            </button>
            <span className="text-xs text-neutral-500">{messageTime}</span>
            {message.edited_at && <span className="text-xs text-neutral-600">(edited)</span>}
          </div>
        )}

        {/* Message content */}
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              ref={editTextareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleEditKeyDown}
              className="bg-neutral-800 border-neutral-700 text-neutral-100 text-sm rounded-none resize-none"
              rows={3}
            />
            <div className="flex space-x-2 text-xs">
              <button
                onClick={handleEditSubmit}
                className="text-blue-400 hover:text-blue-300"
                disabled={!editContent.trim()}
              >
                Save
              </button>
              <button onClick={onEditCancel} className="text-neutral-500 hover:text-neutral-400">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {message.content && (
              <div className="text-neutral-300 text-sm leading-relaxed break-words">{message.content}</div>
            )}

            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <MessageAttachments attachments={message.attachments} />
            )}

            {/* Embeds */}
            {message.embeds && message.embeds.length > 0 && <MessageEmbeds embeds={message.embeds} />}

            {/* Reactions */}
            {message.reactions && message.reactions.length > 0 && (
              <MessageReactions reactions={message.reactions} messageId={message.id} />
            )}
          </>
        )}
      </div>

      {/* Actions */}
      {!isEditing && (
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-none transition-all"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* Context Menu */}
          {showMenu && (
            <div
              ref={menuRef}
              className="absolute right-0 top-8 bg-neutral-800 border border-neutral-700 rounded-none shadow-lg z-10 min-w-[160px]"
            >
              {onReply && (
                <button
                  onClick={() => {
                    onReply(message)
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
                >
                  <Reply className="w-4 h-4 mr-2" />
                  Reply
                </button>
              )}

              <button
                onClick={() => {
                  navigator.clipboard.writeText(message.content || "")
                  setShowMenu(false)
                }}
                className="w-full flex items-center px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Text
              </button>

              {isOwnMessage && onEdit && (
                <button
                  onClick={() => {
                    onEdit(message)
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </button>
              )}

              <button
                onClick={() => setShowMenu(false)}
                className="w-full flex items-center px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
              >
                <Pin className="w-4 h-4 mr-2" />
                Pin Message
              </button>

              {!isOwnMessage && (
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full flex items-center px-3 py-2 text-sm text-red-400 hover:bg-neutral-700 transition-colors"
                >
                  <Flag className="w-4 h-4 mr-2" />
                  Report
                </button>
              )}

              {isOwnMessage && onDelete && (
                <button
                  onClick={() => {
                    onDelete(message.id)
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-red-400 hover:bg-neutral-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
