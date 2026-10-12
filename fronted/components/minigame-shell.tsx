'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Copy, Lock } from 'lucide-react'

// Estado + jugadas de un minijuego: carga GET /api/minigames/:game y manda
// las jugadas a POST /api/minigames/:game/move. statsKey cambia cuando la
// partida termina, para recargar las estadísticas.
export function useMinigame<T extends { finished?: boolean; empty?: boolean }>(game: string | undefined) {
  const { user } = useAuth()
  const [state, setState] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [statsKey, setStatsKey] = useState(0)

  useEffect(() => {
    if (!user || !game) return
    fetch(`/api/minigames/${game}`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setState(r.data)
        else setError(r.error || 'No se pudo cargar el juego')
      })
      .catch(() => setError('Error cargando el juego'))
  }, [user, game])

  const move = useCallback(
    async (body: unknown): Promise<T | null> => {
      if (!game) return null
      setBusy(true)
      setError('')
      try {
        const r = await (
          await fetch(`/api/minigames/${game}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        ).json()
        if (!r.success) {
          setError(r.error || 'No se pudo registrar la jugada')
          return null
        }
        setState(r.data)
        if (r.data?.finished) setStatsKey((k) => k + 1)
        return r.data as T
      } catch {
        setError('Error de conexión')
        return null
      } finally {
        setBusy(false)
      }
    },
    [game]
  )

  return { state, setState, error, setError, busy, move, statsKey }
}

export function MinigameShell({
  title,
  subtitle,
  right,
  error,
  children,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  error?: string
  children: ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard/minijuegos">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-primary truncate">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
            </div>
          </div>
          {right}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6 max-w-3xl">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm">{error}</div>
        )}
        {children}
      </main>
    </div>
  )
}

export function MinigameLoading() {
  return <div className="h-64 rounded-lg bg-card/50 border border-border/50 animate-pulse" />
}

export function MinigameEmpty({ message }: { message: string }) {
  return (
    <Card className="p-8 text-center space-y-2">
      <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
      <p className="font-semibold">Este juego todavía no tiene contenido</p>
      <p className="text-sm text-muted-foreground">{message}</p>
    </Card>
  )
}

// Botón que copia el resultado al portapapeles para compartirlo.
export function ShareButton({ text, onError }: { text: string; onError?: (msg: string) => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="outline"
      className="gap-2"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          onError?.('No se pudo copiar el resultado')
        }
      }}
    >
      <Copy className="w-4 h-4" /> {copied ? '¡Copiado!' : 'Compartir resultado'}
    </Button>
  )
}
