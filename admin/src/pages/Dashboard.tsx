import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, MessageSquare, MessagesSquare, Activity } from 'lucide-react'
import { api, type DashboardStats } from '@/services/api'

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const data = await api.getStats()
      setStats(data)
    } catch (error) {
      console.error('Failed to load stats:', error)
      // Use mock data for now
      setStats({
        totalUsers: 0,
        totalConversations: 0,
        totalMessages: 0,
        activeToday: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      title: 'Conversations',
      value: stats?.totalConversations ?? 0,
      icon: MessagesSquare,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
    {
      title: 'Messages',
      value: stats?.totalMessages ?? 0,
      icon: MessageSquare,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      title: 'Active Today',
      value: stats?.activeToday ?? 0,
      icon: Activity,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your Pillars app</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Activity feed coming soon...
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground text-sm">
              • View all users
            </p>
            <p className="text-muted-foreground text-sm">
              • Browse conversations
            </p>
            <p className="text-muted-foreground text-sm">
              • Check SMS status
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
