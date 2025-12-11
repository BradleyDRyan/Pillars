import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, type UserTrigger, type TriggerTemplate, type NudgeHistoryItem, type User } from '@/services/api'
import { formatRelativeTime, formatDate } from '@/lib/utils'
import { ArrowLeft, Plus, Clock, Bell, BellOff, Trash2, History } from 'lucide-react'

export function UserTriggers() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [triggers, setTriggers] = useState<UserTrigger[]>([])
  const [templates, setTemplates] = useState<TriggerTemplate[]>([])
  const [history, setHistory] = useState<NudgeHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (userId) {
      loadData(userId)
    }
  }, [userId])

  async function loadData(id: string) {
    try {
      const [userData, triggersData, templatesData, historyData] = await Promise.all([
        api.getUser(id),
        api.getUserTriggers(id),
        api.getTriggerTemplates(),
        api.getUserNudgeHistory(id)
      ])
      setUser(userData)
      setTriggers(triggersData)
      setTemplates(templatesData)
      setHistory(historyData)
    } catch (error) {
      console.error('Failed to load data:', error)
      // Mock data for development
      setUser({
        id,
        displayName: 'Test User',
        phone: '+1234567890'
      })
      setTriggers([])
      setTemplates([
        {
          id: 'morning-checkin',
          name: 'Morning Check-in',
          description: 'Daily morning motivation',
          type: 'schedule',
          defaultCron: '0 9 * * *',
          defaultTimezone: 'user',
          enabled: true
        },
        {
          id: 'evening-reflection',
          name: 'Evening Reflection',
          description: 'End of day reflection',
          type: 'schedule',
          defaultCron: '0 20 * * *',
          defaultTimezone: 'user',
          enabled: true
        }
      ])
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  async function handleAddTrigger(templateId: string) {
    if (!userId) return
    try {
      const newTrigger = await api.createUserTrigger(userId, { templateId, enabled: true })
      setTriggers([...triggers, newTrigger])
    } catch (error) {
      console.error('Failed to add trigger:', error)
    }
  }

  async function handleToggleTrigger(trigger: UserTrigger) {
    if (!userId) return
    try {
      const updated = await api.updateUserTrigger(userId, trigger.id, { enabled: !trigger.enabled })
      setTriggers(triggers.map(t => t.id === trigger.id ? updated : t))
    } catch (error) {
      console.error('Failed to toggle trigger:', error)
    }
  }

  async function handleDeleteTrigger(triggerId: string) {
    if (!userId || !confirm('Delete this trigger?')) return
    try {
      await api.deleteUserTrigger(userId, triggerId)
      setTriggers(triggers.filter(t => t.id !== triggerId))
    } catch (error) {
      console.error('Failed to delete trigger:', error)
    }
  }

  function getTemplateName(templateId?: string): string {
    const template = templates.find(t => t.id === templateId)
    return template?.name || 'Custom Trigger'
  }

  function formatCron(cron: string): string {
    // Simple cron to human-readable conversion
    const parts = cron.split(' ')
    if (parts.length !== 5) return cron
    
    const [minute, hour, , , dayOfWeek] = parts
    const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
    
    if (dayOfWeek === '*') return `Daily at ${time}`
    if (dayOfWeek === '0') return `Sundays at ${time}`
    if (dayOfWeek === '1') return `Mondays at ${time}`
    
    return `${time} (${cron})`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  const availableTemplates = templates.filter(
    t => !triggers.some(trigger => trigger.templateId === t.id)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/users')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {user?.displayName || 'User'}'s Triggers
          </h1>
          <p className="text-sm text-muted-foreground">
            {user?.phone || userId}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowHistory(!showHistory)}
        >
          <History className="h-4 w-4 mr-2" />
          {showHistory ? 'Hide History' : 'Show History'}
        </Button>
      </div>

      {/* Active Triggers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Active Triggers</CardTitle>
        </CardHeader>
        <CardContent>
          {triggers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No triggers configured for this user
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Next Fire</TableHead>
                  <TableHead>Last Fired</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {triggers.map(trigger => (
                  <TableRow key={trigger.id}>
                    <TableCell>
                      <div className="font-medium">{getTemplateName(trigger.templateId)}</div>
                      <div className="text-sm text-muted-foreground">{trigger.timezone}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {formatCron(trigger.cron)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {trigger.nextFireAt ? formatRelativeTime(trigger.nextFireAt) : '-'}
                    </TableCell>
                    <TableCell>
                      {trigger.lastFiredAt ? formatRelativeTime(trigger.lastFiredAt) : 'Never'}
                      {trigger.fireCount > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({trigger.fireCount}x)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={trigger.enabled ? 'default' : 'secondary'}>
                        {trigger.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleTrigger(trigger)}
                        >
                          {trigger.enabled ? (
                            <BellOff className="h-4 w-4" />
                          ) : (
                            <Bell className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTrigger(trigger.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Trigger */}
      {availableTemplates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Add Trigger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availableTemplates.map(template => (
                <div
                  key={template.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{template.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Default: {formatCron(template.defaultCron)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddTrigger(template.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nudge History */}
      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle>Nudge History</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No nudges sent yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Content</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="max-w-md truncate">{item.content}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.channel}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'delivered' ? 'default' : 'destructive'}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(item.sentAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
