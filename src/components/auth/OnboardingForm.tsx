'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export function OnboardingForm() {
  const [orgName, setOrgName] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/auth/complete-onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_name: orgName, full_name: fullName || undefined }),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error?.message ?? 'Failed to set up workspace')
      setLoading(false)
      return
    }

    window.location.href = '/dashboard'
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="pt-6 space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Your name</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Jane Smith"
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org_name">Workspace name</Label>
            <Input
              id="org_name"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder="Acme Corp"
              required
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !orgName.trim()}>
            {loading ? 'Setting up…' : 'Create workspace'}
          </Button>
        </CardContent>
      </form>
    </Card>
  )
}
