"use client"

import { ChevronRight, ChevronLeft } from "lucide-react"
import type { ChannelUser } from "@/lib/types"

interface UserListProps {
  users: ChannelUser[]
  collapsed: boolean
  onToggleCollapse: () => void
  title?: string
}

export function UserList({ users, collapsed, onToggleCollapse, title = "Members" }: UserListProps) {
  const onlineUsers = users.filter((user) => user.online)
  const offlineUsers = users.filter((user) => !user.online)

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

        {/* Online User Profile Pictures */}
        <div className="flex-1 overflow-y-auto py-2 flex flex-col items-center space-y-2">
          {onlineUsers.map((user) => (
            <div key={user.id} className="relative">
              <div className="w-8 h-8 bg-neutral-700 rounded-none flex items-center justify-center">
                <span className="text-xs font-bold text-neutral-400">{user.name.charAt(0)}</span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-none" />
            </div>
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
          <span className="ml-2 text-xs text-neutral-500">{onlineUsers.length}</span>
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
        {/* Online Users */}
        {onlineUsers.length > 0 && (
          <div className="mb-4">
            <div className="px-4 py-1">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Online — {onlineUsers.length}
              </h3>
            </div>
            <div className="space-y-0.5">
              {onlineUsers.map((user) => (
                <div key={user.id} className="flex items-center px-4 py-1.5 hover:bg-neutral-850 transition-colors">
                  <div className="relative mr-2 flex-shrink-0">
                    <div className="w-6 h-6 bg-neutral-700 rounded-none flex items-center justify-center">
                      <span className="text-xs font-bold text-neutral-400">{user.name.charAt(0)}</span>
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-none" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-neutral-200 truncate">{user.name}</div>
                    {user.activity && <div className="text-xs text-neutral-500 truncate">{user.activity}</div>}
                  </div>
                </div>
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
                <div
                  key={user.id}
                  className="flex items-center px-4 py-1.5 hover:bg-neutral-850 transition-colors opacity-60"
                >
                  <div className="relative mr-2 flex-shrink-0">
                    <div className="w-6 h-6 bg-neutral-800 rounded-none flex items-center justify-center">
                      <span className="text-xs font-bold text-neutral-500">{user.name.charAt(0)}</span>
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-neutral-600 rounded-none" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-neutral-400 truncate">{user.name}</div>
                    <div className="text-xs text-neutral-600">Last seen {user.lastSeen}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
