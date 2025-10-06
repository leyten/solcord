"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { X, Volume2, Bell, Shield, Palette, HelpCircle, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EditProfile } from "@/components/edit-profile"

interface SettingsProps {
  onClose: () => void
}

interface CustomSliderProps {
  value: number[]
  onValueChange: (value: number[]) => void
  max: number
  step: number
  className?: string
}

function CustomSlider({ value, onValueChange, max, step, className }: CustomSliderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const sliderRef = useRef<HTMLDivElement>(null)
  const percentage = (value[0] / max) * 100

  const updateValue = (clientX: number) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const newPercentage = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const newValue = Math.round((newPercentage / 100) * max)
    onValueChange([newValue])
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    updateValue(e.clientX)

    const handleMouseMove = (e: MouseEvent) => {
      updateValue(e.clientX)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
    }

    document.body.style.cursor = "ew-resize"
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  return (
    <div className={`relative flex items-center space-x-4 ${className}`}>
      <div className="flex-1 relative">
        <div ref={sliderRef} className="h-2 bg-neutral-700 relative">
          <div className="h-full bg-white pointer-events-none" style={{ width: `${percentage}%` }} />
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-neutral-900 ${
              isDragging ? "scale-110" : ""
            }`}
            style={{
              left: `calc(${percentage}% - 8px)`,
              cursor: "ew-resize",
            }}
            onMouseDown={handleMouseDown}
          />
        </div>
      </div>
      <div className="bg-neutral-800 border border-neutral-700 px-3 py-1 min-w-[60px] text-center">
        <span className="text-sm font-medium text-neutral-200">{value[0]}%</span>
      </div>
    </div>
  )
}

export function Settings({ onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState("profile")
  const [masterVolume, setMasterVolume] = useState([75])
  const [micVolume, setMicVolume] = useState([80])
  const [notifications, setNotifications] = useState(true)
  const [soundNotifications, setSoundNotifications] = useState(true)
  const [desktopNotifications, setDesktopNotifications] = useState(false)
  const [profileHasChanges, setProfileHasChanges] = useState(false)

  const tabs = [
    { id: "profile", label: "Edit Profile", icon: User },
    { id: "audio", label: "Audio", icon: Volume2 },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy", icon: Shield },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "advanced", label: "Advanced", icon: HelpCircle },
  ]

  const handleSave = () => {
    if (activeTab === "profile") {
      // Trigger the profile form submission via window function
      if ((window as any).submitProfileForm) {
        ;(window as any).submitProfileForm()
      }
    } else {
      // Handle other settings saves here
      onClose()
    }
  }

  const handleProfileSave = () => {
    onClose()
  }

  const canSave = () => {
    if (activeTab === "profile") {
      return profileHasChanges
    }
    return true // For other tabs, always allow save
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div className="h-full">
            <EditProfile
              onClose={() => {}}
              isEmbedded={true}
              onSave={handleProfileSave}
              onHasChanges={setProfileHasChanges}
            />
          </div>
        )

      case "audio":
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-3">Master Volume</label>
              <CustomSlider value={masterVolume} onValueChange={setMasterVolume} max={100} step={1} />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-3">Microphone Volume</label>
              <CustomSlider value={micVolume} onValueChange={setMicVolume} max={100} step={1} />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Input Device</label>
              <Select defaultValue="default">
                <SelectTrigger className="bg-neutral-800 border-neutral-700 text-neutral-100 rounded-none">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-800 border-neutral-700 rounded-none text-white">
                  <SelectItem
                    value="default"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    Default - Built-in Microphone
                  </SelectItem>
                  <SelectItem
                    value="usb"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    USB Headset Microphone
                  </SelectItem>
                  <SelectItem
                    value="bluetooth"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    Bluetooth Headphones
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Output Device</label>
              <Select defaultValue="default">
                <SelectTrigger className="bg-neutral-800 border-neutral-700 text-neutral-100 rounded-none">
                  <SelectValue placeholder="Select speakers" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-800 border-neutral-700 rounded-none text-white">
                  <SelectItem
                    value="default"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    Default - Built-in Speakers
                  </SelectItem>
                  <SelectItem
                    value="usb"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    USB Headset
                  </SelectItem>
                  <SelectItem
                    value="bluetooth"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    Bluetooth Headphones
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case "notifications":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-neutral-300">Enable Notifications</label>
                <p className="text-xs text-neutral-500">Receive notifications for messages and mentions</p>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`w-12 h-6 border border-neutral-600 transition-colors ${
                  notifications ? "bg-green-500" : "bg-white"
                }`}
              >
                <div
                  className={`w-[19px] h-[19px] transition-transform ${
                    notifications ? "translate-x-6 bg-white" : "translate-x-0.5 bg-black"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-neutral-300">Sound Notifications</label>
                <p className="text-xs text-neutral-500">Play sound when receiving notifications</p>
              </div>
              <button
                onClick={() => setSoundNotifications(!soundNotifications)}
                className={`w-12 h-6 border border-neutral-600 transition-colors ${
                  soundNotifications ? "bg-green-500" : "bg-white"
                }`}
              >
                <div
                  className={`w-[19px] h-[19px] transition-transform ${
                    soundNotifications ? "translate-x-6 bg-white" : "translate-x-0.5 bg-black"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-neutral-300">Desktop Notifications</label>
                <p className="text-xs text-neutral-500">Show notifications on your desktop</p>
              </div>
              <button
                onClick={() => setDesktopNotifications(!desktopNotifications)}
                className={`w-12 h-6 border border-neutral-600 transition-colors ${
                  desktopNotifications ? "bg-green-500" : "bg-white"
                }`}
              >
                <div
                  className={`w-[19px] h-[19px] transition-transform ${
                    desktopNotifications ? "translate-x-6 bg-white" : "translate-x-0.5 bg-black"
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Notification Sound</label>
              <Select defaultValue="default">
                <SelectTrigger className="bg-neutral-800 border-neutral-700 text-neutral-100 rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-neutral-800 border-neutral-700 rounded-none text-white">
                  <SelectItem
                    value="default"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    Default
                  </SelectItem>
                  <SelectItem
                    value="chime"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    Chime
                  </SelectItem>
                  <SelectItem
                    value="ping"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    Ping
                  </SelectItem>
                  <SelectItem
                    value="none"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    None
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case "privacy":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-neutral-300">Show Online Status</label>
                <p className="text-xs text-neutral-500">Let others see when you're online</p>
              </div>
              <button className={`w-12 h-6 border border-neutral-600 transition-colors bg-green-500`}>
                <div className={`w-[19px] h-[19px] bg-white transition-transform translate-x-6`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-neutral-300">Allow Direct Messages</label>
                <p className="text-xs text-neutral-500">Receive DMs from other users</p>
              </div>
              <button className={`w-12 h-6 border border-neutral-600 transition-colors bg-green-500`}>
                <div className={`w-[19px] h-[19px] bg-white transition-transform translate-x-6`} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Who can add you as friend</label>
              <Select defaultValue="everyone">
                <SelectTrigger className="bg-neutral-800 border-neutral-700 text-neutral-100 rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-neutral-800 border-neutral-700 rounded-none text-white">
                  <SelectItem
                    value="everyone"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    Everyone
                  </SelectItem>
                  <SelectItem
                    value="friends"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    Friends of friends
                  </SelectItem>
                  <SelectItem
                    value="none"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    No one
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case "appearance":
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Theme</label>
              <Select defaultValue="dark">
                <SelectTrigger className="bg-neutral-800 border-neutral-700 text-neutral-100 rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-neutral-800 border-neutral-700 rounded-none text-white">
                  <SelectItem
                    value="dark"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    Dark
                  </SelectItem>
                  <SelectItem
                    value="light"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    Light
                  </SelectItem>
                  <SelectItem
                    value="auto"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    Auto
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Message Display</label>
              <Select defaultValue="cozy">
                <SelectTrigger className="bg-neutral-800 border-neutral-700 text-neutral-100 rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-neutral-800 border-neutral-700 rounded-none text-white">
                  <SelectItem
                    value="cozy"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    Cozy
                  </SelectItem>
                  <SelectItem
                    value="compact"
                    className="text-white hover:text-black hover:bg-white focus:text-black focus:bg-white"
                  >
                    Compact
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-neutral-300">Show Timestamps</label>
                <p className="text-xs text-neutral-500">Display message timestamps</p>
              </div>
              <button className={`w-12 h-6 border border-neutral-600 transition-colors bg-green-500`}>
                <div className={`w-[19px] h-[19px] bg-white transition-transform translate-x-6`} />
              </button>
            </div>
          </div>
        )

      case "advanced":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-neutral-300">Hardware Acceleration</label>
                <p className="text-xs text-neutral-500">Use GPU for better performance</p>
              </div>
              <button className={`w-12 h-6 border border-neutral-600 transition-colors bg-green-500`}>
                <div className={`w-[19px] h-[19px] bg-white transition-transform translate-x-6`} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Cache Size</label>
              <div className="flex items-center justify-between text-sm text-neutral-400">
                <span>Current cache: 245 MB</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-neutral-600 text-neutral-200 bg-transparent rounded-none h-8"
                >
                  Clear Cache
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800">
              <Button
                variant="outline"
                className="w-full border-neutral-600 text-neutral-400 bg-transparent hover:bg-neutral-800 rounded-none"
              >
                Reset All Settings
              </Button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Number keys 1-6 to switch tabs
      if (e.key >= "1" && e.key <= "6") {
        const tabIndex = Number.parseInt(e.key) - 1
        if (tabIndex < tabs.length) {
          setActiveTab(tabs[tabIndex].id)
        }
        return
      }

      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        handleSave()
        return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [activeTab])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-4xl h-[80vh] flex">
        {/* Sidebar */}
        <div className="w-60 bg-neutral-925 border-r border-neutral-800 flex flex-col">
          <div className="p-4 border-b border-neutral-800">
            <h2 className="text-lg font-semibold text-neutral-100">Settings</h2>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-4 py-2 text-sm transition-colors rounded-none ${
                    activeTab === tab.id
                      ? "bg-neutral-800 text-neutral-100"
                      : "text-neutral-400 hover:bg-neutral-850 hover:text-neutral-200"
                  }`}
                >
                  <Icon className="w-4 h-4 mr-3" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-800">
            <h3 className="text-lg font-semibold text-neutral-100">
              {tabs.find((tab) => tab.id === activeTab)?.label}
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors rounded-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">{renderTabContent()}</div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-4 border-t border-neutral-800">
            <button onClick={onClose} className="text-neutral-400 rounded-none px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={activeTab === "profile" ? !profileHasChanges : false}
              className="rounded-none text-black bg-white px-4 py-2 text-sm hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-500"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
