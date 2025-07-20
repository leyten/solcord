"use client"

import type React from "react"

import { useState, memo, useRef, useEffect } from "react"
import { format, isToday, isYesterday } from "date-fns"
import { MoreHorizontal, Reply, Edit, Trash2, Copy, Check, X } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MessageAttachments } from "./message-attachments"
import { MessageEmbeds } from "./message-embeds"
import { MessageReactions } from "./message-reactions"
import { Textarea } from "@/components/ui/textarea"
import type { Message } from "@/lib/types/messages"
import { useProfile } from "@/contexts/profile-context"
import { messagesService } from "@/lib/services/messages"

interface MessageItemProps {
  message: Message
  showAvatar?: boolean
  isEditing?: boolean
  onReply?: (message: Message) => void
  onEdit?: (message: Message) => void
  onDelete?: (messageId: string) => void
  onEditSubmit?: (messageId: string, content: string) => void
  onEditCancel?: () => void
}

export const MessageItem = memo(function MessageItem({
  message,
  showAvatar = true,
  isEditing = false,
  onReply,
  onEdit,
  onDelete,
  onEditSubmit,
  onEditCancel,
}: MessageItemProps) {
  const { profile } = useProfile()
  const [showActions, setShowActions] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [editContent, setEditContent] = useState(message.content || "")
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  const isOwnMessage = profile?.id === message.author_id
  const messageDate = new Date(message.created_at)
  const editedDate = message.edited_at ? new Date(message.edited_at) : null

  // Fetch replied-to message if this is a reply
  useEffect(() => {
    if (message.reply_to) {
      messagesService.getMessage(message.reply_to).then((replyMsg) => {
        if (replyMsg) {
          setReplyToMessage(replyMsg)
        }
      })
    }
  }, [message.reply_to])

  // Auto-focus and resize edit textarea
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus()
      editTextareaRef.current.style.height = "auto"
      editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`
    }
  }, [isEditing])

  const formatMessageTime = (date: Date) => {
    if (isToday(date)) {
      return format(date, "HH:mm")
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, "HH:mm")}`
    } else {
      return format(date, "dd/MM/yyyy HH:mm")
    }
  }

  const copyMessageText = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content)
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleEditSubmit()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      handleEditCancel()
    }
  }

  const handleEditSubmit = () => {
    if (editContent.trim() && onEditSubmit) {
      onEditSubmit(message.id, editContent.trim())
    }
  }

  const handleEditCancel = () => {
    setEditContent(message.content || "")
    if (onEditCancel) {
      onEditCancel()
    }
  }

  const handleEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(e.target.value)
    // Auto-resize
    e.target.style.height = "auto"
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  // Keep actions visible when dropdown is open or when hovering
  const shouldShowActions = showActions || dropdownOpen

  return (
    <div
      className={`group relative flex items-start px-4 py-2 mx-[-16px] transition-all duration-150 hover:bg-neutral-900/50`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar or Spacer */}
      {showAvatar ? (
        <div className="w-10 h-10 bg-neutral-700 rounded-none flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden mr-3">
          {message.author.avatar ? (
            <img
              src={message.author.avatar || "/placeholder.svg"}
              alt={message.author.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-sm font-bold text-neutral-300">{message.author.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
      ) : (
        <div className="w-10 flex-shrink-0 mr-3" />
      )}

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        {showAvatar && (
          <div className="flex items-baseline space-x-2 mb-1">
            <span className="text-sm font-semibold text-neutral-100 hover:underline cursor-pointer">
              {message.author.name}
            </span>
            <span className="text-xs text-neutral-500">{formatMessageTime(messageDate)}</span>
            {message.edited_at && (
              <span className="text-xs text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded-sm">
                edited {editedDate && formatMessageTime(editedDate)}
              </span>
            )}
          </div>
        )}

        {/* Reply Preview */}
        {replyToMessage && (
          <div className="flex items-start space-x-2 mb-2 p-2 bg-neutral-800/50 border-l-2 border-neutral-600 rounded-r-sm">
            <Reply className="w-3 h-3 text-neutral-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-xs font-medium text-neutral-300">{replyToMessage.author.name}</span>
                <span className="text-xs text-neutral-500">
                  {formatMessageTime(new Date(replyToMessage.created_at))}
                </span>
              </div>
              {replyToMessage.content && (
                <div className="text-xs text-neutral-400 line-clamp-2 break-words">
                  {replyToMessage.content.length > 100
                    ? `${replyToMessage.content.substring(0, 100)}...`
                    : replyToMessage.content}
                </div>
              )}
              {replyToMessage.attachments && replyToMessage.attachments.length > 0 && (
                <div className="text-xs text-neutral-500 italic">
                  📎 {replyToMessage.attachments.length} attachment(s)
                </div>
              )}
            </div>
          </div>
        )}

        {/* Text Content or Edit Input */}
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              ref={editTextareaRef}
              value={editContent}
              onChange={handleEditChange}
              onKeyDown={handleEditKeyDown}
              className="bg-neutral-800 border-neutral-600 text-neutral-100 text-sm resize-none rounded-none min-h-[60px]"
              placeholder="Edit your message..."
            />
            <div className="flex items-center space-x-2 text-xs text-neutral-500">
              <span>Press Enter to save • Escape to cancel</span>
              <div className="flex space-x-1 ml-auto">
                <button
                  onClick={handleEditCancel}
                  className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleEditSubmit}
                  className="p-1 text-neutral-500 hover:text-green-400 transition-colors"
                  title="Save"
                  disabled={!editContent.trim()}
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          message.content && (
            <div className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </div>
          )
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2">
            <MessageAttachments attachments={message.attachments} />
          </div>
        )}

        {/* Embeds */}
        {message.embeds && message.embeds.length > 0 && (
          <div className="mt-2">
            <MessageEmbeds embeds={message.embeds} />
          </div>
        )}

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="mt-2">
            <MessageReactions messageId={message.id} reactions={message.reactions} />
          </div>
        )}
      </div>

      {/* Message Actions - Fixed positioning */}
      {!isEditing && (
        <div
          className={`absolute top-1 right-4 flex items-center space-x-1 bg-neutral-800 border border-neutral-700 rounded-none shadow-lg transition-opacity duration-150 ${
            shouldShowActions ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <button
            onClick={() => onReply?.(message)}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition-colors"
            title="Reply"
          >
            <Reply className="w-4 h-4" />
          </button>

          <DropdownMenu onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-neutral-800 border-neutral-700 text-neutral-100 rounded-none"
            >
              <DropdownMenuItem
                onClick={copyMessageText}
                className="hover:bg-neutral-700 cursor-pointer rounded-none focus:bg-neutral-700 focus:text-neutral-100"
                disabled={!message.content}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Text
              </DropdownMenuItem>

              {isOwnMessage && (
                <>
                  <DropdownMenuItem
                    onClick={() => onEdit?.(message)}
                    className="hover:bg-neutral-700 cursor-pointer rounded-none focus:bg-neutral-700 focus:text-neutral-100"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Message
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => onDelete?.(message.id)}
                    className="hover:bg-red-600 cursor-pointer rounded-none focus:bg-red-600 focus:text-white text-red-400"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Message
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
})
