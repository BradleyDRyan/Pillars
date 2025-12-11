const API_BASE = import.meta.env.VITE_API_URL || 'https://pillars-rho.vercel.app'

interface User {
  id: string
  phone?: string
  email?: string
  displayName?: string
  source?: string
  createdAt?: string
  lastActive?: string
}

interface Conversation {
  id: string
  userId: string
  title: string
  lastMessage?: string
  messageCount?: number
  metadata?: {
    channel?: string
  }
  createdAt: string
  updatedAt: string
}

interface Message {
  id: string
  conversationId: string
  userId: string
  content: string
  role: 'user' | 'assistant'
  createdAt: string
}

interface DashboardStats {
  totalUsers: number
  totalConversations: number
  totalMessages: number
  activeToday: number
}

interface TriggerTemplate {
  id: string
  name: string
  description: string
  type: 'schedule' | 'condition' | 'event'
  defaultCron: string
  defaultTimezone: string
  messageTemplate?: string
  enabled: boolean
}

interface UserTrigger {
  id: string
  templateId?: string
  enabled: boolean
  cron: string
  timezone: string
  nextFireAt?: string
  lastFiredAt?: string
  fireCount: number
  createdAt: string
}

interface NudgeHistoryItem {
  id: string
  userId: string
  triggerId: string
  templateId?: string
  content: string
  channel: string
  status: 'delivered' | 'failed'
  error?: string
  sentAt: string
}

class AdminAPI {
  private adminToken: string | null = null

  setToken(token: string) {
    this.adminToken = token
    localStorage.setItem('adminToken', token)
  }

  getToken(): string | null {
    if (!this.adminToken) {
      this.adminToken = localStorage.getItem('adminToken')
    }
    return this.adminToken
  }

  clearToken() {
    this.adminToken = null
    localStorage.removeItem('adminToken')
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken()
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Dashboard
  async getStats(): Promise<DashboardStats> {
    return this.fetch('/api/admin/stats')
  }

  // Users
  async getUsers(limit = 50, offset = 0): Promise<User[]> {
    return this.fetch(`/api/admin/users?limit=${limit}&offset=${offset}`)
  }

  async getUser(id: string): Promise<User> {
    return this.fetch(`/api/admin/users/${id}`)
  }

  // Conversations
  async getConversations(limit = 50, offset = 0): Promise<Conversation[]> {
    return this.fetch(`/api/admin/conversations?limit=${limit}&offset=${offset}`)
  }

  async getConversation(id: string): Promise<Conversation & { messages: Message[] }> {
    return this.fetch(`/api/admin/conversations/${id}`)
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    return this.fetch(`/api/admin/users/${userId}/conversations`)
  }

  // Messages
  async getMessages(conversationId: string): Promise<Message[]> {
    return this.fetch(`/api/admin/conversations/${conversationId}/messages`)
  }

  // Trigger Templates
  async getTriggerTemplates(): Promise<TriggerTemplate[]> {
    return this.fetch('/api/admin/trigger-templates')
  }

  // User Triggers
  async getUserTriggers(userId: string): Promise<UserTrigger[]> {
    return this.fetch(`/api/admin/users/${userId}/triggers`)
  }

  async createUserTrigger(userId: string, data: Partial<UserTrigger>): Promise<UserTrigger> {
    return this.fetch(`/api/admin/users/${userId}/triggers`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateUserTrigger(userId: string, triggerId: string, data: Partial<UserTrigger>): Promise<UserTrigger> {
    return this.fetch(`/api/admin/users/${userId}/triggers/${triggerId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteUserTrigger(userId: string, triggerId: string): Promise<void> {
    await this.fetch(`/api/admin/users/${userId}/triggers/${triggerId}`, {
      method: 'DELETE'
    })
  }

  // Nudge History
  async getUserNudgeHistory(userId: string, limit = 50): Promise<NudgeHistoryItem[]> {
    return this.fetch(`/api/admin/users/${userId}/nudge-history?limit=${limit}`)
  }
}

export const api = new AdminAPI()
export type { User, Conversation, Message, DashboardStats, TriggerTemplate, UserTrigger, NudgeHistoryItem }
