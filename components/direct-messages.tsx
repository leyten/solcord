"use client"

import type React from "react"
import { DMMessageAttachments } from "@/components/dm-message-attachments"
import type { MessageAttachment, UserSearchResult } from "@/lib/types/messages"
import { useState, useRef, type KeyboardEvent, useEffect, useCallback, useMemo } from "react"
import { X, Search, MessageCircle, User, Plus, Send, Paperclip, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { searchUsers } from "@/app/actions"
import { useProfile } from "@/contexts/profile-context"
import { dmService, type DMMessage, type DMConversation } from "@/lib/services/direct-messages"
import { usePrivy } from "@privy-io/react-auth"

interface DirectMessagesProps {
  onClose: () => void
  onNotificationUpdate: (count: number) => void
  initialConversationUserId?: string
}

export function DirectMessages({ onClose, onNotificationUpdate, initialConversationUserId }: DirectMessagesProps) {
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
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const { profile } = useProfile()

  // Real DM data
  const [conversations, setConversations] = useState<DMConversation[]>([])
  const [messages, setMessages] = useState<{ [key: string]: DMMessage[] }>({})
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  // Use ref to track active conversation for callbacks without causing re-subscriptions
  const activeConversationRef = useRef<string | null>(null)

  const { getAccessToken } = usePrivy()

  useEffect(() => {
    activeConversationRef.current = activeConversation
  }, [activeConversation])

  // Memoize filtered conversations to prevent unnecessary re-renders
  const filteredConversations = useMemo(() => {
    return conversations.filter(
      (conv) =>
        conv.other_user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.other_user_username.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [conversations, searchQuery])

  // Memoize active conversation to prevent unnecessary re-renders
  const activeConv = useMemo(() => {
    return conversations.find((conv) => conv.other_user_id === activeConversation)
  }, [conversations, activeConversation])

  // Memoize active messages to prevent unnecessary re-renders
  const activeMessages = useMemo(() => {
    return activeConversation ? messages[activeConversation] || [] : []
  }, [messages, activeConversation])

  // Function to scroll to bottom instantly
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [])

  // Calculate and update total unread count - ONLY when conversations actually change
  useEffect(() => {
    const totalUnread = conversations.reduce((sum, conv) => sum + conv.unread_count, 0)
    onNotificationUpdate(totalUnread)
  }, [conversations, onNotificationUpdate])

  // Load conversations function - memoized to prevent infinite loops
  const loadConversations = useCallback(async () => {
    if (!profile?.id) return

    try {
      const convs = await dmService.getUserConversations(profile.id)
      setConversations(convs)
    } catch (error) {
      console.error("Failed to load conversations:", error)
    }
  }, [profile?.id])

  // Handle new messages from real-time subscription - STABLE CALLBACK
  const handleNewMessage = useCallback(
    (newMessage: DMMessage) => {
      if (!profile?.id) return


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

        // If this is a real message (not optimistic), replace any optimistic message
        let updatedMessages = existingMessages
        if (!newMessage.isOptimistic) {
          // Remove any optimistic messages with the same content and sender
          updatedMessages = existingMessages.filter(
            (msg) =>
              !(msg.isOptimistic && msg.content === newMessage.content && msg.sender_id === newMessage.sender_id),
          )
        }

        const finalMessages = [...updatedMessages, newMessage]

        return {
          ...prev,
          [otherUserId]: finalMessages,
        }
      })

      // Update conversation list with the new message
      setConversations((prev) => {
        const existingConvIndex = prev.findIndex((conv) => conv.other_user_id === otherUserId)

        if (existingConvIndex >= 0) {
          // Update existing conversation
          const existingConv = prev[existingConvIndex]
          const updatedConv = {
            ...existingConv,
            last_message: newMessage.content,
            last_message_at: newMessage.created_at,
            unread_count:
              newMessage.sender_id !== profile.id && otherUserId !== activeConversationRef.current
                ? existingConv.unread_count + 1
                : existingConv.unread_count,
          }

          // Move conversation to top and update it
          const newConversations = [...prev]
          newConversations.splice(existingConvIndex, 1)
          return [updatedConv, ...newConversations]
        }

        return prev
      })

      // Auto-scroll to bottom if this conversation is active
      if (otherUserId === activeConversationRef.current) {
        setTimeout(() => {
          scrollToBottom()
        }, 10)
      }
    },
    [profile?.id, scrollToBottom],
  )

  // Handle conversation updates from real-time - STABLE CALLBACK
  const handleConversationUpdate = useCallback(() => {
    if (profile?.id) {
      loadConversations()
    }
  }, [profile?.id, loadConversations])

  // Load user's conversations on mount and set up real-time - ONLY ONCE
  useEffect(() => {
    if (!profile?.id) return

    const initializeConversations = async () => {
      setIsLoadingConversations(true)
      await loadConversations()
      setIsLoadingConversations(false)
    }

    initializeConversations()

    // Set up real-time subscriptions - STABLE DEPENDENCIES
    dmService.subscribeToMessages(profile.id, handleNewMessage, handleConversationUpdate)

    return () => {
      dmService.cleanup()
    }
  }, [profile?.id, handleNewMessage, handleConversationUpdate])

  // Handle initial conversation user ID
  useEffect(() => {
    if (initialConversationUserId && conversations.length > 0) {
      // Check if conversation already exists
      const existingConv = conversations.find((conv) => conv.other_user_id === initialConversationUserId)
      if (existingConv) {
        setActiveConversation(initialConversationUserId)
      } else {
        // Start new conversation
        setActiveConversation(initialConversationUserId)
      }
    }
  }, [initialConversationUserId, conversations])

  // Load messages when active conversation changes - ONLY load messages, NO conversation list updates
  useEffect(() => {
    if (!activeConversation || !profile?.id) return

    const loadMessages = async () => {
      setIsLoadingMessages(true)
      try {
        const authToken = await getAccessToken()
        const msgs = await dmService.getConversationMessages(profile.id, activeConversation, 50, authToken ?? undefined)

        setMessages((prev) => ({
          ...prev,
          [activeConversation]: msgs,
        }))

        await dmService.markMessagesAsRead(profile.id, activeConversation, authToken ?? undefined)

        // Update the conversation's unread count locally
        setConversations((prev) =>
          prev.map((conv) => (conv.other_user_id === activeConversation ? { ...conv, unread_count: 0 } : conv)),
        )
      } catch (error) {
        console.error("Failed to load messages:", error)
      } finally {
        setIsLoadingMessages(false)
        // Scroll to bottom after loading is complete
        setTimeout(() => {
          scrollToBottom()
        }, 10)
      }
    }

    loadMessages()
  }, [activeConversation, profile?.id, scrollToBottom, getAccessToken])

  // Auto-scroll to bottom when messages change - but only for new messages in active conversation
  useEffect(() => {
    if (activeConversation && activeMessages.length > 0) {
      scrollToBottom()
    }
  }, [activeMessages.length, activeConversation, scrollToBottom])

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

  const handleSendMessage = async () => {
    if ((!message.trim() && attachedFiles.length === 0) || !activeConversation || !profile?.id || isSending) return

    setIsSending(true)
    const messageText = message.trim()

    // Generate optimistic message ID
    const optimisticId = `optimistic_${Date.now()}_${Math.random()}`

    try {
      // Upload attachments first if any
      const uploadedAttachments: MessageAttachment[] = []
      if (attachedFiles.length > 0) {
        for (const file of attachedFiles) {
          const attachment = await dmService.uploadAttachment(file, profile.id)
          if (attachment) {
            uploadedAttachments.push(attachment)
          } else {
            console.error("Failed to upload attachment:", file.name)
          }
        }
      }

      // Create optimistic message
      const optimisticMessage: DMMessage = {
        id: optimisticId,
        conversation_id: "temp",
        sender_id: profile.id,
        recipient_id: activeConversation,
        content: messageText,
        created_at: new Date().toISOString(),
        attachments: uploadedAttachments,
        isOptimistic: true,
        sender: {
          id: profile.id,
          name: profile.name,
          username: profile.username,
          avatar: profile.pfp_url || "",
        },
      }

      // Add optimistic message immediately
      setMessages((prev) => ({
        ...prev,
        [activeConversation]: [...(prev[activeConversation] || []), optimisticMessage],
      }))

      // Update conversation list optimistically
      setConversations((prev) => {
        const existingConvIndex = prev.findIndex((conv) => conv.other_user_id === activeConversation)
        if (existingConvIndex >= 0) {
          const existingConv = prev[existingConvIndex]
          const updatedConv = {
            ...existingConv,
            last_message: messageText || (uploadedAttachments.length > 0 ? "📎 Attachment" : ""),
            last_message_at: new Date().toISOString(),
          }

          // Move conversation to top
          const newConversations = [...prev]
          newConversations.splice(existingConvIndex, 1)
          return [updatedConv, ...newConversations]
        }
        return prev
      })

      // Clear input immediately for better UX
      setMessage("")
      setAttachedFiles([])

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }

      // Scroll to bottom to show the optimistic message
      setTimeout(() => {
        scrollToBottom()
      }, 10)

      const authToken = await getAccessToken()
      const result = await dmService.sendMessage(
        profile.id,
        activeConversation,
        messageText,
        uploadedAttachments,
        optimisticId,
        authToken ?? undefined,
      )

      if (!result.success) {
        console.error("Failed to send DM:", result.error)

        // Mark optimistic message as failed
        setMessages((prev) => ({
          ...prev,
          [activeConversation]: (prev[activeConversation] || []).map((msg) =>
            msg.id === optimisticId ? { ...msg, isFailed: true } : msg,
          ),
        }))

        // Restore message on failure
        setMessage(messageText)
        setAttachedFiles(attachedFiles)
      } else {
        // Remove optimistic message since real one will come via real-time
        setMessages((prev) => ({
          ...prev,
          [activeConversation]: (prev[activeConversation] || []).filter((msg) => msg.id !== optimisticId),
        }))
      }
    } catch (error) {
      console.error("Error sending DM:", error)

      // Mark optimistic message as failed
      setMessages((prev) => ({
        ...prev,
        [activeConversation]: (prev[activeConversation] || []).map((msg) =>
          msg.id === optimisticId ? { ...msg, isFailed: true } : msg,
        ),
      }))

      // Restore message on error
      setMessage(messageText)
      setAttachedFiles(attachedFiles)
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

    const tempConversation: DMConversation = {
      id: `temp_${user.id}`,
      other_user_id: user.id,
      other_user_name: user.name,
      other_user_username: user.username,
      other_user_pfp_url: user.pfp_url || "", // Default to empty string
      other_user_status: user.status || "offline", // Default to offline
      last_message: "", // Empty string instead of null
      last_message_at: new Date().toISOString(), // Current timestamp instead of null
      unread_count: 0,
      created_at: new Date().toISOString(),
    }

    // Add temporary conversation to the list
    setConversations((prev) => [tempConversation, ...prev])

    // Start new conversation by setting active conversation
    setActiveConversation(user.id)
    setShowNewConversation(false)
    setNewConversationSearch("")

    // The conversation will be created in the database when the first message is sent
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
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    const diffInHours = Math.floor(diffInMinutes / 60)

    if (diffInMinutes < 1) {
      return "now"
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  // Handle conversation selection
  const handleConversationSelect = useCallback((conversationId: string) => {
    setActiveConversation(conversationId)
  }, [])

  // Helper function to check if image URL is valid
  const hasValidImageUrl = (url?: string) => {
    return url && url.trim() !== "" && url !== "null" && url !== "undefined"
  }

  // Retry failed message
  const retryMessage = async (failedMessage: DMMessage) => {
    if (!activeConversation || !profile?.id) return

    // Remove failed message
    setMessages((prev) => ({
      ...prev,
      [activeConversation]: (prev[activeConversation] || []).filter((msg) => msg.id !== failedMessage.id),
    }))

    // Restore message to input
    setMessage(failedMessage.content)

    // If there were attachments, we can't easily restore them, so just show a message
    if (failedMessage.attachments && failedMessage.attachments.length > 0) {
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
  }, [showNewConversation, filteredConversations, activeConversation, onClose, handleConversationSelect])

  // Add a useEffect hook to focus the textarea when a conversation is selected or when the component mounts with an active conversation
  useEffect(() => {
    // Auto-focus the textarea when conversation is selected or component mounts
    if (activeConversation && textareaRef.current && !isLoadingMessages) {
      const focusTextarea = () => {
        textareaRef.current?.focus()
      }

      // Small delay to ensure the textarea is rendered
      const timeoutId = setTimeout(focusTextarea, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [activeConversation, isLoadingMessages])

  // Add keyboard event listener for global typing
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      // Don't interfere with existing keyboard shortcuts
      if (e.key === "Escape") {
        if (showNewConversation) {
          setShowNewConversation(false)
          setNewConversationSearch("")
          setSearchResults([])
          return
        }
        onClose()
        return
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

      // Auto-focus textarea when typing (if not in a modal and conversation is active)
      if (
        activeConversation &&
        !showNewConversation &&
        textareaRef.current &&
        document.activeElement !== textareaRef.current &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key.length === 1 && // Only single characters
        e.target && // Ensure target exists
        !(e.target as Element).closest("input") && // Not typing in an input
        !(e.target as Element).closest("textarea") && // Not typing in a textarea
        !(e.target as Element).closest("[contenteditable]") // Not typing in contenteditable
      ) {
        textareaRef.current.focus()
        // Don't prevent default here - let the character be typed
      }
    }

    document.addEventListener("keydown", handleGlobalKeyDown)
    return () => document.removeEventListener("keydown", handleGlobalKeyDown)
  }, [showNewConversation, filteredConversations, activeConversation, onClose, handleConversationSelect])

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
                        {hasValidImageUrl(conv.other_user_pfp_url) ? (
                          <img
                            src={conv.other_user_pfp_url || "/placeholder.svg"}
                            alt={conv.other_user_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none"
                            }}
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
                        <span className="text-xs text-neutral-500">
                          {conv.last_message_at ? formatTimestamp(conv.last_message_at) : ""}
                        </span>
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
                      {hasValidImageUrl(activeConv?.other_user_pfp_url) ? (
                        <img
                          src={activeConv?.other_user_pfp_url || "/placeholder.svg"}
                          alt={activeConv?.other_user_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none"
                          }}
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
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-600 hover:scrollbar-thumb-neutral-500"
              >
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
                      const hasText = msg.content && msg.content.trim()
                      const hasAttachments = msg.attachments && msg.attachments.length > 0

                      return (
                        <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                          <div className="max-w-xs lg:max-w-md space-y-1">
                            {/* Text message */}
                            {hasText && (
                              <div
                                className={`px-4 py-2 rounded-none relative ${
                                  isOwn ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-100"
                                } ${msg.isOptimistic ? "opacity-70" : ""} ${msg.isFailed ? "bg-red-600" : ""}`}
                              >
                                <div className="flex items-center gap-2">
                                  <p className="text-sm flex-1">{msg.content}</p>
                                  {msg.isFailed && (
                                    <button
                                      onClick={() => retryMessage(msg)}
                                      className="text-white hover:text-red-200 transition-colors"
                                      title="Retry message"
                                    >
                                      <AlertCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Attachments */}
                            {hasAttachments && (
                              <div className={`${isOwn ? "flex justify-end" : "flex justify-start"}`}>
                                <DMMessageAttachments attachments={msg.attachments || []} isOwn={isOwn} />
                              </div>
                            )}

                            {/* Timestamp */}
                            <div className={`${isOwn ? "text-right" : "text-left"}`}>
                              <p className="text-xs text-neutral-500">
                                {msg.isOptimistic
                                  ? "Sending..."
                                  : msg.isFailed
                                    ? "Failed to send"
                                    : formatTimestamp(msg.created_at)}
                              </p>
                            </div>
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
                            {hasValidImageUrl(user.pfp_url) ? (
                              <img
                                src={user.pfp_url || "/placeholder.svg"}
                                alt={user.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none"
                                }}
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
