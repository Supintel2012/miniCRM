'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Phone, Building2, Briefcase, Edit2, Save, X, Trash2, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NotesSection } from '@/components/shared/NotesSection'
import { ActivitiesSection } from '@/components/shared/ActivitiesSection'
import { RrtModelRunner } from '@/components/shared/RrtModelRunner'
import type { Contact, Activity, Note } from '@/types/crm'

interface ContactDetailViewProps {
  contact: Contact & {
    deals?: Array<{ id: string; title: string; value: number | null; currency: string; stage: { id: string; name: string; color: string } | null }>
    activities?: Activity[]
    notes?: Note[]
  }
  companies: Array<{ id: string; name: string }>
}

export function ContactDetailView({ contact: initial, companies }: ContactDetailViewProps) {
  const router = useRouter()
  const [contact, setContact] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{
    first_name: string; last_name: string; email: string;
    phone: string; job_title: string; company_id: string | null
  }>({
    first_name: initial.first_name,
    last_name: initial.last_name ?? '',
    email: initial.email ?? '',
    phone: initial.phone ?? '',
    job_title: initial.job_title ?? '',
    company_id: initial.company_id ?? null,
  })

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: form.first_name,
        last_name: form.last_name || null,
        email: form.email || null,
        phone: form.phone || null,
        job_title: form.job_title || null,
        company_id: form.company_id || null,
      }),
    })
    if (res.ok) {
      const json = await res.json()
      setContact(prev => ({ ...prev, ...json.data }))
      setEditing(false)
      toast.success('Contact updated')
    } else {
      toast.error('Failed to save')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this contact? This cannot be undone.')) return
    const res = await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Contact deleted')
      router.push('/contacts')
    } else {
      toast.error('Failed to delete')
    }
  }

  function handleCancel() {
    setForm({
      first_name: contact.first_name,
      last_name: contact.last_name ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      job_title: contact.job_title ?? '',
      company_id: contact.company_id ?? null,
    })
    setEditing(false)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Link href="/contacts" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Contacts
        </Link>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="outline" onClick={handleCancel}><X size={13} className="mr-1" />Cancel</Button>
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
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-lg font-semibold text-primary">
            {contact.first_name[0]}{contact.last_name?.[0] ?? ''}
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{contact.first_name} {contact.last_name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {contact.job_title && <span className="text-muted-foreground text-sm">{contact.job_title}</span>}
            {contact.company?.name && (
              <Link href={`/companies/${contact.company_id}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
                <Building2 size={12} />{contact.company.name}
              </Link>
            )}
            <Badge variant="secondary" className="text-xs capitalize">{contact.source}</Badge>
            {contact.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-lg border border-border p-4 space-y-4">
            <h3 className="text-sm font-medium">Contact Info</h3>
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">First name</Label>
                    <Input className="h-8 text-sm" value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Last name</Label>
                    <Input className="h-8 text-sm" value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input className="h-8 text-sm" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input className="h-8 text-sm" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Job title</Label>
                  <Input className="h-8 text-sm" value={form.job_title} onChange={e => setForm(p => ({ ...p, job_title: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Company</Label>
                  <Select value={form.company_id} onValueChange={v => setForm(p => ({ ...p, company_id: v === 'none' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                {contact.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="text-muted-foreground shrink-0" />
                    <a href={`mailto:${contact.email}`} className="text-primary hover:underline truncate">{contact.email}</a>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-muted-foreground shrink-0" />
                    <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a>
                  </div>
                )}
                {contact.job_title && (
                  <div className="flex items-center gap-2">
                    <Briefcase size={13} className="text-muted-foreground shrink-0" />
                    <span>{contact.job_title}</span>
                  </div>
                )}
                {contact.company?.name && (
                  <div className="flex items-center gap-2">
                    <Building2 size={13} className="text-muted-foreground shrink-0" />
                    <Link href={`/companies/${contact.company_id}`} className="text-primary hover:underline">{contact.company.name}</Link>
                  </div>
                )}
                {!contact.email && !contact.phone && !contact.job_title && !contact.company?.name && (
                  <p className="text-muted-foreground text-xs">No details yet — click Edit to add</p>
                )}
              </dl>
            )}
          </div>

          {/* Deals */}
          {contact.deals && contact.deals.length > 0 && (
            <div className="rounded-lg border border-border p-4 space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-1.5"><TrendingUp size={13} /> Deals</h3>
              {contact.deals.map(deal => (
                <Link key={deal.id} href={`/deals/${deal.id}`} className="flex items-center justify-between group">
                  <span className="text-sm group-hover:text-primary transition-colors truncate">{deal.title}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {deal.value && <span className="text-xs text-emerald-400">${deal.value.toLocaleString()}</span>}
                    {deal.stage && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: deal.stage.color + '22', color: deal.stage.color }}>
                        {deal.stage.name}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tabs: Activities + Notes */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="activities">
            <TabsList className="mb-4">
              <TabsTrigger value="activities">Activities {contact.activities && contact.activities.length > 0 ? `(${contact.activities.length})` : ''}</TabsTrigger>
              <TabsTrigger value="notes">Notes {contact.notes && contact.notes.length > 0 ? `(${contact.notes.length})` : ''}</TabsTrigger>
              <TabsTrigger value="models">Decision Models</TabsTrigger>
            </TabsList>
            <TabsContent value="activities">
              <ActivitiesSection initialActivities={contact.activities ?? []} contactId={contact.id} />
            </TabsContent>
            <TabsContent value="notes">
              <NotesSection initialNotes={contact.notes ?? []} contactId={contact.id} />
            </TabsContent>
            <TabsContent value="models">
              <RrtModelRunner entityType="contact" entityId={contact.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
