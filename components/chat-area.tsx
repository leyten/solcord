"use client"

import type React from "react"
import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import { Hash, Send, Paperclip, AtSign, X, Loader2, Reply, Clock, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VoiceChat } from "@/components/voice-chat"
import { Feed } from "@/components/feed"
import { MessageItem } from "@/components/messages/message-item"
import { ProfileView } from "@/components/profile-view"
import type { Channel, ChannelUser, Server } from "@/lib/types"
import type { Message } from "@/lib/types/messages"
import { Textarea } from "@/components/ui/textarea"
import { messagesService } from "@/lib/services/messages"
import { useProfile } from "@/contexts/profile-context"
import { tokenServerService } from "@/lib/services/token-servers"

interface ChatAreaProps {
  server: Server
  channel: Channel
  messages: Message[]
  users: ChannelUser[]
  onToggleUserList: () => void
  userListCollapsed: boolean
  onOpenSettings?: () => void
}

export function ChatArea({ server, channel, users, onOpenSettings }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [selectedUser, setSelectedUser] = useState<ChannelUser | null>(null)
  const [showProfileView, setShowProfileView] = useState(false)
  const [canWrite, setCanWrite] = useState(true)
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true)
  const [canAccessChannel, setCanAccessChannel] = useState(true)
  const [userTokenPercentage, setUserTokenPercentage] = useState<number>(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const { profile } = useProfile()

  const checkPermissions = async () => {
    if (!profile?.id || !server?.id) {
      setCanWrite(false)
      setCanAccessChannel(false)
      setIsCheckingPermissions(false)
      return
    }

    setIsCheckingPermissions(true)
    try {
      const [hasWritePermission, tokenPercentage] = await Promise.all([
        tokenServerService.canUserWrite(profile.id, server.id),
        tokenServerService.getUserTokenPercentage(server.id),
      ])

      setCanWrite(hasWritePermission)
      setUserTokenPercentage(tokenPercentage)

      const channelRequirement = channel.minTokenPercentage || 0
      const hasChannelAccess = server.id === "solcord" || tokenPercentage >= channelRequirement
      setCanAccessChannel(hasChannelAccess)
    } catch (error) {
      console.error("Error checking permissions:", error)
      setCanWrite(false)
      setCanAccessChannel(false)
    } finally {
      setIsCheckingPermissions(false)
    }
  }

  useEffect(() => {
    checkPermissions()
  }, [profile?.id, server?.id, channel.minTokenPercentage])

  useEffect(() => {
    if (!channel?.id || !server?.id || !canAccessChannel) return

    console.log(`🔄 Loading messages for server: ${server.id}, channel: ${channel.id}`)

    const loadMessages = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await messagesService.getChannelMessages(channel.id, server.id)
        console.log(`📥 Loaded ${result.messages.length} messages for ${server.id}/${channel.id}`)
        setMessages(result.messages)
        setHasMore(result.hasMore)

        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
          }
        }, 100)
      } catch (error) {
        console.error("Failed to load messages:", error)
        setError("Failed to load messages")
      } finally {
        setIsLoading(false)
      }
    }

    loadMessages()

    console.log(`🔌 Setting up real-time subscription for: ${server.id}/${channel.id}`)
    const subscription = messagesService.subscribeToChannel(channel.id, server.id, {
      onInsert: (newMessage) => {
        console.log("📨 New message received via real-time:", newMessage.author.name, "->", newMessage.content)
        setMessages((prev) => {
          if (prev.some((msg) => msg.id === newMessage.id)) {
            console.log("⚠️ Duplicate message detected, skipping")
            return prev
          }
          console.log("✅ Adding new message to state")
          const newMessages = [...prev, newMessage]

          setTimeout(() => {
            if (messagesContainerRef.current) {
              messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
            }
          }, 50)

          return newMessages
        })
      },
      onUpdate: (updatedMessage) => {
        console.log("✏️ Message updated via real-time:", updatedMessage.author.name)
        setMessages((prev) => prev.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg)))
      },
      onDelete: (deletedMessageId) => {
        console.log("🗑️ Message deleted via real-time:", deletedMessageId)
        setMessages((prev) => prev.filter((msg) => msg.id !== deletedMessageId))
      },
    })

    return () => {
      console.log(`🧹 Cleaning up subscription for: ${server.id}/${channel.id}`)
      messagesService.unsubscribeFromChannel(channel.id, server.id)
    }
  }, [channel.id, server.id, canAccessChannel])

  const handleScroll = async () => {
    if (!messagesContainerRef.current || !hasMore || isLoadingMore) return

    const { scrollTop } = messagesContainerRef.current
    if (scrollTop === 0) {
      setIsLoadingMore(true)
      try {
        const oldestMessage = messages[0]
        if (oldestMessage) {
          const result = await messagesService.getChannelMessages(channel.id, server.id, 25, oldestMessage.created_at)
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
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId))

      const success = await messagesService.deleteMessage(messageId)
      if (!success) {
        const result = await messagesService.getChannelMessages(channel.id, server.id)
        setMessages(result.messages)
        alert("Failed to delete message")
      }
    }
  }

  const handleEditSubmit = async (messageId: string, newContent: string) => {
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
      const result = await messagesService.getChannelMessages(channel.id, server.id)
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

  if (!canAccessChannel && !isCheckingPermissions) {
    return (
      <div className="flex-1 flex flex-col bg-neutral-950">
        <div className="h-12 px-4 flex items-center justify-between border-b border-neutral-800 bg-neutral-925">
          <div className="flex items-center">
            <Hash className="w-5 h-5 text-neutral-500 mr-2" />
            <span className="text-sm font-semibold text-neutral-100">{channel.name}</span>
            <div className="w-px h-4 bg-neutral-700 mx-3" />
            <span className="text-xs text-neutral-500 truncate">{channel.description}</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-500">
          <Lock className="w-16 h-16 mb-4 text-neutral-600" />
          <h3 className="text-lg font-semibold text-neutral-300 mb-2">Channel Restricted</h3>
          <p className="text-sm mb-1">This channel requires {channel.minTokenPercentage}%+ token holdings</p>
          <p className="text-xs text-neutral-600">You currently hold {userTokenPercentage.toFixed(3)}%</p>
        </div>
      </div>
    )
  }

  if (channel.type === "voice") {
    return <VoiceChat channel={channel} users={users} />
  }

  if (channel.type === "feed") {
    return <Feed server={server} channel={channel} users={users} />
  }

  return (
    <div className="flex-1 flex flex-col bg-neutral-950">
      <div className="h-12 px-4 flex items-center justify-between border-b border-neutral-800 bg-neutral-925">
        <div className="flex items-center">
          <Hash className="w-5 h-5 text-neutral-500 mr-2" />
          <span className="text-sm font-semibold text-neutral-100">{channel.name}</span>
          <div className="w-px h-4 bg-neutral-700 mx-3" />
          <span className="text-xs text-neutral-500 truncate">{channel.description}</span>
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col custom-scrollbar"
        onScroll={handleScroll}
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#525252 #171717",
        }}
      >
        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
          </div>
        )}

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

      <div className="p-4 border-t border-neutral-800 bg-neutral-925">
        <ChatInput
          server={server}
          channel={channel}
          replyingTo={replyingTo}
          canWrite={canWrite && canAccessChannel}
          isCheckingPermissions={isCheckingPermissions}
          onMessageSent={(message) => {
            console.log("📤 Message sent callback triggered:", message.content)
            setReplyingTo(null)
            setMessages((prev) => {
              if (prev.some((msg) => msg.id === message.id)) {
                console.log("⚠️ Duplicate message detected in optimistic update, skipping")
                return prev
              }
              console.log("✅ Adding optimistic message to state")
              const newMessages = [...prev, message]

              setTimeout(() => {
                if (messagesContainerRef.current) {
                  messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
                }
              }, 50)

              return newMessages
            })
          }}
        />
      </div>

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
  server: Server
  channel: Channel
  replyingTo?: Message | null
  canWrite: boolean
  isCheckingPermissions: boolean
  onMessageSent?: (message: Message) => void
}

