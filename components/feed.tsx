"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Heart, MessageCircle, Repeat2, Share, TrendingUp, Clock, Paperclip, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Channel, ChannelUser, Server } from "@/lib/types"
import { feedService, type FeedPost } from "@/lib/services/feed"
import { useProfile } from "@/contexts/profile-context"
import { PostModal } from "@/components/post-modal"
import { ProfileView } from "@/components/profile-view"

interface FeedProps {
  server: Server // 🔥 NEW PROP
  channel: Channel
  users: ChannelUser[]
}

export function Feed({ server, channel }: FeedProps) {
  const { profile } = useProfile()
  const [sortBy, setSortBy] = useState<"top" | "latest">("latest")
  const [newPost, setNewPost] = useState("")
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPosting, setIsPosting] = useState(false)
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isAnnouncementsChannel = channel.id === "announcements"

  // Load posts when channel, server, or sort changes
  useEffect(() => {
    loadPosts()
  }, [channel.id, server.id, sortBy, profile?.id]) // 🔥 DEPEND ON SERVER TOO

  // Subscribe to real-time updates
  useEffect(() => {
    if (!channel.id || !server.id) return

    console.log(`🔌 Setting up feed subscription for server: ${server.id}, channel: ${channel.id}`)

    const subscription = feedService.subscribeToPostUpdates(
      channel.id,
      server.id, // 🔥 PASS SERVER ID
      (newPost: FeedPost) => {
        console.log(`📰 New post received for server ${server.id}:`, newPost.id)

        // Remove any optimistic post with temp ID and add real post
        setPosts((prev) => {
          // Remove optimistic posts (temp IDs start with "temp-")
          const withoutOptimistic = prev.filter((p) => !p.id.startsWith("temp-"))

          // Check if real post already exists
          const exists = withoutOptimistic.some((p) => p.id === newPost.id)
          if (exists) {
            return prev // Don't add duplicate
          }

          return [newPost, ...withoutOptimistic]
        })
      },
      profile?.id,
    )

    const reactionSubscription = feedService.subscribeToReactionUpdates((data: any) => {
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id === data.postId) {
            const updatedPost = {
              ...post,
              likes_count: data.likesCount,
              retweets_count: data.retweetsCount,
            }
            // Update selected post if it's the same post
            if (selectedPost && selectedPost.id === post.id) {
              setSelectedPost(updatedPost)
            }
            return updatedPost
          }
          return post
        }),
      )
    })

    // Subscribe to comment updates to update reply counts
    const commentSubscription = feedService.subscribeToCommentUpdates("*", (comment: any) => {
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id === comment.post_id) {
            const updatedPost = {
              ...post,
              replies_count: post.replies_count + 1,
            }
            // Update selected post if it's the same post
            if (selectedPost && selectedPost.id === post.id) {
              setSelectedPost(updatedPost)
            }
            return updatedPost
          }
          return post
        }),
      )
    })

    return () => {
      subscription.unsubscribe()
      reactionSubscription.unsubscribe()
      commentSubscription.unsubscribe()
    }
  }, [channel.id, server.id, profile?.id, selectedPost]) // 🔥 DEPEND ON SERVER TOO

  const loadPosts = async () => {
    setIsLoading(true)
    try {
      console.log(`📰 Loading posts for server: ${server.id}, channel: ${channel.id}`)
      const feedPosts = await feedService.getPosts(channel.id, server.id, sortBy, profile?.id) // 🔥 PASS SERVER ID
      setPosts(feedPosts)
      console.log(`✅ Loaded ${feedPosts.length} posts for server ${server.id}`)
    } catch (error) {
      console.error("Error loading posts:", error)
    } finally {
      setIsLoading(false)
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

  const handlePost = async () => {
    if (!newPost.trim() && attachedFiles.length === 0) return
    if (!profile) return

    setIsPosting(true)
    try {
      console.log(`📝 Creating post for server: ${server.id}, channel: ${channel.id}`)

      // Create optimistic post and add to UI immediately
      const optimisticPost: FeedPost = {
        id: `temp-${Date.now()}`,
        channel_id: channel.id,
        server_id: server.id,
        author_id: profile.id,
        content: newPost.trim() || null,
        attachments:
          attachedFiles.length > 0
            ? attachedFiles.map((file) => ({
                id: `temp-attachment-${Date.now()}`,
                filename: file.name,
                size: file.size,
                content_type: file.type,
                url: URL.createObjectURL(file),
              }))
            : [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        likes_count: 0,
        retweets_count: 0,
        replies_count: 0,
        user_liked: false,
        user_retweeted: false,
        profiles: {
          id: profile.id,
          username: profile.username,
          display_name: profile.name,
          avatar_url: profile.pfp_url || null,
        },
      }

      // Add optimistic post to UI immediately
      setPosts((prev) => [optimisticPost, ...prev])

      const post = await feedService.createPost({
        channel_id: channel.id,
        server_id: server.id,
        content: newPost.trim() || undefined,
        attachments: attachedFiles.length > 0 ? attachedFiles : undefined,
        userId: profile.id,
      })

      if (post) {
        console.log(`✅ Optimistic post created for server ${server.id}:`, post.id)
        setNewPost("")
        setAttachedFiles([])
      }
    } catch (error) {
      console.error("Error creating post:", error)
    } finally {
      setIsPosting(false)
    }
  }

  const handleLike = async (postId: string) => {
    if (!profile) return

    const currentPost = posts.find((p) => p.id === postId)
    if (!currentPost) return

    // Optimistic update for posts list
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              user_liked: !post.user_liked,
              likes_count: post.user_liked ? post.likes_count - 1 : post.likes_count + 1,
            }
          : post,
      ),
    )

    // Optimistic update for selected post if it's the same
    if (selectedPost && selectedPost.id === postId) {
      setSelectedPost({
        ...selectedPost,
        user_liked: !selectedPost.user_liked,
        likes_count: selectedPost.user_liked ? selectedPost.likes_count - 1 : selectedPost.likes_count + 1,
      })
    }

    const result = await feedService.toggleLike(postId, profile.id)
    if (!result.success) {
      // Revert optimistic updates on failure
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                user_liked: currentPost.user_liked,
                likes_count: currentPost.likes_count,
              }
            : post,
        ),
      )
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost({
          ...selectedPost,
          user_liked: currentPost.user_liked,
          likes_count: currentPost.likes_count,
        })
      }
    }
  }

  const handleRetweet = async (postId: string) => {
    if (!profile) return

    const currentPost = posts.find((p) => p.id === postId)
    if (!currentPost) return

    // Optimistic update for posts list
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              user_retweeted: !post.user_retweeted,
              retweets_count: post.user_retweeted ? post.retweets_count - 1 : post.retweets_count + 1,
            }
          : post,
      ),
    )

    // Optimistic update for selected post if it's the same
    if (selectedPost && selectedPost.id === postId) {
      setSelectedPost({
        ...selectedPost,
        user_retweeted: !selectedPost.user_retweeted,
        retweets_count: selectedPost.user_retweeted ? selectedPost.retweets_count - 1 : selectedPost.retweets_count + 1,
      })
    }

    const result = await feedService.toggleRetweet(postId, profile.id)
    if (!result.success) {
      // Revert optimistic updates on failure
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                user_retweeted: currentPost.user_retweeted,
                retweets_count: currentPost.retweets_count,
              }
            : post,
        ),
      )
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost({
          ...selectedPost,
          user_retweeted: currentPost.user_retweeted,
          retweets_count: currentPost.retweets_count,
        })
      }
    }
  }

  const handlePostClick = (post: FeedPost, e: React.MouseEvent) => {
    // Don't open modal if clicking on interactive elements
    const target = e.target as HTMLElement
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.tagName === "IMG" ||
      target.closest(".profile-clickable")
    ) {
      return
    }
    setSelectedPost(post)
  }

  const handleProfileClick = (postProfile: any, e: React.MouseEvent) => {
    e.stopPropagation()
    // Convert post profile to the format expected by ProfileView
    const profileData = {
      id: postProfile.id || postProfile.user_id,
      name: postProfile.display_name || postProfile.username || "Unknown User",
      username: postProfile.username || "unknown",
      pfp_url: postProfile.avatar_url || postProfile.pfp_url,
      bio: postProfile.bio || "",
      wallet_address: postProfile.wallet_address || "",
      status: postProfile.status || "offline",
    }
    setSelectedProfile(profileData)
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return "now"
    if (diffInMinutes < 60) return `${diffInMinutes}m`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`
    return `${Math.floor(diffInMinutes / 1440)}d`
  }

  // Helper function to get attachment properties with fallback for both formats
  const getAttachmentProps = (attachment: any) => {
    return {
      url: attachment.url,
      filename: attachment.filename || attachment.name || "File",
      contentType: attachment.content_type || attachment.type || "",
      size: attachment.size || 0,
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not in an input field and no modal is open
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        selectedPost ||
        selectedProfile
      ) {
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
  }, [isAnnouncementsChannel, selectedPost, selectedProfile])

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
              className={`h-8 px-3 text-xs transition-colors ${
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
              className={`h-8 px-3 text-xs transition-colors ${
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
      {!isAnnouncementsChannel && profile && (
        <div className="p-4 border-b border-neutral-800 bg-neutral-925">
          <div className="flex space-x-3">
            <div className="w-10 h-10 bg-neutral-700 flex items-center justify-center flex-shrink-0">
              {profile.pfp_url ? (
                <img
                  src={profile.pfp_url || "/placeholder.svg"}
                  alt={profile.name}
                  className="w-10 h-10 object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-neutral-300">{profile.name.charAt(0)}</span>
              )}
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
                      className="flex items-center justify-between bg-neutral-800 border border-neutral-700 p-2"
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
                  className="p-2 text-neutral-500 hover:text-neutral-300 transition-colors"
                  title="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <Button
                  onClick={handlePost}
                  disabled={(!newPost.trim() && attachedFiles.length === 0) || isPosting}
                  size="sm"
                  className="hover:bg-white text-black bg-white disabled:bg-neutral-700 disabled:text-neutral-500 rounded-none"
                >
                  {isPosting ? "Posting..." : "Post"}
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
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-neutral-500">Loading posts...</div>
          </div>
        ) : posts.length === 0 ? (
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
          posts.map((post) => (
            <div
              key={post.id}
              className="p-4 border-b border-neutral-800 hover:bg-neutral-925/50 transition-colors cursor-pointer"
              onClick={(e) => handlePostClick(post, e)}
            >
              <div className="flex space-x-3">
                <div
                  className="w-10 h-10 bg-neutral-700 flex items-center justify-center flex-shrink-0 cursor-pointer profile-clickable"
                  onClick={(e) => handleProfileClick(post.profiles, e)}
                >
                  {post.profiles?.avatar_url ? (
                    <img
                      src={post.profiles.avatar_url || "/placeholder.svg"}
                      alt={post.profiles.display_name || post.profiles.username}
                      className="w-10 h-10 object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-neutral-300">
                      {(post.profiles?.display_name || post.profiles?.username)?.charAt(0) || "U"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span
                      className="font-semibold text-neutral-100 cursor-pointer hover:underline profile-clickable"
                      onClick={(e) => handleProfileClick(post.profiles, e)}
                    >
                      {post.profiles?.display_name || post.profiles?.username || "Unknown User"}
                    </span>
                    {isAnnouncementsChannel && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium">ANNOUNCEMENT</span>
                    )}
                    <span className="text-xs text-neutral-500">·</span>
                    <span className="text-xs text-neutral-500">{formatTimestamp(post.created_at)}</span>
                  </div>

                  {post.content && (
                    <p className="text-neutral-200 mb-3 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  )}

                  {/* Attachments - Handle both old and new formats */}
                  {post.attachments && post.attachments.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {post.attachments.map((attachment: any, index: number) => {
                        const { url, filename, contentType } = getAttachmentProps(attachment)
                        return (
                          <div key={attachment.id || index}>
                            {contentType.startsWith("image/") ? (
                              <img
                                src={url || "/placeholder.svg"}
                                alt={filename}
                                className="max-w-sm max-h-64 object-cover border border-neutral-700 cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(url, "_blank")
                                }}
                              />
                            ) : (
                              <div className="flex items-center space-x-2 bg-neutral-800 border border-neutral-700 p-2 max-w-sm">
                                <Paperclip className="w-4 h-4 text-neutral-400" />
                                <span className="text-sm text-neutral-300 truncate">{filename}</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center space-x-6">
                    <button className="flex items-center space-x-2 text-neutral-500 hover:text-blue-400 transition-colors">
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-xs">{post.replies_count}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRetweet(post.id)
                      }}
                      className={`flex items-center space-x-2 transition-colors ${
                        post.user_retweeted ? "text-green-400" : "text-neutral-500 hover:text-green-400"
                      }`}
                    >
                      <Repeat2 className={`w-4 h-4 ${post.user_retweeted ? "fill-current" : ""}`} />
                      <span className="text-xs">{post.retweets_count}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLike(post.id)
                      }}
                      className={`flex items-center space-x-2 transition-colors ${
                        post.user_liked ? "text-red-400" : "text-neutral-500 hover:text-red-400"
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${post.user_liked ? "fill-current" : ""}`} />
                      <span className="text-xs">{post.likes_count}</span>
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

      {/* Post Modal */}
      {selectedPost && (
        <PostModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onLike={handleLike}
          onRetweet={handleRetweet}
          onProfileClick={handleProfileClick}
        />
      )}

      {/* Profile Modal */}
      {selectedProfile && <ProfileView user={selectedProfile} onClose={() => setSelectedProfile(null)} />}
    </div>
  )
}
