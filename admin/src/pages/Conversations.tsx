import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, type Conversation } from '@/services/api'
import { formatRelativeTime } from '@/lib/utils'
import { MessageSquare, Phone, Smartphone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadConversations()
  }, [])

  async function loadConversations() {
    try {
      const data = await api.getConversations()
      setConversations(data)
    } catch (error) {
      console.error('Failed to load conversations:', error)
      // Mock data
      setConversations([
        {
          id: '1',
          userId: 'user1',
          title: 'SMS Chat',
          lastMessage: 'Hey, how can I help you today?',
          messageCount: 5,
          metadata: { channel: 'sms' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          userId: 'user1',
          title: 'Career Goals',
          lastMessage: "Let's break down your goals...",
          messageCount: 12,
          metadata: { channel: 'app' },
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Conversations</h1>
          <p className="text-muted-foreground">{conversations.length} total conversations</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Last Message</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversations.map((convo) => (
                <TableRow key={convo.id}>
                  <TableCell>
                    <div className="font-medium">{convo.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {convo.userId.slice(0, 8)}...
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={convo.metadata?.channel === 'sms' ? 'secondary' : 'default'}
                      className="flex items-center gap-1 w-fit"
                    >
                      {convo.metadata?.channel === 'sms' ? (
                        <Phone className="h-3 w-3" />
                      ) : (
                        <Smartphone className="h-3 w-3" />
                      )}
                      {convo.metadata?.channel || 'app'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {convo.lastMessage || 'No messages'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      {convo.messageCount || 0}
                    </div>
                  </TableCell>
                  <TableCell>{formatRelativeTime(convo.updatedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/conversations/${convo.id}`)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {conversations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No conversations yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
