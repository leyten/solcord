"use client"

import type React from "react"

import { useState, useRef, type KeyboardEvent, useEffect, useCallback } from "react"
import { X, Search, MessageCircle, User, Plus, Send, Paperclip } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { searchUsers } from "@/app/actions"
import { useProfile } from "@/contexts/profile-context"
import { dmService, type DMMessage, type DMConversation } from "@/lib/services/direct-messages"

interface DirectMessagesProps {
  onClose: () => void
}

interface UserSearchResult {
  id: string
  name: string
  username: string
  wallet: string
  online: boolean
  pfp_url?: string
  status?: "online" | "dnd" | "offline"
}

export function DirectMessages({ onClose }: DirectMessagesProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [newConversationSearch, setNewConversationSearch] = useState("")
  const [message, setMessage] = useState("")
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { profile } = useProfile()

  // Real DM data
  const [conversations, setConversations] = useState<DMConversation[]>([])
  const [messages, setMessages] = useState<{ [key: string]: DMMessage[] }>({})
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  // Load conversations function
  const loadConversations = useCallback(async () => {
    if (!profile?.id) return

    try {
      const convs = await dmService.getUserConversations(profile.id)
      setConversations(convs)
    } catch (error) {
      console.error("Failed to load conversations:", error)
    }
  }, [profile?.id])

  // Load user's conversations on mount
  useEffect(() => {
    if (!profile?.id) return

    const initializeConversations = async () => {
      setIsLoadingConversations(true)
      await loadConversations()
      setIsLoadingConversations(false)
    }

    initializeConversations()

    // Subscribe to conversation updates
    const conversationSub = dmService.subscribeToConversations(profile.id, () => {
      loadConversations()
    })

    // Subscribe to new messages
    const messagesSub = dmService.subscribeToUserMessages(profile.id, (newMessage) => {
      console.log("📨 Received new message:", newMessage)

      // Determine which conversation this message belongs to
      const otherUserId = newMessage.sender_id === profile.id ? newMessage.recipient_id : newMessage.sender_id

      // Add message to the appropriate conversation
      setMessages((prev) => {
        const existingMessages = prev[otherUserId] || []
        // Check if message already exists to avoid duplicates
        const messageExists = existingMessages.some((msg) => msg.id === newMessage.id)
        if (messageExists) {
          return prev
        }

        return {
          ...prev,
          [otherUserId]: [...existingMessages, newMessage],
        }
      })

      // Refresh conversations to update last message and unread counts
      loadConversations()
    })

    return () => {
      dmService.unsubscribe(`dm_conversations_${profile.id}`)
      dmService.unsubscribe(`dm_messages_${profile.id}`)
    }
  }, [profile?.id, loadConversations])

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversation || !profile?.id) return

    const loadMessages = async () => {
      setIsLoadingMessages(true)
      try {
        const msgs = await dmService.getConversationMessages(profile.id, activeConversation)
        setMessages((prev) => ({
          ...prev,
          [activeConversation]: msgs,
        }))

        // Mark messages as read immediately when opening conversation
        await dmService.markMessagesAsRead(profile.id, activeConversation)

        // Refresh conversations to update unread counts
        await loadConversations()
      } catch (error) {
        console.error("Failed to load messages:", error)
      } finally {
        setIsLoadingMessages(false)
      }
    }

    loadMessages()
  }, [activeConversation, profile?.id, loadConversations])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, activeConversation])

  // Search for users when typing in new conversation search
  useEffect(() => {
    const searchUsersAsync = async () => {
      if (newConversationSearch.length < 2) {
        setSearchResults([])
        setIsSearching(false)
        return
      }

      setIsSearching(true)

      try {
        const results = await searchUsers(newConversationSearch)
        // Filter out current user
        const filteredResults = results.filter((user: { id: string | undefined }) => user.id !== profile?.id)
        setSearchResults(filteredResults)
      } catch (error) {
        console.error("Error searching users:", error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const debounceTimer = setTimeout(searchUsersAsync, 300)
    return () => clearTimeout(debounceTimer)
  }, [newConversationSearch, profile?.id])

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.other_user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.other_user_username.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const activeConv = conversations.find((conv) => conv.other_user_id === activeConversation)
  const activeMessages = activeConversation ? messages[activeConversation] || [] : []

  const handleSendMessage = async () => {
    if ((!message.trim() && attachedFiles.length === 0) || !activeConversation || !profile?.id || isSending) return

    setIsSending(true)
    const messageText = message.trim()

    // Optimistically add message to UI
    const optimisticMessage: DMMessage = {
      id: `temp-${Date.now()}`,
      sender_id: profile.id,
      recipient_id: activeConversation,
      content: messageText,
      message_type: "text",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sender: {
        id: profile.id,
        name: profile.name || "You",
        username: profile.username || "",
        avatar: profile.pfp_url || "",
      },
    }

    // Add optimistic message immediately
    setMessages((prev) => ({
      ...prev,
      [activeConversation]: [...(prev[activeConversation] || []), optimisticMessage],
    }))

    // Clear input immediately
    setMessage("")
    setAttachedFiles([])

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }

    try {
      const result = await dmService.sendMessage(profile.id, activeConversation, messageText)

      if (result.success && result.message) {
        // Replace optimistic message with real message
        setMessages((prev) => ({
          ...prev,
          [activeConversation]: [
            ...(prev[activeConversation] || []).filter((msg) => msg.id !== optimisticMessage.id),
            result.message!,
          ],
        }))

        // Refresh conversations to update last message
        await loadConversations()
      } else {
        console.error("Failed to send message:", result.error)
        // Remove optimistic message on failure
        setMessages((prev) => ({
          ...prev,
          [activeConversation]: (prev[activeConversation] || []).filter((msg) => msg.id !== optimisticMessage.id),
        }))
      }
    } catch (error) {
      console.error("Error sending message:", error)
      // Remove optimistic message on error
      setMessages((prev) => ({
        ...prev,
        [activeConversation]: (prev[activeConversation] || []).filter((msg) => msg.id !== optimisticMessage.id),
      }))
    } finally {
      setIsSending(false)
    }
  }

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setMessage(value)

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
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

  const startNewConversation = async (user: UserSearchResult) => {
    // Check if conversation already exists
    const existingConv = conversations.find((conv) => conv.other_user_id === user.id)
    if (existingConv) {
      setActiveConversation(user.id)
      setShowNewConversation(false)
      setNewConversationSearch("")
      return
    }

    // Start new conversation by setting active conversation
    setActiveConversation(user.id)
    setShowNewConversation(false)
    setNewConversationSearch("")

    // The conversation will be created when the first message is sent
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "online":
        return "bg-green-500"
      case "dnd":
        return "bg-red-500"
      case "offline":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      return "now"
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  // Handle conversation selection with immediate notification clearing
  const handleConversationSelect = async (conversationId: string) => {
    setActiveConversation(conversationId)

    // Mark messages as read immediately when selecting conversation
    if (profile?.id) {
      await dmService.markMessagesAsRead(profile.id, conversationId)
      // Refresh conversations to update unread counts immediately
      await loadConversations()
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showNewConversation) {
          setShowNewConversation(false)
          setNewConversationSearch("")
          return
        }
        onClose()
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault()
        setShowNewConversation(true)
        return
      }

      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault()
        const currentIndex = filteredConversations.findIndex((conv) => conv.other_user_id === activeConversation)

        if (e.key === "ArrowUp" && currentIndex > 0) {
          handleConversationSelect(filteredConversations[currentIndex - 1].other_user_id)
        } else if (e.key === "ArrowDown" && currentIndex < filteredConversations.length - 1) {
          handleConversationSelect(filteredConversations[currentIndex + 1].other_user_id)
        }
        return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showNewConversation, filteredConversations, activeConversation, onClose, profile?.id, loadConversations])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-6xl h-[85vh] flex">
        {/* DM List Sidebar */}
        <div className="w-80 bg-neutral-925 border-r border-neutral-800 flex flex-col">
          <div className="p-4 border-b border-neutral-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-100">Direct Messages</h2>
              <button
                onClick={onClose}
                className="p-2 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400 rounded-none focus:border-neutral-600 focus:ring-0"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingConversations ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin w-6 h-6 border-2 border-neutral-600 border-t-neutral-300 rounded-full"></div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-neutral-500">
                <MessageCircle className="w-12 h-12 mb-4" />
                <h3 className="text-lg font-semibold text-neutral-300">No conversations</h3>
                <p className="text-sm">Start a new conversation!</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.other_user_id}
                    onClick={() => handleConversationSelect(conv.other_user_id)}
                    className={`w-full flex items-center p-3 transition-colors text-left rounded-none ${
                      activeConversation === conv.other_user_id
                        ? "bg-neutral-800 text-neutral-100"
                        : "hover:bg-neutral-800 text-neutral-300"
                    }`}
                  >
                    <div className="relative mr-3">
                      <div className="w-10 h-10 bg-neutral-700 rounded-none flex items-center justify-center overflow-hidden">
                        {conv.other_user_avatar ? (
                          <img
                            src={conv.other_user_avatar || "/placeholder.svg"}
                            alt={conv.other_user_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-bold text-neutral-300">
                            {conv.other_user_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      {(conv.other_user_status === "online" || conv.other_user_status === "dnd") && (
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${getStatusColor(conv.other_user_status)} rounded-none border border-neutral-900`}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold truncate">{conv.other_user_name}</span>
                        <span className="text-xs text-neutral-500">{formatTimestamp(conv.last_message_at)}</span>
                      </div>
                      <p className="text-xs text-neutral-400 truncate">
                        {conv.last_message || "Start a conversation..."}
                      </p>
                    </div>
                    {conv.unread_count > 0 && (
                      <div className="ml-2 w-5 h-5 bg-red-500 rounded-none flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{conv.unread_count}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-neutral-800">
            <Button
              onClick={() => setShowNewConversation(true)}
              className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border-0 rounded-none"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Conversation
            </Button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="h-12 px-4 flex items-center justify-between border-b border-neutral-800 bg-neutral-925">
                <div className="flex items-center">
                  <div className="relative mr-3">
                    <div className="w-8 h-8 bg-neutral-700 rounded-none flex items-center justify-center overflow-hidden">
                      {activeConv?.other_user_avatar ? (
                        <img
                          src={activeConv.other_user_avatar || "/placeholder.svg"}
                          alt={activeConv.other_user_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-neutral-300">
                          {activeConv?.other_user_name?.charAt(0).toUpperCase() || "?"}
                        </span>
                      )}
                    </div>
                    {(activeConv?.other_user_status === "online" || activeConv?.other_user_status === "dnd") && (
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 ${getStatusColor(activeConv.other_user_status)} rounded-none`}
                      />
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-neutral-100">
                      {activeConv?.other_user_name || "Unknown User"}
                    </span>
                    <div className="text-xs text-neutral-500">@{activeConv?.other_user_username || "unknown"}</div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin w-6 h-6 border-2 border-neutral-600 border-t-neutral-300 rounded-full"></div>
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center text-neutral-500">
                    <div>
                      <MessageCircle className="w-12 h-12 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-neutral-300">Start the conversation</h3>
                      <p className="text-sm">Send a message to {activeConv?.other_user_name || "this user"}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {activeMessages.map((msg) => {
                      const isOwn = msg.sender_id === profile?.id
                      return (
                        <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-none ${
                              isOwn ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-100"
                            }`}
                          >
                            <p className="text-sm">{msg.content}</p>
                            <p className={`text-xs mt-1 ${isOwn ? "text-blue-200" : "text-neutral-500"}`}>
                              {formatTimestamp(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* File Attachments Preview */}
              {attachedFiles.length > 0 && (
                <div className="px-4 pb-2 space-y-2">
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
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Message Input */}
              <div className="p-4 border-t border-neutral-800 bg-neutral-925">
                <div className="bg-neutral-900 border border-neutral-700 rounded-none overflow-hidden">
                  <div className="flex space-x-3 p-3">
                    <div className="flex-1 relative flex items-center">
                      <Textarea
                        ref={textareaRef}
                        value={message}
                        onChange={handleInputChange}
                        onKeyDown={handleTextareaKeyDown}
                        placeholder={`Message ${activeConv?.other_user_name || "user"}...`}
                        className="bg-transparent border-none text-neutral-100 placeholder-neutral-500 focus:ring-0 resize-none min-h-[20px] max-h-[120px] rounded-none p-0 text-sm leading-5 w-full"
                        rows={1}
                        disabled={isSending}
                      />
                    </div>

                    <div className="flex items-end space-x-2 self-end">
                      <button
                        onClick={handleFileUpload}
                        className="p-2 text-neutral-500 hover:text-neutral-300 rounded-none transition-colors"
                        title="Attach file"
                        disabled={isSending}
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      <Button
                        onClick={handleSendMessage}
                        disabled={(!message.trim() && attachedFiles.length === 0) || isSending}
                        className="hover:text-neutral-300 border-0 rounded-none h-8 text-sm disabled:opacity-50 disabled:cursor-not-allowed text-neutral-500 bg-transparent px-0.5"
                      >
                        <Send className="w-4 h-4" />
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
                  disabled={isSending}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-neutral-500">
              <div>
                <User className="w-16 h-16 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-neutral-300">Select a conversation</h3>
                <p className="text-sm">Choose a conversation from the sidebar to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNewConversation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-60 flex items-center justify-center">
          <div className="bg-neutral-900 border border-neutral-700 w-full max-w-md rounded-none">
            <div className="p-4 border-b border-neutral-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-neutral-100">New Conversation</h3>
                <button
                  onClick={() => {
                    setShowNewConversation(false)
                    setNewConversationSearch("")
                    setSearchResults([])
                  }}
                  className="p-2 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input
                  placeholder="Search by username or wallet..."
                  value={newConversationSearch}
                  onChange={(e) => setNewConversationSearch(e.target.value)}
                  className="pl-10 bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-400 rounded-none focus:border-neutral-600 focus:ring-0"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {isSearching ? (
                <div className="p-8 text-center text-neutral-500">
                  <div className="animate-spin w-6 h-6 border-2 border-neutral-600 border-t-neutral-300 rounded-full mx-auto mb-2"></div>
                  <p className="text-sm">Searching users...</p>
                </div>
              ) : newConversationSearch.length > 0 ? (
                searchResults.length > 0 ? (
                  <div className="space-y-1 p-2">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => startNewConversation(user)}
                        className="w-full flex items-center p-3 hover:bg-neutral-800 transition-colors text-left"
                      >
                        <div className="relative mr-3">
                          <div className="w-10 h-10 bg-neutral-700 rounded-none flex items-center justify-center overflow-hidden">
                            {user.pfp_url ? (
                              <img
                                src={user.pfp_url || "/placeholder.svg"}
                                alt={user.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-bold text-neutral-300">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${getStatusColor(user.status)} rounded-none border border-neutral-900`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-neutral-100">{user.name}</div>
                          <div className="text-xs text-neutral-400">@{user.username}</div>
                          <div className="text-xs text-neutral-500 font-mono truncate">{user.wallet}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-neutral-500">
                    <User className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No users found</p>
                  </div>
                )
              ) : (
                <div className="p-8 text-center text-neutral-500">
                  <Search className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">Search for users by username or wallet address</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
