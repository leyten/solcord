"use client"

import { ChevronRight, ChevronLeft } from "lucide-react"
import type { ChannelUser } from "@/lib/types"

interface UserListProps {
  users: ChannelUser[]
  collapsed: boolean
  onToggleCollapse: () => void
  title?: string
  onUserClick?: (userId: string) => void
}

const statusColors = {
  online: "bg-green-500",
  dnd: "bg-red-500",
  offline: "bg-neutral-600",
}

export function UserList({ users, collapsed, onToggleCollapse, title = "Members", onUserClick }: UserListProps) {
  // Separate users by status - DND users are considered "online" for grouping but with different activity
  const onlineUsers = users.filter((user) => user.status === "online")
  const dndUsers = users.filter((user) => user.status === "dnd")
  const offlineUsers = users.filter((user) => user.status === "offline")

  const activeUsers = [...onlineUsers, ...dndUsers]

  const handleUserClick = (user: ChannelUser) => {
    if (onUserClick) {
      onUserClick(user.id)
    }
  }

  if (collapsed) {
    return (
      <div className="w-12 bg-neutral-925 border-l border-neutral-800 flex flex-col">
        {/* Expand Button */}
        <div className="h-12 flex items-center justify-center border-b border-neutral-800 bg-neutral-900">
          <button
            onClick={onToggleCollapse}
            className="p-2 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 rounded-none transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Online + DND User Profile Pictures */}
        <div className="flex-1 overflow-y-auto py-2 flex flex-col items-center space-y-2">
          {activeUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => handleUserClick(user)}
              className="relative hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 bg-neutral-700 rounded-none flex items-center justify-center overflow-hidden">
                {user.avatar ? (
                  <img
                    src={user.avatar || "/placeholder.svg"}
                    alt={user.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-xs font-bold text-neutral-400">{user.name.charAt(0)}</span>
                )}
              </div>
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 ${statusColors[user.status || "offline"]} rounded-none`}
              />
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-60 bg-neutral-925 border-l border-neutral-800 flex flex-col">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-neutral-800 bg-neutral-900">
        <div className="flex items-center">
          <span className="text-sm font-semibold text-neutral-100">{title}</span>
          <span className="ml-2 text-xs text-neutral-500">{users.length}</span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 rounded-none transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Online Users (includes DND) */}
        {activeUsers.length > 0 && (
          <div className="mb-4">
            <div className="px-4 py-1">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Online — {activeUsers.length}
              </h3>
            </div>
            <div className="space-y-0.5">
              {activeUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleUserClick(user)}
                  className="w-full flex items-center px-4 py-1.5 hover:bg-neutral-850 transition-colors text-left"
                >
                  <div className="relative mr-2 flex-shrink-0">
                    <div className="w-6 h-6 bg-neutral-700 rounded-none flex items-center justify-center overflow-hidden">
                      {user.avatar ? (
                        <img
                          src={user.avatar || "/placeholder.svg"}
                          alt={user.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xs font-bold text-neutral-400">{user.name.charAt(0)}</span>
                      )}
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 ${statusColors[user.status || "offline"]} rounded-none`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-neutral-200 truncate">{user.name}</div>
                    <div className="text-xs text-neutral-500 truncate">
                      {user.status === "dnd" ? "Do Not Disturb" : "Active"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Offline Users */}
        {offlineUsers.length > 0 && (
          <div>
            <div className="px-4 py-1">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Offline — {offlineUsers.length}
              </h3>
            </div>
            <div className="space-y-0.5">
              {offlineUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleUserClick(user)}
                  className="w-full flex items-center px-4 py-1.5 hover:bg-neutral-850 transition-colors opacity-60 text-left"
                >
                  <div className="relative mr-2 flex-shrink-0">
                    <div className="w-6 h-6 bg-neutral-800 rounded-none flex items-center justify-center overflow-hidden">
                      {user.avatar ? (
                        <img
                          src={user.avatar || "/placeholder.svg"}
                          alt={user.name}
                          className="w-full h-full object-cover opacity-60"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xs font-bold text-neutral-500">{user.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 ${statusColors.offline} rounded-none`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-neutral-400 truncate">{user.name}</div>
                    <div className="text-xs text-neutral-600">Last seen {user.lastSeen}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {activeUsers.length === 0 && offlineUsers.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-center text-neutral-500 py-8">
            <div>
              <p className="text-sm">No members found</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
