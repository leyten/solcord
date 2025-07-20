"use client"

import { useState } from "react"
import { Crown, Star, Circle, Settings } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface RankSelectorProps {
  currentRank: "1%+" | "0.5%+" | "0.1%+" | "Holder"
  onRankChange: (rank: "1%+" | "0.5%+" | "0.1%+" | "Holder") => void
}

const rankIcons: { [key: string]: any } = {
  "1%+": Crown,
  "0.5%+": Star,
  "0.1%+": Circle,
  Holder: Circle,
}

export function RankSelector({ currentRank, onRankChange }: RankSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const CurrentIcon = rankIcons[currentRank]

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded-none p-3 flex items-center space-x-2 text-neutral-200 transition-colors shadow-lg">
            <Settings className="w-4 h-4" />
            <CurrentIcon className="w-4 h-4" />
            <span className="text-sm font-medium">{currentRank}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" className="bg-neutral-800 border-neutral-700 text-neutral-100 rounded-none">
          <DropdownMenuItem
            onClick={() => onRankChange("1%+")}
            className="hover:bg-neutral-700 cursor-pointer rounded-none"
          >
            <Crown className="w-4 h-4 mr-2" />
            1%+ (Top 1%)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onRankChange("0.5%+")}
            className="hover:bg-neutral-700 cursor-pointer rounded-none"
          >
            <Star className="w-4 h-4 mr-2" />
            0.5%+ (Top 0.5%)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onRankChange("0.1%+")}
            className="hover:bg-neutral-700 cursor-pointer rounded-none"
          >
            <Circle className="w-4 h-4 mr-2" />
            0.1%+ (Top 0.1%)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onRankChange("Holder")}
            className="hover:bg-neutral-700 cursor-pointer rounded-none"
          >
            <Circle className="w-4 h-4 mr-2" />
            Holder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
