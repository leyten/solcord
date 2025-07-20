import type { MessageEmbed } from "@/lib/types/messages"

// Simple URL regex
const URL_REGEX = /(https?:\/\/[^\s]+)/g

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX)
  return matches || []
}

export async function generateLinkPreview(url: string): Promise<MessageEmbed | null> {
  try {
    // In a real app, you'd call your backend API that fetches metadata
    // For now, we'll create a simple preview
    const domain = new URL(url).hostname

    // Mock preview data - replace with actual API call
    return {
      type: "link",
      url,
      title: `Link from ${domain}`,
      description: "Click to view the full content",
      site_name: domain,
      thumbnail: "/placeholder.svg?height=120&width=240&text=Link+Preview",
    }
  } catch (error) {
    console.error("Failed to generate link preview:", error)
    return null
  }
}
