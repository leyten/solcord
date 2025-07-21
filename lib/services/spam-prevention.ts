interface UserSpamData {
  messageTimestamps: number[]
  lastMessages: string[]
  cooldownUntil?: number
  warningCount: number
}

class SpamPreventionService {
  private userData = new Map<string, UserSpamData>()

  // Configuration
  private readonly MAX_MESSAGES_PER_MINUTE = 20
  private readonly MAX_MESSAGES_PER_5_SECONDS = 3
  private readonly DUPLICATE_MESSAGE_THRESHOLD = 3
  private readonly MIN_MESSAGE_INTERVAL = 500 // 0.5 seconds
  private readonly COOLDOWN_DURATION = 30000 // 30 seconds
  private readonly MAX_MESSAGE_LENGTH = 2000
  private readonly MIN_MESSAGE_LENGTH = 1

  private getUserData(userId: string): UserSpamData {
    if (!this.userData.has(userId)) {
      this.userData.set(userId, {
        messageTimestamps: [],
        lastMessages: [],
        warningCount: 0,
      })
    }
    return this.userData.get(userId)!
  }

  private cleanOldTimestamps(timestamps: number[], maxAge: number): number[] {
    const now = Date.now()
    return timestamps.filter((timestamp) => now - timestamp < maxAge)
  }

  private normalizeMessage(content: string): string {
    return content.toLowerCase().replace(/\s+/g, " ").trim()
  }

  checkSpam(
    userId: string,
    content: string,
  ): {
    allowed: boolean
    reason?: string
    cooldownRemaining?: number
  } {
    const now = Date.now()
    const userData = this.getUserData(userId)

    // Check if user is in cooldown
    if (userData.cooldownUntil && now < userData.cooldownUntil) {
      return {
        allowed: false,
        reason: "You are temporarily rate limited. Please slow down.",
        cooldownRemaining: userData.cooldownUntil - now,
      }
    }

    // Check message length
    if (content.length > this.MAX_MESSAGE_LENGTH) {
      return {
        allowed: false,
        reason: `Message too long. Maximum ${this.MAX_MESSAGE_LENGTH} characters allowed.`,
      }
    }

    if (content.length < this.MIN_MESSAGE_LENGTH) {
      return {
        allowed: false,
        reason: "Message cannot be empty.",
      }
    }

    // Clean old timestamps
    userData.messageTimestamps = this.cleanOldTimestamps(userData.messageTimestamps, 60000) // 1 minute

    // Check rate limits
    const recentMessages = this.cleanOldTimestamps(userData.messageTimestamps, 5000) // 5 seconds
    const lastMessage = userData.messageTimestamps[userData.messageTimestamps.length - 1]

    // Too many messages in 5 seconds
    if (recentMessages.length >= this.MAX_MESSAGES_PER_5_SECONDS) {
      this.applyPenalty(userId, "Rate limit exceeded (5 seconds)")
      return {
        allowed: false,
        reason: "You are sending messages too quickly. Please slow down.",
      }
    }

    // Too many messages in 1 minute
    if (userData.messageTimestamps.length >= this.MAX_MESSAGES_PER_MINUTE) {
      this.applyPenalty(userId, "Rate limit exceeded (1 minute)")
      return {
        allowed: false,
        reason: "You have sent too many messages. Please wait a moment.",
      }
    }

    // Minimum interval between messages
    if (lastMessage && now - lastMessage < this.MIN_MESSAGE_INTERVAL) {
      return {
        allowed: false,
        reason: "Please wait a moment before sending another message.",
      }
    }

    // Check for duplicate messages
    const normalizedContent = this.normalizeMessage(content)
    const duplicateCount = userData.lastMessages.filter(
      (msg) => this.normalizeMessage(msg) === normalizedContent,
    ).length

    if (duplicateCount >= this.DUPLICATE_MESSAGE_THRESHOLD) {
      this.applyPenalty(userId, "Duplicate message spam")
      return {
        allowed: false,
        reason: "Please avoid sending the same message repeatedly.",
      }
    }

    return { allowed: true }
  }

  recordMessage(userId: string, content: string) {
    const userData = this.getUserData(userId)
    const now = Date.now()

    // Add timestamp
    userData.messageTimestamps.push(now)

    // Keep only recent messages for duplicate detection
    userData.lastMessages.push(content)
    if (userData.lastMessages.length > 10) {
      userData.lastMessages.shift()
    }

    // Clean old timestamps periodically
    if (userData.messageTimestamps.length > 20) {
      userData.messageTimestamps = this.cleanOldTimestamps(userData.messageTimestamps, 60000)
    }
  }

  private applyPenalty(userId: string, reason: string) {
    const userData = this.getUserData(userId)
    userData.warningCount++

    // Progressive penalties
    let cooldownDuration = this.COOLDOWN_DURATION
    if (userData.warningCount > 3) {
      cooldownDuration *= 2 // 1 minute
    }
    if (userData.warningCount > 5) {
      cooldownDuration *= 3 // 3 minutes
    }

    userData.cooldownUntil = Date.now() + cooldownDuration

    console.log(`Applied penalty to user ${userId}: ${reason}. Cooldown: ${cooldownDuration}ms`)
  }

  getCooldownRemaining(userId: string): number {
    const userData = this.userData.get(userId)
    if (!userData?.cooldownUntil) return 0

    const remaining = userData.cooldownUntil - Date.now()
    return Math.max(0, remaining)
  }

  // Clean up old user data periodically
  cleanup() {
    const now = Date.now()
    const maxAge = 300000 // 5 minutes

    for (const [userId, userData] of this.userData.entries()) {
      const hasRecentActivity = userData.messageTimestamps.some((timestamp) => now - timestamp < maxAge)

      if (!hasRecentActivity && (!userData.cooldownUntil || now > userData.cooldownUntil)) {
        this.userData.delete(userId)
      }
    }
  }
}

export const spamPreventionService = new SpamPreventionService()

// Clean up every 5 minutes
setInterval(() => {
  spamPreventionService.cleanup()
}, 300000)
