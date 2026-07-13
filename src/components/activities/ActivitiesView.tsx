'use client'

import { useState } from 'react'
import { Plus, Phone, Mail, Video, CheckSquare, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ActivityDialog } from './ActivityDialog'
import { cn } from '@/lib/utils'
import { format, isToday, isPast } from 'date-fns'
import type { Activity } from '@/types/crm'

const typeConfig = {
  call:    { icon: Phone,       label: 'Call',    className: 'bg-primary/10 text-primary' },
  email:   { icon: Mail,        label: 'Email',   className: 'bg-[var(--chart-2)]/15 text-[var(--chart-2)]' },
  meeting: { icon: Video,       label: 'Meeting', className: 'bg-[var(--chart-3)]/15 text-[var(--chart-3)]' },
  task:    { icon: CheckSquare, label: 'Task',    className: 'bg-[var(--chart-4)]/15 text-[var(--chart-4)]' },
}

export function ActivitiesView({ initialData }: { initialData: Activity[] }) {
  const [activities, setActivities] = useState(initialData)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function markDone(id: string) {
    const res = await fetch(`/api/activities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done', done_at: new Date().toISOString() }),
    })
    if (res.ok) {
      const json = await res.json()
      setActivities(prev => prev.map(a => a.id === id ? json.data : a))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus size={14} className="mr-1.5" />Log Activity
        </Button>
      </div>

      <div className="space-y-2">
        {activities.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No activities yet</div>
        )}
        {activities.map(activity => {
          const cfg = typeConfig[activity.type]
          const Icon = cfg.icon
          const overdue = activity.due_at && isPast(new Date(activity.due_at)) && activity.status === 'planned'
          const dueToday = activity.due_at && isToday(new Date(activity.due_at))

          return (
            <div key={activity.id} className={cn(
              'flex items-center gap-4 p-4 rounded-lg border border-border bg-card transition-opacity',
              activity.status === 'done' && 'opacity-50'
            )}>
              <div className={cn('p-2 rounded-lg shrink-0', cfg.className)}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={cn('text-sm font-medium', activity.status === 'done' && 'line-through text-muted-foreground')}>
                    {activity.subject}
                  </p>
                  {activity.contact && (
                    <span className="text-xs text-muted-foreground">
                      • {activity.contact.first_name} {activity.contact.last_name}
                    </span>
                  )}
                </div>
                {activity.due_at && (
                  <div className={cn('flex items-center gap-1 text-xs mt-0.5', overdue ? 'text-destructive' : dueToday ? 'text-amber-400' : 'text-muted-foreground')}>
                    <Clock size={10} />
                    {format(new Date(activity.due_at), 'MMM d, h:mm a')}
                    {overdue && ' — overdue'}
                    {dueToday && !overdue && ' — today'}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-xs hidden sm:flex">{cfg.label}</Badge>
                {activity.status === 'planned' && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => markDone(activity.id)}>
                    Done
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <ActivityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={a => { setActivities(p => [a, ...p]); setDialogOpen(false) }}
      />
    </div>
  )
}
