import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// SI design system accent treatments.
// "primary" → coral top-border accent (the highlighted metric, e.g. Pipeline Value)
// "neutral" → subtle slate icon chip (default for supporting metrics)
const accentMap = {
  primary: {
    card: 'border-t-2 border-t-primary',
    icon: 'bg-primary/10 text-primary',
  },
  neutral: {
    card: '',
    icon: 'bg-muted text-muted-foreground',
  },
}

interface MetricCardProps {
  title: string
  value: string | number
  sub: string
  icon: LucideIcon
  /** SI design accent — "primary" gets the coral top-border, "neutral" is the default. */
  accent?: keyof typeof accentMap
  /** Legacy prop name kept for callers that still pass `color`. Maps to accent. */
  color?: keyof typeof accentMap
}

export function DashboardMetricCard({ title, value, sub, icon: Icon, accent, color }: MetricCardProps) {
  const a = accent ?? color ?? 'neutral'
  return (
    <Card className={cn(accentMap[a].card)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
          <div className={cn('p-2 rounded-lg', accentMap[a].icon)}>
            <Icon size={18} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
