import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, type Message, type Conversation } from '@/services/api'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Phone, Smartphone, User, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ConversationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadConversation(id)
    }
  }, [id])

  async function loadConversation(conversationId: string) {
    try {
      const data = await api.getConversation(conversationId)
      setConversation(data)
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Failed to load conversation:', error)
      // Mock data
      setConversation({
        id: conversationId,
        userId: 'user1',
        title: 'SMS Chat',
        metadata: { channel: 'sms' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      setMessages([
        {
          id: '1',
          conversationId,
          userId: 'user1',
          content: 'Hey! What habits should I focus on?',
          role: 'user',
          createdAt: new Date(Date.now() - 300000).toISOString(),
        },
        {
          id: '2',
          conversationId,
          userId: 'user1',
          content: "Great question! Let's start with what matters most to you. What area of your life do you want to improve? Health, productivity, relationships, or something else?",
          role: 'assistant',
          createdAt: new Date(Date.now() - 240000).toISOString(),
        },
        {
          id: '3',
          conversationId,
          userId: 'user1',
          content: 'Productivity for sure. I feel like I waste too much time.',
          role: 'user',
          createdAt: new Date(Date.now() - 180000).toISOString(),
        },
        {
          id: '4',
          conversationId,
          userId: 'user1',
          content: "I hear you. One powerful habit: time-blocking. Start with just your morning - block 2 hours for your most important work before checking email. Want to try it tomorrow?",
          role: 'assistant',
          createdAt: new Date(Date.now() - 120000).toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Conversation not found</p>
        <Button variant="ghost" onClick={() => navigate('/conversations')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Conversations
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/conversations')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{conversation.title}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge
              variant={conversation.metadata?.channel === 'sms' ? 'secondary' : 'default'}
              className="flex items-center gap-1"
            >
              {conversation.metadata?.channel === 'sms' ? (
                <Phone className="h-3 w-3" />
              ) : (
                <Smartphone className="h-3 w-3" />
              )}
              {conversation.metadata?.channel || 'app'}
            </Badge>
            <span>•</span>
            <span>{messages.length} messages</span>
            <span>•</span>
            <span>Started {formatDate(conversation.createdAt)}</span>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'
                )}
              >
                <div
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                    message.role === 'assistant'
                      ? 'bg-purple-100 text-purple-600'
                      : 'bg-blue-100 text-blue-600'
                  )}
                >
                  {message.role === 'assistant' ? (
                    <Bot className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={cn(
                    'flex-1 max-w-[80%]',
                    message.role === 'assistant' ? 'text-left' : 'text-right'
                  )}
                >
                  <div
                    className={cn(
                      'inline-block px-4 py-2 rounded-2xl',
                      message.role === 'assistant'
                        ? 'bg-gray-100 text-gray-900 rounded-tl-sm'
                        : 'bg-blue-600 text-white rounded-tr-sm'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(message.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">No messages yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
