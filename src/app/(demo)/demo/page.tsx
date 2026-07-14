import { DashboardMetricCard } from '@/components/dashboard/MetricCard'
import { PipelineChart } from '@/components/dashboard/PipelineChart'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { Users, TrendingUp, DollarSign, CalendarCheck } from 'lucide-react'
import { DEMO_METRICS, DEMO_ACTIVITIES } from '@/lib/demo-data'

export default function DemoDashboardPage() {
  const metrics = DEMO_METRICS

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Good morning, Demo. Here&apos;s what&apos;s happening.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardMetricCard
          title="Total Contacts"
          value={metrics.total_contacts}
          sub={`+${metrics.new_contacts_30d} this month`}
          icon={Users}
          accent="neutral"
        />
        <DashboardMetricCard
          title="Active Deals"
          value={metrics.total_deals}
          sub="in pipeline"
          icon={TrendingUp}
          accent="neutral"
        />
        <DashboardMetricCard
          title="Pipeline Value"
          value={`$${(metrics.total_pipeline_value / 1000).toFixed(0)}k`}
          sub={`$${(metrics.won_value_30d / 1000).toFixed(0)}k won this month`}
          icon={DollarSign}
          accent="primary"
        />
        <DashboardMetricCard
          title="Due Today"
          value={metrics.activities_due_today}
          sub="activities"
          icon={CalendarCheck}
          accent="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PipelineChart data={metrics.deals_by_stage} />
        </div>
        <div>
          <RecentActivities activities={DEMO_ACTIVITIES} />
        </div>
      </div>
    </div>
  )
}