function ChatInput({ server, channel, replyingTo, canWrite, isCheckingPermissions, onMessageSent }: ChatInputProps) {
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

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!canWrite || !textareaRef.current) return

      const items = e.clipboardData?.items
      if (!items) return

      const files: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === "file") {
          const file = item.getAsFile()
          if (file) {
            files.push(file)
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault()
        setAttachedFiles((prev) => [...prev, ...files])
      }
    }

    const textarea = textareaRef.current
    if (textarea) {
      textarea.addEventListener("paste", handlePaste)
      return () => textarea.removeEventListener("paste", handlePaste)
    }
  }, [canWrite])

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

  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement

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

      if (textareaRef.current && e.key.length === 1) {
        textareaRef.current.focus()
      }
    }

    document.addEventListener("keydown", handleGlobalKeyDown)
    return () => document.removeEventListener("keydown", handleGlobalKeyDown)
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!canWrite) return

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
    if (
      (!message.trim() && attachedFiles.length === 0) ||
      isSending ||
      !profile?.id ||
      cooldownRemaining > 0 ||
      !canWrite
    )
      return

    console.log(`📤 Attempting to send message: "${message.trim()}" to server: ${server.id}, channel: ${channel.id}`)

    setIsSending(true)
    setSpamError(null)

    try {
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

      const result = await messagesService.sendMessage(channel.id, server.id, profile.id, {
        content: message.trim() || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        reply_to: replyingTo?.id,
      })

      if (result.success && result.message) {
        console.log("✅ Message sent successfully:", result.message.content)
        setMessage("")
        setAttachedFiles([])

        if (onMessageSent) {
          onMessageSent(result.message)
        }

        if (textareaRef.current) {
          textareaRef.current.style.height = "auto"
        }
      } else {
        console.error("❌ Failed to send message:", result.error)
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
    if (!canWrite) return

    const value = e.target.value
    setMessage(value)

    if (spamError && cooldownRemaining === 0) {
      setSpamError(null)
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }

    const lastWord = value.split(" ").pop() || ""
    setShowMentions(lastWord.startsWith("@") && lastWord.length > 1)
  }

  const handleFileUpload = () => {
    if (!canWrite) return
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canWrite) return
    const files = Array.from(e.target.files || [])
    setAttachedFiles((prev) => [...prev, ...files])

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }, 0)
  }

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const insertMention = (username: string) => {
    if (!canWrite) return

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

  const mockUsers = ["alice", "bob", "charlie", "diana"]
  const mentionQuery = message.split(" ").pop()?.substring(1).toLowerCase() || ""
  const filteredUsers = mockUsers.filter((user) => user.toLowerCase().includes(mentionQuery)).slice(0, 5)

  const getPlaceholder = () => {
    if (isCheckingPermissions) return "Checking permissions..."
    if (!canWrite) return "You need 10,000 tokens to send messages"
    if (cooldownRemaining > 0) return `Rate limited - ${Math.ceil(cooldownRemaining / 1000)}s`
    return replyingTo ? `Reply to ${replyingTo.author.name}...` : `Message #${channel.name}...`
  }

  const isDisabled =
    isSending || uploadingFiles || !profile?.id || cooldownRemaining > 0 || !canWrite || isCheckingPermissions

  return (
    <div className="relative">
      {attachedFiles.length > 0 && (
        <div className="mb-2 space-y-2">
          {attachedFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between bg-neutral-800 border border-neutral-700 p-2">
              <div className="flex items-center space-x-2">
                <Paperclip className="w-4 h-4 text-neutral-400" />
                <span className="text-sm text-neutral-300 truncate">{file.name}</span>
                <span className="text-xs text-neutral-500">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={`bg-neutral-900 border rounded-none overflow-hidden transition-all ${
          !canWrite && !isCheckingPermissions
            ? "bg-neutral-950 border-neutral-800 opacity-60"
            : spamError
              ? "border-red-700"
              : "border-neutral-700"
        }`}
      >
        <div className="flex space-x-3 p-3">
          <div className="flex-1 relative flex items-center">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder()}
              className={`bg-transparent border-none text-neutral-100 placeholder-neutral-500 focus:ring-0 resize-none min-h-[20px] max-h-[120px] rounded-none p-0 text-sm leading-5 w-full ${
                !canWrite && !isCheckingPermissions ? "text-neutral-600 placeholder-neutral-700" : ""
              }`}
              rows={1}
              disabled={isDisabled}
            />
          </div>

          <div className="flex items-end space-x-2 self-end">
            <button
              onClick={() => {
                if (!canWrite) return
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
              className="p-2 text-neutral-500 hover:text-neutral-300 rounded-none transition-colors disabled:opacity-50"
              title={canWrite ? "Mention someone" : "You need 10,000 tokens to send messages"}
              disabled={isDisabled}
            >
              <AtSign className="w-4 h-4" />
            </button>

            <button
              onClick={handleFileUpload}
              className="p-2 text-neutral-500 hover:text-neutral-300 rounded-none transition-colors disabled:opacity-50"
              title={canWrite ? "Attach file" : "You need 10,000 tokens to send messages"}
              disabled={isDisabled}
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <Button
              onClick={handleSend}
              disabled={(!message.trim() && attachedFiles.length === 0) || isDisabled}
              className="hover:text-neutral-300 hover:bg-transparent border-0 rounded-none h-8 text-sm disabled:opacity-50 disabled:cursor-not-allowed text-neutral-500 bg-transparent px-0.5"
              title={!canWrite ? "You need 10,000 tokens to send messages" : undefined}
            >
              {isSending || uploadingFiles ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : cooldownRemaining > 0 ? (
                <Clock className="w-4 h-4" />
              ) : !canWrite ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

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
