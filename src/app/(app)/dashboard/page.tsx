import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardMetricCard } from '@/components/dashboard/MetricCard'
import { PipelineChart } from '@/components/dashboard/PipelineChart'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { Users, TrendingUp, DollarSign, CalendarCheck } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: metrics } = await supabase.rpc('get_dashboard_metrics', { p_org_id: profile.org_id })

  const { data: recentActivities } = await supabase
    .from('crm.activities')
    .select('*, contact:contacts(id,first_name,last_name), deal:deals(id,title)')
    .order('created_at', { ascending: false })
    .limit(8)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome back. Here&apos;s what&apos;s happening.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardMetricCard
          title="Total Contacts"
          value={metrics?.total_contacts ?? 0}
          sub={`+${metrics?.new_contacts_30d ?? 0} this month`}
          icon={Users}
          accent="neutral"
        />
        <DashboardMetricCard
          title="Active Deals"
          value={metrics?.total_deals ?? 0}
          sub="in pipeline"
          icon={TrendingUp}
          accent="neutral"
        />
        <DashboardMetricCard
          title="Pipeline Value"
          value={`$${((metrics?.total_pipeline_value ?? 0) / 1000).toFixed(1)}k`}
          sub={`$${((metrics?.won_value_30d ?? 0) / 1000).toFixed(1)}k won this month`}
          icon={DollarSign}
          accent="primary"
        />
        <DashboardMetricCard
          title="Due Today"
          value={metrics?.activities_due_today ?? 0}
          sub="activities"
          icon={CalendarCheck}
          accent="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PipelineChart data={metrics?.deals_by_stage ?? []} />
        </div>
        <div>
          <RecentActivities activities={recentActivities ?? []} />
        </div>
      </div>
    </div>
  )
}
