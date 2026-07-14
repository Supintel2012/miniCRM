'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, DollarSign, Calendar, User, Building2, Edit2, Save, X, Trash2, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NotesSection } from '@/components/shared/NotesSection'
import { ActivitiesSection } from '@/components/shared/ActivitiesSection'
import { RrtModelRunner } from '@/components/shared/RrtModelRunner'
import type { Deal, PipelineStage, Activity, Note } from '@/types/crm'

interface DealDetailViewProps {
  deal: Deal & {
    activities?: Activity[]
    notes?: Note[]
  }
  stages: PipelineStage[]
  contacts: Array<{ id: string; first_name: string; last_name: string | null }>
  companies: Array<{ id: string; name: string }>
}

export function DealDetailView({ deal: initial, stages, contacts, companies }: DealDetailViewProps) {
  const router = useRouter()
  const [deal, setDeal] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{
    title: string; value: string; currency: string; stage_id: string;
    contact_id: string | null; company_id: string | null;
    expected_close: string; probability: string
  }>({
    title: initial.title,
    value: initial.value?.toString() ?? '',
    currency: initial.currency,
    stage_id: initial.stage_id,
    contact_id: initial.contact_id ?? null,
    company_id: initial.company_id ?? null,
    expected_close: initial.expected_close ? initial.expected_close.split('T')[0] : '',
    probability: initial.probability?.toString() ?? '',
  })

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        value: form.value ? Number(form.value) : null,
        currency: form.currency,
        stage_id: form.stage_id,
        contact_id: form.contact_id || null,
        company_id: form.company_id || null,
        expected_close: form.expected_close || null,
        probability: form.probability ? Number(form.probability) : null,
      }),
    })
    if (res.ok) {
      const json = await res.json()
      setDeal(prev => ({ ...prev, ...json.data }))
      setEditing(false)
      toast.success('Deal updated')
    } else {
      toast.error('Failed to save')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this deal? This cannot be undone.')) return
    const res = await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Deal deleted')
      router.push('/deals')
    } else {
      toast.error('Failed to delete')
    }
  }

  async function handleStageMove(stageId: string) {
    const res = await fetch(`/api/deals/${deal.id}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: stageId }),
    })
    if (res.ok) {
      const newStage = stages.find(s => s.id === stageId)
      setDeal(prev => ({ ...prev, stage_id: stageId, stage: newStage }))
      setForm(p => ({ ...p, stage_id: stageId }))
      toast.success(`Moved to ${newStage?.name}`)
    }
  }

  const currentStageIndex = stages.findIndex(s => s.id === deal.stage_id)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <Link href="/deals" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Deals
        </Link>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}><X size={13} className="mr-1" />Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}><Save size={13} className="mr-1" />{saving ? 'Saving…' : 'Save'}</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Edit2 size={13} className="mr-1" />Edit</Button>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={handleDelete}>
                <Trash2 size={13} />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">{deal.title}</h1>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {deal.value && (
            <div className="flex items-center gap-1 text-emerald-400 font-medium">
              <DollarSign size={15} />{deal.value.toLocaleString()} {deal.currency}
            </div>
          )}
          {deal.expected_close && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar size={13} />{format(new Date(deal.expected_close), 'MMM d, yyyy')}
            </div>
          )}
          {deal.probability != null && (
            <Badge variant="secondary">{deal.probability}% probability</Badge>
          )}
        </div>
      </div>

      {/* Stage pipeline bar */}
      <div className="rounded-lg border border-border p-4">
        <h3 className="text-xs font-medium text-muted-foreground mb-3">Pipeline Stage</h3>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {stages.map((stage, i) => {
            const isCurrent = stage.id === deal.stage_id
            const isPassed = i < currentStageIndex
            return (
              <div key={stage.id} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => !isCurrent && handleStageMove(stage.id)}
                  disabled={isCurrent}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    isCurrent ? 'cursor-default' : 'hover:opacity-80 cursor-pointer',
                    isCurrent || isPassed ? 'opacity-100' : 'opacity-40',
                  )}
                  style={isCurrent ? { background: stage.color + '33', color: stage.color, border: `1px solid ${stage.color}66` }
                    : isPassed ? { background: stage.color + '15', color: stage.color }
                    : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }
                  }
                >
                  {stage.name}
                </button>
                {i < stages.length - 1 && <ChevronRight size={12} className="text-muted-foreground/40 shrink-0" />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info panel */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4 space-y-4">
            <h3 className="text-sm font-medium">Deal Info</h3>
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1"><Label className="text-xs">Title</Label>
                  <Input className="h-8 text-sm" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Value</Label>
                    <Input className="h-8 text-sm" type="number" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} />
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Currency</Label>
                    <Input className="h-8 text-sm" value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Stage</Label>
                  <Select value={form.stage_id} onValueChange={v => setForm(p => ({ ...p, stage_id: v ?? p.stage_id }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Contact</Label>
                  <Select value={form.contact_id} onValueChange={v => setForm(p => ({ ...p, contact_id: v === 'none' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Company</Label>
                  <Select value={form.company_id} onValueChange={v => setForm(p => ({ ...p, company_id: v === 'none' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Expected close</Label>
                  <Input className="h-8 text-sm" type="date" value={form.expected_close} onChange={e => setForm(p => ({ ...p, expected_close: e.target.value }))} />
                </div>
                <div className="space-y-1"><Label className="text-xs">Probability (%)</Label>
                  <Input className="h-8 text-sm" type="number" min="0" max="100" value={form.probability} onChange={e => setForm(p => ({ ...p, probability: e.target.value }))} />
                </div>
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                {deal.contact && (
                  <div className="flex items-center gap-2">
                    <User size={13} className="text-muted-foreground shrink-0" />
                    <Link href={`/contacts/${deal.contact_id}`} className="text-primary hover:underline">
                      {deal.contact.first_name} {deal.contact.last_name}
                    </Link>
                  </div>
                )}
                {deal.company && (
                  <div className="flex items-center gap-2">
                    <Building2 size={13} className="text-muted-foreground shrink-0" />
                    <Link href={`/companies/${deal.company_id}`} className="text-primary hover:underline">{deal.company.name}</Link>
                  </div>
                )}
                {deal.stage && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: deal.stage.color + '22', color: deal.stage.color }}>
                      {deal.stage.name}
                    </span>
                    {deal.stage.is_won && <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">Won</Badge>}
                    {deal.stage.is_lost && <Badge className="bg-destructive/20 text-destructive border-0 text-xs">Lost</Badge>}
                  </div>
                )}
                {!deal.contact && !deal.company && (
                  <p className="text-muted-foreground text-xs">No associations yet — click Edit to add</p>
                )}
              </dl>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="activities">
            <TabsList className="mb-4">
              <TabsTrigger value="activities">Activities {deal.activities?.length ? `(${deal.activities.length})` : ''}</TabsTrigger>
              <TabsTrigger value="notes">Notes {deal.notes?.length ? `(${deal.notes.length})` : ''}</TabsTrigger>
              <TabsTrigger value="models">Decision Models</TabsTrigger>
            </TabsList>
            <TabsContent value="activities">
              <ActivitiesSection initialActivities={deal.activities ?? []} dealId={deal.id} />
            </TabsContent>
            <TabsContent value="notes">
              <NotesSection initialNotes={deal.notes ?? []} dealId={deal.id} />
            </TabsContent>
            <TabsContent value="models">
              <RrtModelRunner entityType="deal" entityId={deal.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
