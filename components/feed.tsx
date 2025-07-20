"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Heart, MessageCircle, Repeat2, Share, TrendingUp, Clock, Paperclip, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Channel, ChannelUser } from "@/lib/types"

interface FeedPost {
  id: string
  user: {
    name: string
    avatar: string
  }
  content: string
  timestamp: string
  likes: number
  retweets: number
  replies: number
  liked: boolean
  retweeted: boolean
}

interface FeedProps {
  channel: Channel
  users: ChannelUser[]
}

export function Feed({ channel }: FeedProps) {
  const [sortBy, setSortBy] = useState<"top" | "latest">("latest")
  const [newPost, setNewPost] = useState("")
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isAnnouncementsChannel = channel.id === "announcements"

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

  const handlePost = () => {
    if (!newPost.trim() && attachedFiles.length === 0) return

    const post: FeedPost = {
      id: Date.now().toString(),
      user: { name: "You", avatar: "" },
      content: newPost,
      timestamp: "now",
      likes: 0,
      retweets: 0,
      replies: 0,
      liked: false,
      retweeted: false,
    }

    setPosts([post, ...posts])
    setNewPost("")
    setAttachedFiles([])
  }

  const handleLike = (postId: string) => {
    setPosts(
      posts.map((post) =>
        post.id === postId
          ? { ...post, liked: !post.liked, likes: post.liked ? post.likes - 1 : post.likes + 1 }
          : post,
      ),
    )
  }

  const handleRetweet = (postId: string) => {
    setPosts(
      posts.map((post) =>
        post.id === postId
          ? { ...post, retweeted: !post.retweeted, retweets: post.retweeted ? post.retweets - 1 : post.retweets + 1 }
          : post,
      ),
    )
  }

  const sortedPosts = [...posts].sort((a, b) => {
    if (sortBy === "top") {
      return b.likes + b.retweets - (a.likes + a.retweets)
    }
    return 0 // Keep original order for "latest"
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // R to refresh/switch to latest
      if (e.key === "r" || e.key === "R") {
        setSortBy("latest")
        return
      }

      // T for top posts
      if (e.key === "t" || e.key === "T") {
        setSortBy("top")
        return
      }

      // N for new post (focus textarea)
      if (e.key === "n" || e.key === "N") {
        if (!isAnnouncementsChannel) {
          const textarea = document.querySelector('textarea[placeholder*="What\'s happening"]') as HTMLTextAreaElement
          if (textarea) {
            textarea.focus()
          }
        }
        return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isAnnouncementsChannel])

  return (
    <div className="flex-1 flex flex-col bg-neutral-950">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-neutral-800 bg-neutral-925">
        <div className="flex items-center">
          <TrendingUp className="w-5 h-5 text-neutral-500 mr-2" />
          <span className="text-sm font-semibold text-neutral-100">{channel.name}</span>
          <div className="w-px h-4 bg-neutral-700 mx-3" />
          <span className="text-xs text-neutral-500">{channel.description}</span>
        </div>

        {/* Sort Toggle - only show for regular feed */}
        {!isAnnouncementsChannel && (
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant={sortBy === "latest" ? "default" : "ghost"}
              onClick={() => setSortBy("latest")}
              className={`h-8 px-3 text-xs rounded-none transition-colors ${
                sortBy === "latest"
                  ? "bg-white text-black hover:bg-gray-200"
                  : "bg-transparent text-white hover:bg-white hover:text-black"
              }`}
            >
              <Clock className="w-3 h-3 mr-1" />
              Latest
            </Button>
            <Button
              size="sm"
              variant={sortBy === "top" ? "default" : "ghost"}
              onClick={() => setSortBy("top")}
              className={`h-8 px-3 text-xs rounded-none transition-colors ${
                sortBy === "top"
                  ? "bg-white text-black hover:bg-gray-200"
                  : "bg-transparent text-white hover:bg-white hover:text-black"
              }`}
            >
              <TrendingUp className="w-3 h-3 mr-1" />
              Top
            </Button>
          </div>
        )}
      </div>

      {/* New Post - only show for regular feed */}
      {!isAnnouncementsChannel && (
        <div className="p-4 border-b border-neutral-800 bg-neutral-925">
          <div className="flex space-x-3">
            <div className="w-10 h-10 bg-neutral-700 rounded-none flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-neutral-300">Y</span>
            </div>
            <div className="flex-1 space-y-3">
              <Textarea
                placeholder="What's happening in the community?"
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault()
                    handlePost()
                  }
                }}
                className="bg-neutral-900 border-neutral-700 text-neutral-100 placeholder-neutral-500 resize-none focus:border-neutral-600 focus:ring-0 rounded-none"
                rows={3}
              />

              {/* File Attachments */}
              {attachedFiles.length > 0 && (
                <div className="space-y-2">
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

              <div className="flex items-center justify-between">
                <button
                  onClick={handleFileUpload}
                  className="p-2 text-neutral-500 hover:text-neutral-300 rounded-none transition-colors"
                  title="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <Button
                  onClick={handlePost}
                  disabled={!newPost.trim() && attachedFiles.length === 0}
                  size="sm"
                  className="hover:bg-white rounded-none text-black bg-white disabled:bg-neutral-700 disabled:text-neutral-500"
                >
                  Post
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
          />
        </div>
      )}

      {/* Feed Posts */}
      <div className="flex-1 overflow-y-auto">
        {sortedPosts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-500 h-full">
            <TrendingUp className="w-12 h-12 mb-4" />
            <h3 className="text-lg font-semibold text-neutral-300">
              {isAnnouncementsChannel ? "No announcements yet" : "The feed is empty"}
            </h3>
            <p className="text-sm">
              {isAnnouncementsChannel ? "Official announcements will appear here" : "Be the first to post something!"}
            </p>
          </div>
        ) : (
          sortedPosts.map((post) => (
            <div key={post.id} className="p-4 border-b border-neutral-800 hover:bg-neutral-925/50 transition-colors">
              <div className="flex space-x-3">
                <div className="w-10 h-10 bg-neutral-700 rounded-none flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-neutral-300">{post.user.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="font-semibold text-neutral-100">{post.user.name}</span>
                    {isAnnouncementsChannel && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-none">
                        ANNOUNCEMENT
                      </span>
                    )}
                    <span className="text-xs text-neutral-500">·</span>
                    <span className="text-xs text-neutral-500">{post.timestamp}</span>
                  </div>
                  <p className="text-neutral-200 mb-3 leading-relaxed whitespace-pre-wrap">{post.content}</p>

                  {/* Actions */}
                  <div className="flex items-center space-x-6">
                    <button className="flex items-center space-x-2 text-neutral-500 hover:text-blue-400 transition-colors">
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-xs">{post.replies}</span>
                    </button>
                    <button
                      onClick={() => handleRetweet(post.id)}
                      className={`flex items-center space-x-2 transition-colors ${
                        post.retweeted ? "text-green-400" : "text-neutral-500 hover:text-green-400"
                      }`}
                    >
                      <Repeat2 className="w-4 h-4" />
                      <span className="text-xs">{post.retweets}</span>
                    </button>
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center space-x-2 transition-colors ${
                        post.liked ? "text-red-400" : "text-neutral-500 hover:text-red-400"
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${post.liked ? "fill-current" : ""}`} />
                      <span className="text-xs">{post.likes}</span>
                    </button>
                    <button className="flex items-center space-x-2 text-neutral-500 hover:text-neutral-300 transition-colors">
                      <Share className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
