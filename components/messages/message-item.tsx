"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { format, isToday, isYesterday } from "date-fns"
import { MoreHorizontal, Reply, Edit, Trash2, Copy } from "lucide-react"
import { MessageAttachments } from "@/components/messages/message-attachments"
import { MessageEmbeds } from "@/components/messages/message-embeds"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type { Message } from "@/lib/types/messages"
import { useProfile } from "@/contexts/profile-context"
import { messagesService } from "@/lib/services/messages"

interface MessageItemProps {
  message: Message
  showAvatar?: boolean
  onReply?: (message: Message) => void
  onEdit?: (message: Message) => void
  onDelete?: (messageId: string) => void
  isEditing?: boolean
  onEditSubmit?: (messageId: string, content: string) => void
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
  const { profile } = useProfile()
  const [showActions, setShowActions] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<"below" | "above">("below")
  const [editContent, setEditContent] = useState(message.content || "")
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null)
  const messageRef = useRef<HTMLDivElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const isOwnMessage = profile?.id === message.author_id
  const messageDate = new Date(message.created_at)

  // Load the replied-to message if this message is a reply
  useEffect(() => {
    if (message.reply_to && !replyToMessage) {
      messagesService.getMessage(message.reply_to).then(setReplyToMessage)
    }
  }, [message.reply_to, replyToMessage])

  // Focus edit textarea when editing starts
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus()
      editTextareaRef.current.setSelectionRange(editContent.length, editContent.length)
    }
  }, [isEditing, editContent.length])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        actionsRef.current &&
        !actionsRef.current.contains(event.target as Node) &&
        messageRef.current &&
        !messageRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
        setShowActions(false)
      }
    }

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showDropdown])

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [])

  const formatMessageTime = (date: Date) => {
    if (isToday(date)) {
      return format(date, "HH:mm")
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, "HH:mm")}`
    } else {
      return format(date, "dd/MM/yyyy HH:mm")
    }
  }

  const copyMessageLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?message=${message.id}`
    navigator.clipboard.writeText(url)
    setShowDropdown(false)
    setShowActions(false)
  }

  const copyMessageText = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content)
    }
    setShowDropdown(false)
    setShowActions(false)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleEditSubmit()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      onEditCancel?.()
    }
  }

  const handleEditSubmit = () => {
    if (editContent.trim() && onEditSubmit) {
      onEditSubmit(message.id, editContent.trim())
    }
  }

  const handleEdit = () => {
    onEdit?.(message)
    setShowDropdown(false)
    setShowActions(false)
  }

  const handleDelete = () => {
    onDelete?.(message.id)
    setShowDropdown(false)
    setShowActions(false)
  }

  const handleDropdownToggle = () => {
    if (!showDropdown && dropdownTriggerRef.current) {
      // Calculate if dropdown should appear above or below
      const triggerRect = dropdownTriggerRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - triggerRect.bottom
      const spaceAbove = triggerRect.top

      // If there's less than 200px below and more space above, show above
      if (spaceBelow < 200 && spaceAbove > spaceBelow) {
        setDropdownPosition("above")
      } else {
        setDropdownPosition("below")
      }
    }
    setShowDropdown(!showDropdown)
  }

  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }

  const scheduleHide = () => {
    clearHideTimeout()
    hideTimeoutRef.current = setTimeout(() => {
      setShowActions(false)
    }, 100)
  }

  const scheduleDropdownHide = () => {
    clearHideTimeout()
    hideTimeoutRef.current = setTimeout(() => {
      setShowDropdown(false)
      setShowActions(false)
    }, 100)
  }

  const handleMouseEnter = () => {
    clearHideTimeout()
    setShowActions(true)
  }

  const handleMouseLeave = () => {
    // Always schedule hide when leaving message area
    // This will close both actions and dropdown if user doesn't hover over them
    scheduleDropdownHide()
  }

  const handleActionsMouseEnter = () => {
    clearHideTimeout()
    setShowActions(true)
  }

  const handleActionsMouseLeave = () => {
    // Always schedule hide when leaving actions area
    scheduleDropdownHide()
  }

  const handleDropdownMouseEnter = () => {
    clearHideTimeout()
    setShowActions(true)
  }

  const handleDropdownMouseLeave = () => {
    scheduleDropdownHide()
  }

  return (
    <div
      ref={messageRef}
      className="group relative flex items-start space-x-3 hover:bg-neutral-800/60 px-4 py-1 transition-colors duration-150"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Avatar or Time Placeholder */}
      <div className="w-10 flex-shrink-0 flex items-start justify-center mt-0.5">
        {showAvatar ? (
          <div
            className="w-10 h-10 bg-neutral-700 rounded-none flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onUserClick?.(message.author_id)}
          >
            {message.author.avatar ? (
              <img
                src={message.author.avatar || "/placeholder.svg"}
                alt={message.author.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-neutral-300">{message.author.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
            {format(messageDate, "HH:mm")}
          </span>
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        {showAvatar && (
          <div className="flex items-baseline space-x-2 mb-1">
            <span
              className="text-sm font-semibold text-neutral-100 hover:underline cursor-pointer"
              onClick={() => onUserClick?.(message.author_id)}
            >
              {message.author.name}
            </span>
            <span className="text-xs text-neutral-500">{formatMessageTime(messageDate)}</span>
            {message.edited_at && <span className="text-xs text-neutral-600">(edited)</span>}
          </div>
        )}

        {/* Reply indicator */}
        {message.reply_to && replyToMessage && (
          <div className="flex items-start space-x-2 mb-2 pl-3 border-l-2 border-neutral-700 bg-neutral-900/30 py-1 rounded-r">
            <Reply className="w-3 h-3 text-neutral-500 mt-1 flex-shrink-0" />
            <div className="text-xs text-neutral-400 min-w-0 flex-1">
              <div className="flex items-center space-x-1 mb-1">
                <span
                  className="text-neutral-300 font-medium hover:underline cursor-pointer"
                  onClick={() => onUserClick?.(replyToMessage.author_id)}
                >
                  {replyToMessage.author.name}
                </span>
              </div>
              {replyToMessage.content && (
                <div className="text-neutral-500 truncate max-w-md">{replyToMessage.content}</div>
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
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleEditKeyDown}
              className="bg-neutral-800 border-neutral-700 text-neutral-100 text-sm resize-none rounded-none"
              rows={Math.min(Math.max(editContent.split("\n").length, 1), 10)}
            />
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleEditSubmit}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-none h-7 text-xs"
                disabled={!editContent.trim()}
              >
                Save
              </Button>
              <Button
                onClick={onEditCancel}
                size="sm"
                variant="ghost"
                className="text-neutral-400 hover:text-neutral-200 rounded-none h-7 text-xs"
              >
                Cancel
              </Button>
              <span className="text-xs text-neutral-500">escape to cancel • enter to save</span>
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
      </div>

      {/* Message Actions - Positioned absolutely to prevent layout shift */}
      {(showActions || showDropdown) && !isEditing && (
        <div
          ref={actionsRef}
          className="absolute -top-2 right-4 flex items-center bg-neutral-800 border border-neutral-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50"
          style={{ opacity: showDropdown ? 1 : undefined }}
          onMouseEnter={handleActionsMouseEnter}
          onMouseLeave={handleActionsMouseLeave}
        >
          <button
            onClick={() => onReply?.(message)}
            className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition-colors border-r border-neutral-700"
            title="Reply"
          >
            <Reply className="w-4 h-4" />
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              ref={dropdownTriggerRef}
              onClick={handleDropdownToggle}
              className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Custom Dropdown */}
            {showDropdown && (
              <div
                className={`absolute right-0 bg-neutral-800 border border-neutral-700 rounded-none shadow-lg z-50 min-w-[160px] ${
                  dropdownPosition === "above" ? "bottom-full mb-1" : "top-full mt-1"
                }`}
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={handleDropdownMouseLeave}
              >
                <button
                  onClick={copyMessageText}
                  disabled={!message.content}
                  className="w-full flex items-center px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Text
                </button>

                <button
                  onClick={copyMessageLink}
                  className="w-full flex items-center px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </button>

                {isOwnMessage && (
                  <>
                    <button
                      onClick={handleEdit}
                      className="w-full flex items-center px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Message
                    </button>

                    <button
                      onClick={handleDelete}
                      className="w-full flex items-center px-3 py-2 text-sm text-red-400 hover:bg-red-600 hover:text-white transition-colors"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Message
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
