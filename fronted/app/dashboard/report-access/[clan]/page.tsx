'use client'

import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { clanLabel } from '@/lib/clans'
import { ArrowLeft, Lock, Unlock, ShieldCheck } from 'lucide-react'

interface MemberAccess {
  id: number
  username: string
  fullName: string | null
  role: string
  enabled: boolean
}

export default function ReportAccessClanPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const clan = params?.clan as string

  const [members, setMembers] = useState<MemberAccess[] | null>(null)
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState('')

  const isSuperAdmin = user?.username === 'chicolinas'

  useEffect(() => {
    if (!loading && (!user || !isSuperAdmin)) {
      router.push('/dashboard')
    }
  }, [user, loading, isSuperAdmin, router])

  const fetchMembers = () => {
    fetch(`/api/report-access/${clan}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setMembers(result.data)
        else setError(result.error || 'No se pudo cargar la lista')
      })
      .catch(() => setError('Error cargando los integrantes'))
  }

  useEffect(() => {
    if (isSuperAdmin && clan) fetchMembers()
  }, [isSuperAdmin, clan])

  const toggle = async (member: MemberAccess) => {
    setSaving(member.id)
    setError('')
    try {
      const response = await fetch(`/api/report-access/member/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !member.enabled }),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      setMembers((prev) => prev?.map((m) => (m.id === member.id ? { ...m, enabled: result.data.enabled } : m)) ?? prev)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando el acceso')
    } finally {
      setSaving(null)
    }
  }

  if (loading || !user || !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-primary">Acceso a Reportes · {clanLabel(clan)}</h1>
              <p className="text-sm text-muted-foreground">Habilita o bloquea el acceso integrante por integrante</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-4">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">
            {error}
          </div>
        )}

        {!members ? (
          <div className="grid grid-cols-1 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-card/50 border border-border/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3">
                  {m.enabled ? (
                    <Unlock className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {m.fullName ?? m.username}
                      {m.role === 'captain' && (
                        <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                          Capitán
                        </Badge>
                      )}
                    </p>
                    <p className={`text-xs ${m.enabled ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {m.enabled ? 'Habilitado' : 'Bloqueado'}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving === m.id}
                  onClick={() => toggle(m)}
                  className={m.enabled ? 'border-destructive/40 hover:bg-destructive/10' : 'border-primary/40 hover:bg-primary/10'}
                >
                  {saving === m.id ? '...' : m.enabled ? 'Bloquear' : 'Habilitar'}
                </Button>
              </div>
            ))}
          </Card>
        )}
      </main>
    </div>
  )
}
