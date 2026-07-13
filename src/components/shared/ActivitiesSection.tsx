'use client'

import { useState } from 'react'
import { Phone, Mail, Users, CheckSquare, Check, Plus, Calendar } from 'lucide-react'
import { formatDistanceToNow, isPast, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ActivityDialog } from '@/components/activities/ActivityDialog'
import type { Activity } from '@/types/crm'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  call: <Phone size={12} />,
  email: <Mail size={12} />,
  meeting: <Users size={12} />,
  task: <CheckSquare size={12} />,
}

interface ActivitiesSectionProps {
  initialActivities: Activity[]
  contactId?: string
  dealId?: string
}

export function ActivitiesSection({ initialActivities, contactId, dealId }: ActivitiesSectionProps) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function markDone(id: string) {
    const res = await fetch(`/api/activities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    })
    if (res.ok) {
      setActivities(prev => prev.map(a => a.id === id ? { ...a, status: 'done' } : a))
    }
  }

  function handleCreated(activity: Activity) {
    setActivities(prev => [activity, ...prev])
    setDialogOpen(false)
  }

  return (
    <div className="space-y-3">
      <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
        <Plus size={13} className="mr-1.5" />
        Log Activity
      </Button>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground text-sm">
          <Calendar size={18} className="opacity-40" />
          No activities yet
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map(activity => {
            const overdue = activity.status === 'planned' && activity.due_at && isPast(new Date(activity.due_at)) && !isToday(new Date(activity.due_at))
            const dueToday = activity.status === 'planned' && activity.due_at && isToday(new Date(activity.due_at))
            return (
              <div
                key={activity.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                  activity.status === 'done' ? 'border-border bg-muted/20 opacity-60' : 'border-border bg-card',
                  overdue && 'border-destructive/30 bg-destructive/5',
                  dueToday && 'border-amber-500/30 bg-amber-500/5'
                )}
              >
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                  'bg-muted text-muted-foreground',
                  activity.type === 'call' && 'bg-primary/10 text-primary',
                  activity.type === 'email' && 'bg-[var(--chart-2)]/15 text-[var(--chart-2)]',
                  activity.type === 'meeting' && 'bg-[var(--chart-3)]/15 text-[var(--chart-3)]',
                  activity.type === 'task' && 'bg-[var(--chart-4)]/15 text-[var(--chart-4)]',
                )}>
                  {TYPE_ICONS[activity.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', activity.status === 'done' && 'line-through')}>{activity.subject}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-xs py-0 capitalize">{activity.type}</Badge>
                    {activity.due_at && (
                      <span className={cn('text-xs text-muted-foreground', overdue && 'text-destructive', dueToday && 'text-amber-400')}>
                        {overdue ? 'Overdue · ' : dueToday ? 'Today · ' : ''}
                        {formatDistanceToNow(new Date(activity.due_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
                {activity.status !== 'done' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 h-7 w-7 p-0 text-muted-foreground hover:text-emerald-400"
                    onClick={() => markDone(activity.id)}
                  >
                    <Check size={14} />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ActivityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
        contactId={contactId}
        dealId={dealId}
      />
    </div>
  )
}
