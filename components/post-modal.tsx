"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { X, Heart, MessageCircle, Repeat2, Share, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FeedPost, FeedComment } from "@/lib/services/feed"
import { feedService } from "@/lib/services/feed"
import { useProfile } from "@/contexts/profile-context"
import { ProfileView } from "@/components/profile-view"

interface PostModalProps {
  post: FeedPost
  onClose: () => void
  onLike: (postId: string) => void
  onRetweet: (postId: string) => void
  onProfileClick: (profile: any, e: React.MouseEvent) => void
}

export function PostModal({ post, onClose, onLike, onRetweet, onProfileClick }: PostModalProps) {
  const { profile } = useProfile()
  const [comments, setComments] = useState<FeedComment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isLoadingComments, setIsLoadingComments] = useState(true)
  const [isPostingComment, setIsPostingComment] = useState(false)
  const [currentPost, setCurrentPost] = useState<FeedPost>(post)
  const [selectedProfile, setSelectedProfile] = useState<any>(null)
  const commentInputRef = useRef<HTMLInputElement>(null)

  // Update current post when prop changes
  useEffect(() => {
    setCurrentPost(post)
  }, [post])

  // Load comments when modal opens
  useEffect(() => {
    loadComments()
  }, [post.id])

  // Focus comment input when modal opens
  useEffect(() => {
    const timer = setTimeout(() => {
      commentInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectedProfile) {
          setSelectedProfile(null)
        } else {
          onClose()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose, selectedProfile])

  // Subscribe to new comments
  useEffect(() => {
    const subscription = feedService.subscribeToCommentUpdates(post.id, (newComment: FeedComment) => {
      // Only add the comment if it doesn't already exist (to prevent duplicates)
      setComments((prev) => {
        const exists = prev.some((comment) => comment.id === newComment.id)
        if (exists) {
          return prev
        }
        // Add new comment at the beginning (most recent first)
        return [newComment, ...prev]
      })
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [post.id])

  const loadComments = async () => {
    setIsLoadingComments(true)
    try {
      const postComments = await feedService.getComments(post.id)
      // Sort comments by created_at descending (most recent first)
      const sortedComments = postComments.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      setComments(sortedComments)
    } catch (error) {
      console.error("Error loading comments:", error)
    } finally {
      setIsLoadingComments(false)
    }
  }

  const handleComment = async () => {
    const content = newComment.trim()
    if (!content || !profile || isPostingComment) return

    setIsPostingComment(true)

    // Immediately update the replies count (client-side optimistic update)
    setCurrentPost((prev) => ({
      ...prev,
      replies_count: prev.replies_count + 1,
    }))

    try {
      const comment = await feedService.createComment({
        post_id: post.id,
        content,
        userId: profile.id,
      })
      if (comment) {
        setNewComment("")
      }
    } catch (error) {
      console.error("Error creating comment:", error)
      // Revert the optimistic update on error
      setCurrentPost((prev) => ({
        ...prev,
        replies_count: prev.replies_count - 1,
      }))
    } finally {
      setIsPostingComment(false)
    }
  }

  const handleProfileClickInternal = (profileData: any, e: React.MouseEvent) => {
    e.stopPropagation()
    // Convert profile data to the format expected by ProfileView
    const formattedProfile = {
      id: profileData.id || profileData.user_id,
      name: profileData.display_name || profileData.username || "Unknown User",
      username: profileData.username || "unknown",
      pfp_url: profileData.avatar_url || profileData.pfp_url,
      bio: profileData.bio || "",
      wallet_address: profileData.wallet_address || "",
      status: profileData.status || "offline",
    }
    setSelectedProfile(formattedProfile)
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

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-2xl max-h-[90vh] rounded-none flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-neutral-100">Post</h2>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-none transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Fixed scrollbar styling */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-700">
          {/* Original Post */}
          <div className="p-6 border-b border-neutral-800">
            <div className="flex space-x-3">
              <div
                className="w-12 h-12 bg-neutral-700 flex items-center justify-center flex-shrink-0 cursor-pointer"
                onClick={(e) => handleProfileClickInternal(currentPost.profiles, e)}
              >
                {currentPost.profiles?.avatar_url ? (
                  <img
                    src={currentPost.profiles.avatar_url || "/placeholder.svg"}
                    alt={currentPost.profiles.display_name || currentPost.profiles.username}
                    className="w-12 h-12 object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold text-neutral-300">
                    {(currentPost.profiles?.display_name || currentPost.profiles?.username)?.charAt(0) || "U"}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-3">
                  <span
                    className="font-semibold text-neutral-100 text-lg cursor-pointer hover:underline"
                    onClick={(e) => handleProfileClickInternal(currentPost.profiles, e)}
                  >
                    {currentPost.profiles?.display_name || currentPost.profiles?.username || "Unknown User"}
                  </span>
                  <span className="text-neutral-500">@{currentPost.profiles?.username || "unknown"}</span>
                  <span className="text-neutral-500">·</span>
                  <span className="text-neutral-500">{formatTimestamp(currentPost.created_at)}</span>
                </div>

                {currentPost.content && (
                  <p className="text-neutral-200 mb-4 leading-relaxed whitespace-pre-wrap text-lg">
                    {currentPost.content}
                  </p>
                )}

                {/* Attachments */}
                {currentPost.attachments && currentPost.attachments.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {currentPost.attachments.map((attachment: any, index: number) => {
                      const { url, filename, contentType } = getAttachmentProps(attachment)
                      return (
                        <div key={attachment.id || index}>
                          {contentType.startsWith("image/") ? (
                            <img
                              src={url || "/placeholder.svg"}
                              alt={filename}
                              className="max-w-full max-h-96 object-cover rounded border border-neutral-700 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(url, "_blank")}
                            />
                          ) : (
                            <div className="flex items-center space-x-2 bg-neutral-800 border border-neutral-700 p-3 rounded">
                              <Paperclip className="w-5 h-5 text-neutral-400" />
                              <span className="text-neutral-300 truncate">{filename}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Action Buttons with Counts - Twitter Style Layout */}
                <div className="flex items-center justify-between py-4 border-b border-neutral-800 max-w-md">
                  <button className="flex items-center space-x-2 text-neutral-500 hover:text-blue-400 transition-colors">
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm">{currentPost.replies_count}</span>
                  </button>
                  <button
                    onClick={() => onRetweet(currentPost.id)}
                    className={`flex items-center space-x-2 transition-colors ${
                      currentPost.user_retweeted ? "text-green-400" : "text-neutral-500 hover:text-green-400"
                    }`}
                  >
                    <Repeat2 className={`w-5 h-5 ${currentPost.user_retweeted ? "fill-current" : ""}`} />
                    <span className="text-sm">{currentPost.retweets_count}</span>
                  </button>
                  <button
                    onClick={() => onLike(currentPost.id)}
                    className={`flex items-center space-x-2 transition-colors ${
                      currentPost.user_liked ? "text-red-400" : "text-neutral-500 hover:text-red-400"
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${currentPost.user_liked ? "fill-current" : ""}`} />
                    <span className="text-sm">{currentPost.likes_count}</span>
                  </button>
                  <button className="flex items-center space-x-2 text-neutral-500 hover:text-neutral-300 transition-colors">
                    <Share className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="flex-1">
            {/* New Comment Input */}
            {profile && (
              <div className="p-4 border-b border-neutral-800">
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
                    <Input
                      ref={commentInputRef}
                      placeholder="Post your reply"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleComment()
                        }
                      }}
                      className="bg-transparent border-none text-neutral-100 placeholder-neutral-500 focus:ring-0 text-lg p-0"
                      disabled={isPostingComment}
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={handleComment}
                        disabled={!newComment.trim() || isPostingComment}
                        size="sm"
                        className="bg-white text-black hover:bg-gray-200 rounded-none disabled:bg-neutral-700 disabled:text-neutral-500"
                      >
                        {isPostingComment ? "Posting..." : "Reply"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Comments List */}
            <div>
              {isLoadingComments ? (
                <div className="p-8 text-center text-neutral-500">Loading comments...</div>
              ) : comments.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-neutral-600" />
                  <p className="text-lg font-semibold text-neutral-400">No replies yet</p>
                  <p className="text-sm">Be the first to reply!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="p-4 border-b border-neutral-800 transition-colors">
                    <div className="flex space-x-3">
                      <div
                        className="w-10 h-10 bg-neutral-700 flex items-center justify-center flex-shrink-0 cursor-pointer"
                        onClick={(e) => handleProfileClickInternal(comment.profiles, e)}
                      >
                        {comment.profiles?.avatar_url ? (
                          <img
                            src={comment.profiles.avatar_url || "/placeholder.svg"}
                            alt={comment.profiles.display_name || comment.profiles.username}
                            className="w-10 h-10 object-cover"
                          />
                        ) : (
                          <span className="text-sm font-bold text-neutral-300">
                            {(comment.profiles?.display_name || comment.profiles?.username)?.charAt(0) || "U"}
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span
                            className="font-semibold text-neutral-100 cursor-pointer hover:underline"
                            onClick={(e) => handleProfileClickInternal(comment.profiles, e)}
                          >
                            {comment.profiles?.display_name || comment.profiles?.username || "Unknown User"}
                          </span>
                          <span className="text-neutral-500 text-sm">@{comment.profiles?.username || "unknown"}</span>
                          <span className="text-neutral-500 text-sm">·</span>
                          <span className="text-neutral-500 text-sm">{formatTimestamp(comment.created_at)}</span>
                        </div>
                        <p className="text-neutral-200 leading-relaxed">{comment.content}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Profile Modal */}
        {selectedProfile && <ProfileView user={selectedProfile} onClose={() => setSelectedProfile(null)} />}
      </div>
    </div>
  )
}
