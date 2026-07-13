import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Metric accent slots mapped onto the SI brand ramp (theme-aware chart tokens).
// Key names are opaque slots kept stable for existing call sites.
const colorMap = {
  indigo: 'bg-[var(--chart-2)]/15 text-[var(--chart-2)]', // sky
  violet: 'bg-[var(--chart-3)]/15 text-[var(--chart-3)]', // navy
  emerald: 'bg-primary/10 text-primary', // coral (hero)
  amber: 'bg-[var(--chart-4)]/15 text-[var(--chart-4)]', // slate
}

interface MetricCardProps {
  title: string
  value: string | number
  sub: string
  icon: LucideIcon
  color: keyof typeof colorMap
}

export function DashboardMetricCard({ title, value, sub, icon: Icon, color }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
          <div className={cn('p-2 rounded-lg', colorMap[color])}>
            <Icon size={18} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
