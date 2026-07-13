import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Phone, Mail, Video, CheckSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Activity } from '@/types/crm'

const typeIcon = { call: Phone, email: Mail, meeting: Video, task: CheckSquare }
const typeBadge = {
  call: 'bg-primary/10 text-primary', // coral
  email: 'bg-[var(--chart-2)]/15 text-[var(--chart-2)]', // sky
  meeting: 'bg-[var(--chart-3)]/15 text-[var(--chart-3)]', // navy
  task: 'bg-[var(--chart-4)]/15 text-[var(--chart-4)]', // slate
}

export function RecentActivities({ activities }: { activities: Activity[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Recent Activities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No activities yet</p>
        )}
        {activities.slice(0, 6).map(activity => {
          const Icon = typeIcon[activity.type]
          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div className={`p-1.5 rounded-md shrink-0 ${typeBadge[activity.type]}`}>
                <Icon size={12} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">{activity.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
