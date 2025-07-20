"use client"

import { Mic, MicOff, Headphones, HeadphonesIcon, PhoneOff, Volume2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { Channel, ChannelUser } from "@/lib/types"

interface VoiceChatProps {
  channel: Channel
  users: ChannelUser[]
}

export function VoiceChat({ channel, users }: VoiceChatProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [isConnected, setIsConnected] = useState(true)

  const voiceUsers = users.filter((user) => user.online).slice(0, 6)

  return (
    <div className="flex-1 flex flex-col bg-neutral-950">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-neutral-800 bg-neutral-925">
        <div className="flex items-center">
          <Volume2 className="w-5 h-5 text-neutral-500 mr-2" />
          <span className="text-sm font-semibold text-neutral-100">{channel.name}</span>
          <div className="w-px h-4 bg-neutral-700 mx-3" />
          <span className="text-xs text-neutral-500">{voiceUsers.length} connected</span>
        </div>
      </div>

      {/* Voice Chat Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-8">
        {voiceUsers.length === 0 ? (
          <div className="text-center">
            <Volume2 className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-300 mb-2">No one's here yet</h3>
            <p className="text-sm text-neutral-500">Be the first to join the voice chat!</p>
          </div>
        ) : (
          <>
            {/* Connected Users Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
              {voiceUsers.map((user) => (
                <div key={user.id} className="flex flex-col items-center space-y-3">
                  {/* User Avatar */}
                  <div className="relative">
                    <div className="w-20 h-20 bg-neutral-700 rounded-none flex items-center justify-center border-2 border-neutral-600">
                      <span className="text-2xl font-bold text-neutral-300">{user.name.charAt(0)}</span>
                    </div>
                    {/* Speaking indicator */}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-none flex items-center justify-center border-2 border-neutral-950">
                      <Mic className="w-3 h-3 text-white" />
                    </div>
                  </div>

                  {/* User Name */}
                  <div className="text-center">
                    <p className="text-sm font-semibold text-neutral-200">{user.name}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* You indicator - only show when connected */}
            {isConnected && (
              <div className="mb-8">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <div className="w-24 h-24 bg-neutral-600 rounded-none flex items-center justify-center border-2 border-blue-500">
                      <span className="text-2xl font-bold text-neutral-200">Y</span>
                    </div>
                    {/* Your mic status */}
                    <div
                      className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-none flex items-center justify-center border-2 border-neutral-950 ${
                        isMuted ? "bg-red-500" : "bg-green-500"
                      }`}
                    >
                      {isMuted ? <MicOff className="w-3 h-3 text-white" /> : <Mic className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-neutral-200">You</p>
                    <p className="text-xs text-blue-400">Connected</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Voice Controls - only show when connected */}
        {isConnected && (
          <div className="flex items-center space-x-4">
            {/* Mute Button */}
            <Button
              onClick={() => setIsMuted(!isMuted)}
              size="lg"
              className={`w-14 h-14 rounded-none ${
                isMuted
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-neutral-700 hover:bg-neutral-600 text-neutral-200"
              }`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>

            {/* Deafen Button */}
            <Button
              onClick={() => setIsDeafened(!isDeafened)}
              size="lg"
              className={`w-14 h-14 rounded-none ${
                isDeafened
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-neutral-700 hover:bg-neutral-600 text-neutral-200"
              }`}
            >
              {isDeafened ? <HeadphonesIcon className="w-6 h-6" /> : <Headphones className="w-6 h-6" />}
            </Button>

            {/* Hang Up Button */}
            <Button
              size="lg"
              className="w-14 h-14 rounded-none bg-red-600 hover:bg-red-700 text-white"
              onClick={() => setIsConnected(false)}
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
          </div>
        )}

        {/* Reconnect Button - only show when disconnected */}
        {!isConnected && (
          <Button
            size="lg"
            className="mt-4 bg-green-600 hover:bg-green-700 text-white rounded-none px-6"
            onClick={() => setIsConnected(true)}
          >
            Reconnect to Voice
          </Button>
        )}

        {/* Status Text */}
        <div className="mt-6 text-center">
          {!isConnected ? (
            <p className="text-sm text-neutral-400">Disconnected from voice chat</p>
          ) : (
            <p className="text-xs text-neutral-500">
              {isMuted && isDeafened && "Muted and deafened"}
              {isMuted && !isDeafened && "Muted"}
              {!isMuted && isDeafened && "Deafened"}
              {!isMuted && !isDeafened && "Connected"}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
