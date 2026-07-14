'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Radar, CheckCircle, Save, Copy, Check, ExternalLink } from 'lucide-react'

interface FlinttSettingsProps {
  canManage: boolean
  /** The org_id for constructing the webhook URL. */
  orgId: string
}

export function FlinttSettings({ canManage, orgId }: FlinttSettingsProps) {
  const [webhookToken, setWebhookToken] = useState('')
  const [savedToken, setSavedToken] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    const res = await fetch('/api/integrations/flintt/config')
    const json = await res.json()
    if (res.ok && json.data?.has_token) {
      setSavedToken(json.data.webhook_token ?? null)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!webhookToken.trim()) return
    setSaving(true)
    const res = await fetch('/api/integrations/flintt/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhook_token: webhookToken.trim() }),
    })
    const json = await res.json()
    if (res.ok) {
      toast.success('Flintt webhook token saved')
      setSavedToken(webhookToken.trim())
      setWebhookToken('')
    } else {
      toast.error(json.error?.message ?? 'Failed to save')
    }
    setSaving(false)
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/integrations/flintt/webhook?org_id=${orgId}`
    : `https://minicrm-demo.vercel.app/api/integrations/flintt/webhook?org_id=${orgId}`

  function copyUrl() {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Radar size={18} className="text-primary" />
          <div>
            <CardTitle className="text-base">Flintt — Automated Outreach</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Receive prospect events from Flintt (app.sellable.dev) as new contacts in your CRM.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {savedToken && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle size={14} className="text-primary" />
            Webhook token configured
          </div>
        )}

        {/* Webhook URL */}
        <div className="space-y-1.5">
          <Label className="text-xs">Webhook URL</Label>
          <p className="text-xs text-muted-foreground">
            Paste this into Flintt → Webhooks → Create endpoint. Subscribe to{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">prospect.created</code> and{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">company.created</code>.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-muted/50 px-3 py-2 rounded border border-border truncate">
              {webhookUrl}
            </code>
            <Button size="sm" variant="outline" onClick={copyUrl} className="shrink-0">
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </Button>
          </div>
        </div>

        {/* Token configuration */}
        {canManage && (
          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Webhook auth token</Label>
              <Input
                className="h-9 text-sm font-mono"
                type="password"
                placeholder={savedToken ? '•••••••• (saved — enter new to replace)' : 'Paste the Bearer token from Flintt'}
                value={webhookToken}
                onChange={e => setWebhookToken(e.target.value)}
                required={!savedToken}
              />
              <p className="text-xs text-muted-foreground">
                When you create the webhook in Flintt, it returns a Bearer token once. Paste it here so miniCRM can verify incoming requests.
              </p>
            </div>
            <Button type="submit" size="sm" disabled={saving || !webhookToken.trim()}>
              <Save size={13} className="mr-1" />
              {saving ? 'Saving…' : 'Save token'}
            </Button>
          </form>
        )}

        {/* Event mapping info */}
        <div className="rounded-md bg-muted/40 p-3 space-y-1.5 text-xs">
          <p className="font-medium text-muted-foreground">Event mapping</p>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-mono py-0">prospect.created</Badge>
            <span className="text-muted-foreground">→</span>
            <span>New contact (source: flintt)</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-mono py-0">company.created</Badge>
            <span className="text-muted-foreground">→</span>
            <span>New company</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-mono py-0">signal.run.*</Badge>
            <span className="text-muted-foreground">→</span>
            <span>Activity logged on matched contact</span>
          </div>
        </div>

        <a
          href="https://app.sellable.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Open Flintt <ExternalLink size={11} />
        </a>
      </CardContent>
    </Card>
  )
}
