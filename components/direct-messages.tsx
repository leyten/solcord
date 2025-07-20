"use client"

import type React from "react"

import { useState, useRef, type KeyboardEvent, useEffect } from "react"
import { X, Search, MessageCircle, User, Plus, Send, Paperclip } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface DirectMessagesProps {
  onClose: () => void
}

interface DMConversation {
  id: string
  user: {
    name: string
    avatar: string
    online: boolean
    wallet?: string
  }
  lastMessage: string
  timestamp: string
  unread: number
}

interface DMMessage {
  id: string
  text: string
  timestamp: string
  isOwn: boolean
  user: {
    name: string
    avatar: string
  }
}

interface UserSearchResult {
  id: string
  name: string
  wallet: string
  online: boolean
}

export function DirectMessages({ onClose }: DirectMessagesProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [newConversationSearch, setNewConversationSearch] = useState("")
  const [message, setMessage] = useState("")
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [conversations, setConversations] = useState<DMConversation[]>([
    {
      id: "1",
      user: { name: "alice", avatar: "", online: true, wallet: "7xAlice...9kAlice2" },
      lastMessage: "Hey, how's the trading going?",
      timestamp: "2m ago",
      unread: 2,
    },
    {
      id: "2",
      user: { name: "bob", avatar: "", online: false, wallet: "5xBob...3kBob7" },
      lastMessage: "Thanks for the tip!",
      timestamp: "1h ago",
      unread: 0,
    },
  ])

  const [messages, setMessages] = useState<{ [key: string]: DMMessage[] }>({
    "1": [
      {
        id: "1",
        text: "Hey, how's the trading going?",
        timestamp: "2m ago",
        isOwn: false,
        user: { name: "alice", avatar: "" },
      },
      {
        id: "2",
        text: "Pretty good! Just made a nice profit on SOL",
        timestamp: "1m ago",
        isOwn: true,
        user: { name: "You", avatar: "" },
      },
    ],
    "2": [
      {
        id: "1",
        text: "Thanks for the tip!",
        timestamp: "1h ago",
        isOwn: false,
        user: { name: "bob", avatar: "" },
      },
    ],
  })

  // Mock user search results
  const mockUsers: UserSearchResult[] = [
    { id: "3", name: "charlie", wallet: "9xCharlie...2kChar8", online: true },
    { id: "4", name: "diana", wallet: "4xDiana...7kDiana1", online: false },
    { id: "5", name: "eve", wallet: "8xEve...5kEve9", online: true },
  ]

  const filteredConversations = conversations.filter((conv) =>
    conv.user.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredUsers = mockUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(newConversationSearch.toLowerCase()) ||
      user.wallet.toLowerCase().includes(newConversationSearch.toLowerCase()),
  )

  const activeConv = conversations.find((conv) => conv.id === activeConversation)
  const activeMessages = activeConversation ? messages[activeConversation] || [] : []

  const handleSendMessage = () => {
    if ((!message.trim() && attachedFiles.length === 0) || !activeConversation) return

    const newMessage: DMMessage = {
      id: Date.now().toString(),
      text: message,
      timestamp: "now",
      isOwn: true,
      user: { name: "You", avatar: "" },
    }

    setMessages((prev) => ({
      ...prev,
      [activeConversation]: [...(prev[activeConversation] || []), newMessage],
    }))

    // Update conversation last message
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === activeConversation
          ? { ...conv, lastMessage: message || "File attachment", timestamp: "now" }
          : conv,
      ),
    )

    setMessage("")
    setAttachedFiles([])

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
    // Add Ctrl/Cmd + Enter as alternative send shortcut
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

  const startNewConversation = (user: UserSearchResult) => {
    const newConv: DMConversation = {
      id: user.id,
      user: { name: user.name, avatar: "", online: user.online, wallet: user.wallet },
      lastMessage: "Start a conversation...",
      timestamp: "now",
      unread: 0,
    }

    setConversations((prev) => [newConv, ...prev])
    setActiveConversation(user.id)
    setShowNewConversation(false)
    setNewConversationSearch("")
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to close new conversation modal first, then DM window
      if (e.key === "Escape") {
        if (showNewConversation) {
          setShowNewConversation(false)
          setNewConversationSearch("")
          return
        }
      }

      // Ctrl/Cmd + N for new conversation
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault()
        setShowNewConversation(true)
        return
      }

      // Alt + Up/Down for conversation navigation
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault()
        const currentIndex = conversations.findIndex((conv) => conv.id === activeConversation)

        if (e.key === "ArrowUp" && currentIndex > 0) {
          setActiveConversation(conversations[currentIndex - 1].id)
        } else if (e.key === "ArrowDown" && currentIndex < conversations.length - 1) {
          setActiveConversation(conversations[currentIndex + 1].id)
        }
        return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showNewConversation, conversations, activeConversation])

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
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-neutral-500">
                <MessageCircle className="w-12 h-12 mb-4" />
                <h3 className="text-lg font-semibold text-neutral-300">No conversations</h3>
                <p className="text-sm">Start a new conversation!</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConversation(conv.id)}
                    className={`w-full flex items-center p-3 transition-colors text-left rounded-none ${
                      activeConversation === conv.id
                        ? "bg-neutral-800 text-neutral-100"
                        : "hover:bg-neutral-800 text-neutral-300"
                    }`}
                  >
                    <div className="relative mr-3">
                      <div className="w-10 h-10 bg-neutral-700 rounded-none flex items-center justify-center">
                        <span className="text-sm font-bold text-neutral-300">
                          {conv.user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {conv.user.online && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-none border border-neutral-900" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold truncate">{conv.user.name}</span>
                        <span className="text-xs text-neutral-500">{conv.timestamp}</span>
                      </div>
                      <p className="text-xs text-neutral-400 truncate">{conv.lastMessage}</p>
                    </div>
                    {conv.unread > 0 && (
                      <div className="ml-2 w-5 h-5 bg-red-500 rounded-none flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{conv.unread}</span>
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
                    <div className="w-8 h-8 bg-neutral-700 rounded-none flex items-center justify-center">
                      <span className="text-sm font-bold text-neutral-300">
                        {activeConv?.user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {activeConv?.user.online && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-none" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-neutral-100">{activeConv?.user.name}</span>
                    {activeConv?.user.wallet && (
                      <div className="text-xs text-neutral-500 font-mono">{activeConv.user.wallet}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-none ${
                        msg.isOwn ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-100"
                      }`}
                    >
                      <p className="text-sm">{msg.text}</p>
                      <p className={`text-xs mt-1 ${msg.isOwn ? "text-blue-200" : "text-neutral-500"}`}>
                        {msg.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
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
                        onKeyDown={handleKeyDown}
                        placeholder={`Message ${activeConv?.user.name}...`}
                        className="bg-transparent border-none text-neutral-100 placeholder-neutral-500 focus:ring-0 resize-none min-h-[20px] max-h-[120px] rounded-none p-0 text-sm leading-5 w-full"
                        rows={1}
                      />
                    </div>

                    <div className="flex items-end space-x-2 self-end">
                      <button
                        onClick={handleFileUpload}
                        className="p-2 text-neutral-500 hover:text-neutral-300 rounded-none transition-colors"
                        title="Attach file"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      <Button
                        onClick={handleSendMessage}
                        disabled={!message.trim() && attachedFiles.length === 0}
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
              {newConversationSearch.length > 0 ? (
                filteredUsers.length > 0 ? (
                  <div className="space-y-1 p-2">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => startNewConversation(user)}
                        className="w-full flex items-center p-3 hover:bg-neutral-800 transition-colors text-left"
                      >
                        <div className="relative mr-3">
                          <div className="w-10 h-10 bg-neutral-700 rounded-none flex items-center justify-center">
                            <span className="text-sm font-bold text-neutral-300">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          {user.online && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-none border border-neutral-900" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-neutral-100">{user.name}</div>
                          <div className="text-xs text-neutral-400 font-mono truncate">{user.wallet}</div>
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
