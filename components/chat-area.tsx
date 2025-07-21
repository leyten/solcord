"use client"

import type React from "react"
import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import { Hash, Send, Paperclip, AtSign, X, Loader2, Reply, AlertTriangle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VoiceChat } from "@/components/voice-chat"
import { Feed } from "@/components/feed"
import { MessageItem } from "@/components/messages/message-item"
import { ProfileView } from "@/components/profile-view"
import type { Channel, ChannelUser } from "@/lib/types"
import type { Message } from "@/lib/types/messages"
import { Textarea } from "@/components/ui/textarea"
import { messagesService } from "@/lib/services/messages"
import { useProfile } from "@/contexts/profile-context"

interface ChatAreaProps {
  channel: Channel
  messages: Message[]
  users: ChannelUser[]
  onToggleUserList: () => void
  userListCollapsed: boolean
  onOpenSettings?: () => void
}

export function ChatArea({ channel, users, onOpenSettings }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [selectedUser, setSelectedUser] = useState<ChannelUser | null>(null)
  const [showProfileView, setShowProfileView] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const { profile } = useProfile()

  // Load messages when channel changes
  useEffect(() => {
    if (!channel?.id) return

    const loadMessages = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await messagesService.getChannelMessages(channel.id)
        setMessages(result.messages)
        setHasMore(result.hasMore)

        // Scroll to bottom immediately after messages are loaded
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
          }
        }, 0)
      } catch (error) {
        console.error("Failed to load messages:", error)
        setError("Failed to load messages")
      } finally {
        setIsLoading(false)
      }
    }

    loadMessages()

    // Subscribe to real-time updates with proper callbacks
    const subscription = messagesService.subscribeToChannel(channel.id, {
      onInsert: (newMessage) => {
        console.log("📨 New message received from:", newMessage.author.name)
        setMessages((prev) => {
          // Check if message already exists to avoid duplicates
          if (prev.some((msg) => msg.id === newMessage.id)) {
            return prev
          }
          return [...prev, newMessage]
        })
      },
      onUpdate: (updatedMessage) => {
        console.log("✏️ Message updated by:", updatedMessage.author.name)
        setMessages((prev) => prev.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg)))
      },
      onDelete: (deletedMessageId) => {
        console.log("🗑️ Message deleted:", deletedMessageId)
        setMessages((prev) => prev.filter((msg) => msg.id !== deletedMessageId))
      },
    })

    return () => {
      messagesService.unsubscribeFromChannel(channel.id)
    }
  }, [channel.id])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesContainerRef.current && !isLoading) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  // Load more messages when scrolling to top
  const handleScroll = async () => {
    if (!messagesContainerRef.current || !hasMore || isLoadingMore) return

    const { scrollTop } = messagesContainerRef.current
    if (scrollTop === 0) {
      setIsLoadingMore(true)
      try {
        const oldestMessage = messages[0]
        if (oldestMessage) {
          const result = await messagesService.getChannelMessages(channel.id, 25, oldestMessage.created_at)
          setMessages((prev) => [...result.messages, ...prev])
          setHasMore(result.hasMore)
        }
      } catch (error) {
        console.error("Failed to load more messages:", error)
      } finally {
        setIsLoadingMore(false)
      }
    }
  }

  const handleReply = (message: Message) => {
    setReplyingTo(message)
  }

  const handleEdit = (message: Message) => {
    setEditingMessage(message)
  }

  const handleDelete = async (messageId: string) => {
    if (confirm("Are you sure you want to delete this message?")) {
      // Optimistic update - remove message immediately
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId))

      const success = await messagesService.deleteMessage(messageId)
      if (!success) {
        // Revert optimistic update on failure
        const result = await messagesService.getChannelMessages(channel.id)
        setMessages(result.messages)
        alert("Failed to delete message")
      }
    }
  }

  const handleEditSubmit = async (messageId: string, newContent: string) => {
    // Optimistic update - update message immediately
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              content: newContent,
              edited_at: new Date().toISOString(),
            }
          : msg,
      ),
    )

    const success = await messagesService.editMessage(messageId, newContent)
    if (success) {
      setEditingMessage(null)
    } else {
      // Revert optimistic update on failure
      const result = await messagesService.getChannelMessages(channel.id)
      setMessages(result.messages)
      alert("Failed to edit message")
    }
  }

  const handleUserClick = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    if (user) {
      setSelectedUser(user)
      setShowProfileView(true)
    }
  }

  const handleCloseProfileView = () => {
    setShowProfileView(false)
    setSelectedUser(null)
  }

  if (channel.type === "voice") {
    return <VoiceChat channel={channel} users={users} />
  }

  if (channel.type === "feed") {
    return <Feed channel={channel} users={users} />
  }

  return (
    <div className="flex-1 flex flex-col bg-neutral-950">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-neutral-800 bg-neutral-925">
        <div className="flex items-center">
          <Hash className="w-5 h-5 text-neutral-500 mr-2" />
          <span className="text-sm font-semibold text-neutral-100">{channel.name}</span>
          <div className="w-px h-4 bg-neutral-700 mx-3" />
          <span className="text-xs text-neutral-500 truncate">{channel.description}</span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col custom-scrollbar"
        onScroll={handleScroll}
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#525252 #171717",
        }}
      >
        {/* Loading more indicator */}
        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-red-400">
            <p className="text-sm mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              Refresh page
            </button>
          </div>
        )}

        {/* Initial loading */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-sm">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-500">
            <Hash className="w-12 h-12 mb-4" />
            <h3 className="text-lg font-semibold text-neutral-300">Welcome to #{channel.name}!</h3>
            <p className="text-sm">No messages yet. Be the first to say something!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((message, index) => {
              const prevMessage = messages[index - 1]
              const showAvatar =
                !prevMessage ||
                prevMessage.author_id !== message.author_id ||
                new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() > 300000 // 5 minutes

              return (
                <MessageItem
                  key={message.id}
                  message={message}
                  showAvatar={showAvatar}
                  onReply={handleReply}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isEditing={editingMessage?.id === message.id}
                  onEditSubmit={handleEditSubmit}
                  onEditCancel={() => setEditingMessage(null)}
                  onUserClick={handleUserClick}
                />
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Reply indicator */}
      {replyingTo && (
        <div className="px-4 py-2 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-neutral-400">
            <Reply className="w-4 h-4" />
            <span>Replying to</span>
            <span className="font-semibold text-neutral-200">{replyingTo.author.name}</span>
            <span className="truncate max-w-xs">{replyingTo.content}</span>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1 text-neutral-500 hover:text-neutral-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-neutral-800 bg-neutral-925">
        <ChatInput
          channel={channel}
          replyingTo={replyingTo}
          onMessageSent={(message) => {
            setReplyingTo(null)
            // Message will be added via real-time subscription, but let's add it optimistically too
            setMessages((prev) => {
              if (prev.some((msg) => msg.id === message.id)) {
                return prev
              }
              return [...prev, message]
            })
          }}
        />
      </div>

      {/* Profile View Modal - Now with onOpenSettings! */}
      {showProfileView && (
        <ProfileView user={selectedUser} onClose={handleCloseProfileView} onOpenSettings={onOpenSettings} />
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #171717;
          border-radius: 0px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #525252;
          border-radius: 0px;
          border: none;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #737373;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:active {
          background: #8a8a8a;
        }
        
        .custom-scrollbar::-webkit-scrollbar-corner {
          background: #171717;
        }
      `}</style>
    </div>
  )
}

interface ChatInputProps {
  channel: Channel
  replyingTo?: Message | null
  onMessageSent?: (message: Message) => void
}

function ChatInput({ channel, replyingTo, onMessageSent }: ChatInputProps) {
  const [message, setMessage] = useState("")
  const [showMentions, setShowMentions] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [spamError, setSpamError] = useState<string | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState<boolean>(false)
  const { profile } = useProfile()

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setInterval(() => {
        setCooldownRemaining((prev) => {
          const newValue = Math.max(0, prev - 1000)
          if (newValue === 0) {
            setSpamError(null)
          }
          return newValue
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [cooldownRemaining])

  // Auto-focus and global keydown listener for typing anywhere
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement

      // Don't interfere with existing inputs, modals, or special keys
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.contentEditable === "true" ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.key === "Tab" ||
        e.key === "Escape" ||
        e.key.startsWith("F")
      ) {
        return
      }

      // Focus the textarea and let the character be typed
      if (textareaRef.current && e.key.length === 1) {
        textareaRef.current.focus()
        // Don't prevent default - let the character be typed naturally
      }
    }

    document.addEventListener("keydown", handleGlobalKeyDown)
    return () => document.removeEventListener("keydown", handleGlobalKeyDown)
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = async () => {
    if ((!message.trim() && attachedFiles.length === 0) || isSending || !profile?.id || cooldownRemaining > 0) return

    setIsSending(true)
    setSpamError(null)

    try {
      // Upload attachments first
      const attachments = []
      if (attachedFiles.length > 0) {
        setUploadingFiles(true)
        for (const file of attachedFiles) {
          const attachment = await messagesService.uploadAttachment(file, profile.id)
          if (attachment) {
            attachments.push(attachment)
          }
        }
        setUploadingFiles(false)
      }

      // Send message with spam prevention
      const result = await messagesService.sendMessage(channel.id, profile.id, {
        content: message.trim() || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        reply_to: replyingTo?.id,
      })

      if (result.success && result.message) {
        setMessage("")
        setAttachedFiles([])
        if (onMessageSent) {
          onMessageSent(result.message)
        }

        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto"
        }
      } else {
        // Handle spam prevention or other errors
        setSpamError(result.error || "Failed to send message")
        if (result.cooldownRemaining) {
          setCooldownRemaining(result.cooldownRemaining)
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error)
      setSpamError("Failed to send message")
    } finally {
      setIsSending(false)
      setUploadingFiles(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setMessage(value)

    // Clear spam error when user starts typing
    if (spamError && cooldownRemaining === 0) {
      setSpamError(null)
    }

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }

    // Check for @ mentions
    const lastWord = value.split(" ").pop() || ""
    setShowMentions(lastWord.startsWith("@") && lastWord.length > 1)
  }

  const handleFileUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachedFiles((prev) => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const insertMention = (username: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const textBefore = message.substring(0, cursorPos)
    const textAfter = message.substring(cursorPos)

    const lastAtIndex = textBefore.lastIndexOf("@")
    if (lastAtIndex !== -1) {
      const newMessage = textBefore.substring(0, lastAtIndex) + `@${username} ` + textAfter
      setMessage(newMessage)
      setShowMentions(false)

      setTimeout(() => {
        textarea.focus()
        const newCursorPos = lastAtIndex + username.length + 2
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      }, 0)
    }
  }

  // Mock users for mentions
  const mockUsers = ["alice", "bob", "charlie", "diana"]
  const mentionQuery = message.split(" ").pop()?.substring(1).toLowerCase() || ""
  const filteredUsers = mockUsers.filter((user) => user.toLowerCase().includes(mentionQuery)).slice(0, 5)

  const placeholder = replyingTo ? `Reply to ${replyingTo.author.name}...` : `Message #${channel.name}...`
  const isDisabled = isSending || uploadingFiles || !profile?.id || cooldownRemaining > 0

  return (
    <div className="relative">
      {/* Spam Prevention Warning */}
      {spamError && (
        <div className="mb-2 p-3 bg-red-900/20 border border-red-800 rounded-none flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-300">{spamError}</p>
            {cooldownRemaining > 0 && (
              <div className="flex items-center space-x-1 mt-1">
                <Clock className="w-3 h-3 text-red-400" />
                <span className="text-xs text-red-400">Cooldown: {Math.ceil(cooldownRemaining / 1000)}s</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mentions Dropdown */}
      {showMentions && filteredUsers.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-neutral-800 border border-neutral-700 rounded-none max-h-32 overflow-y-auto z-10">
          {filteredUsers.map((user) => (
            <button
              key={user}
              onClick={() => insertMention(user)}
              className="w-full px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700 transition-colors flex items-center space-x-2"
            >
              <div className="w-6 h-6 bg-neutral-600 rounded-none flex items-center justify-center">
                <span className="text-xs font-bold text-neutral-300">{user.charAt(0).toUpperCase()}</span>
              </div>
              <span>@{user}</span>
            </button>
          ))}
        </div>
      )}

      {/* File Attachments Preview */}
      {attachedFiles.length > 0 && (
        <div className="mb-2 space-y-2">
          {attachedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-neutral-800 border border-neutral-700 p-2 rounded-none"
            >
              <div className="flex items-center space-x-2">
                <Paperclip className="w-4 h-4 text-neutral-400" />
                <span className="text-sm text-neutral-300 truncate">{file.name}</span>
                <span className="text-xs text-neutral-500">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                disabled={uploadingFiles}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Container */}
      <div
        className={`bg-neutral-900 border rounded-none overflow-hidden ${
          spamError ? "border-red-700" : "border-neutral-700"
        }`}
      >
        <div className="flex space-x-3 p-3">
          <div className="flex-1 relative flex items-center">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isDisabled && cooldownRemaining > 0
                  ? `Rate limited - ${Math.ceil(cooldownRemaining / 1000)}s`
                  : placeholder
              }
              className="bg-transparent border-none text-neutral-100 placeholder-neutral-500 focus:ring-0 resize-none min-h-[20px] max-h-[120px] rounded-none p-0 text-sm leading-5 w-full"
              rows={1}
              disabled={isDisabled}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-end space-x-2 self-end">
            <button
              onClick={() => {
                const textarea = textareaRef.current
                if (textarea) {
                  const cursorPos = textarea.selectionStart
                  const newMessage = message.substring(0, cursorPos) + "@" + message.substring(cursorPos)
                  setMessage(newMessage)
                  setTimeout(() => {
                    textarea.focus()
                    textarea.setSelectionRange(cursorPos + 1, cursorPos + 1)
                  }, 0)
                }
              }}
              className="p-2 text-neutral-500 hover:text-neutral-300 rounded-none transition-colors"
              title="Mention someone"
              disabled={isDisabled}
            >
              <AtSign className="w-4 h-4" />
            </button>

            <button
              onClick={handleFileUpload}
              className="p-2 text-neutral-500 hover:text-neutral-300 rounded-none transition-colors"
              title="Attach file"
              disabled={isDisabled}
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <Button
              onClick={handleSend}
              disabled={(!message.trim() && attachedFiles.length === 0) || isDisabled}
              className="hover:text-neutral-300 border-0 rounded-none h-8 text-sm disabled:opacity-50 disabled:cursor-not-allowed text-neutral-500 bg-transparent px-0.5"
            >
              {isSending || uploadingFiles ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : cooldownRemaining > 0 ? (
                <Clock className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,video/*,.pdf,.doc,.docx,.txt"
        disabled={isDisabled}
      />
    </div>
  )
}
