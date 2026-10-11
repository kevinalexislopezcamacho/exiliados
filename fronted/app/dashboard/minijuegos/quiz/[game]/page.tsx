'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MinigameStats, useCountdown } from '@/components/minigame-stats'
import { ArrowLeft, Check, ChevronRight, Copy, Lock, X } from 'lucide-react'

interface AnsweredQuestion {
  prompt: string
  options: string[]
  chosen: number
  correctIndex: number
  explanation?: string
}

interface GameInfo {
  id: string
  name: string
  description: string
}

type QuizState =
  | { day: string; empty: true; game: GameInfo }
  | {
      day: string
      empty: false
      game: GameInfo
      nextResetAt: string
      total: number
      winThreshold: number
      answered: AnsweredQuestion[]
      current: { index: number; prompt: string; options: string[] } | null
      score: number
      finished: boolean
      won: boolean
    }

export default function QuizGamePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams<{ game: string }>()
  const gameId = params.game
  const [state, setState] = useState<QuizState | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Después de responder se muestra la corrección hasta que toque "Siguiente".
  const [reveal, setReveal] = useState<AnsweredQuestion | null>(null)
  const [statsKey, setStatsKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const countdown = useCountdown(state && !state.empty ? state.nextResetAt : undefined)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user || !gameId) return
    fetch(`/api/minigames/${gameId}`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setState(r.data)
        else setError(r.error || 'No se pudo cargar el juego')
      })
      .catch(() => setError('Error cargando el juego'))
  }, [user, gameId])

  const answer = async (index: number) => {
    if (submitting || !state || state.empty) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/minigames/${gameId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: index }),
      })
      const r = await res.json()
      if (!r.success) {
        setError(r.error || 'No se pudo registrar la respuesta')
        return
      }
      const next = r.data as QuizState
      setState(next)
      if (!next.empty) {
        setReveal(next.answered[next.answered.length - 1] ?? null)
        if (next.finished) setStatsKey((k) => k + 1)
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  const handleShare = async () => {
    if (!state || state.empty) return
    const marks = state.answered.map((a) => (a.chosen === a.correctIndex ? '🟩' : '🟥')).join('')
    const text = `${state.game.name} · EXILIADOS ${state.day}\n${state.score}/${state.total}\n${marks}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('No se pudo copiar el resultado')
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const playing = state && !state.empty ? state : null
  const showingReveal = !!reveal && !!playing

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
              <h1 className="text-2xl font-bold text-primary truncate">{state?.game.name ?? 'Minijuego'}</h1>
              <p className="text-sm text-muted-foreground truncate">{state?.game.description ?? 'Reto diario'}</p>
            </div>
          </div>
          {playing && (
            <span className="text-lg font-bold text-primary whitespace-nowrap">
              {playing.score}/{playing.total}
            </span>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6 max-w-3xl">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm">{error}</div>
        )}

        {!state && !error && <div className="h-64 rounded-lg bg-card/50 border border-border/50 animate-pulse" />}

        {state?.empty && (
          <Card className="p-8 text-center space-y-2">
            <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="font-semibold">Este juego todavía no tiene contenido</p>
            <p className="text-sm text-muted-foreground">
              {user.role === 'captain'
                ? 'Cargá preguntas desde "Preguntas" en el panel de minijuegos.'
                : 'Los capitanes tienen que cargar preguntas primero.'}
            </p>
          </Card>
        )}

        {playing && (
          <>
            {/* Progreso: un punto por pregunta */}
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: playing.total }).map((_, i) => {
                const a = playing.answered[i]
                const color = !a
                  ? i === playing.answered.length
                    ? 'bg-primary/50 ring-2 ring-primary'
                    : 'bg-muted'
                  : a.chosen === a.correctIndex
                    ? 'bg-green-500'
                    : 'bg-destructive'
                return <span key={i} className={`w-3 h-3 rounded-full ${color}`} />
              })}
            </div>

            {showingReveal && reveal ? (
              <Card className="p-6 space-y-4">
                <p className="text-lg font-semibold">{reveal.prompt}</p>
                <div className="space-y-2">
                  {reveal.options.map((opt, i) => {
                    const isCorrect = i === reveal.correctIndex
                    const isChosen = i === reveal.chosen
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
                          isCorrect
                            ? 'border-green-500 bg-green-500/10'
                            : isChosen
                              ? 'border-destructive bg-destructive/10'
                              : 'border-border/50 opacity-60'
                        }`}
                      >
                        <span>{opt}</span>
                        {isCorrect && <Check className="w-4 h-4 text-green-500" />}
                        {isChosen && !isCorrect && <X className="w-4 h-4 text-destructive" />}
                      </div>
                    )
                  })}
                </div>
                <p className={`font-bold ${reveal.chosen === reveal.correctIndex ? 'text-green-500' : 'text-destructive'}`}>
                  {reveal.chosen === reveal.correctIndex ? '¡Correcto!' : 'Incorrecto'}
                </p>
                {reveal.explanation && <p className="text-sm text-muted-foreground">{reveal.explanation}</p>}
                <Button className="w-full gap-2" onClick={() => setReveal(null)}>
                  {playing.finished ? 'Ver resultado' : 'Siguiente pregunta'} <ChevronRight className="w-4 h-4" />
                </Button>
              </Card>
            ) : playing.current ? (
              <Card className="p-6 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Pregunta {playing.current.index + 1} de {playing.total}
                </p>
                <p className="text-lg font-semibold">{playing.current.prompt}</p>
                <div className="space-y-2">
                  {playing.current.options.map((opt, i) => (
                    <button
                      key={i}
                      disabled={submitting}
                      onClick={() => answer(i)}
                      className="w-full text-left rounded-lg border border-border/70 px-4 py-3 text-sm hover:border-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </Card>
            ) : playing.finished ? (
              <Card className={`p-6 text-center space-y-3 ${playing.won ? 'border-green-500/50' : 'border-destructive/50'}`}>
                <p className="text-4xl font-bold">
                  {playing.score}/{playing.total}
                </p>
                <p className={`font-bold ${playing.won ? 'text-green-500' : 'text-destructive'}`}>
                  {playing.won ? '¡Reto superado!' : `Te faltó: necesitabas ${playing.winThreshold} correctas`}
                </p>
                <p className="text-sm text-muted-foreground">
                  Próximo reto en <span className="font-mono font-bold">{countdown}</span>
                </p>
                <Button variant="outline" className="gap-2" onClick={handleShare}>
                  <Copy className="w-4 h-4" /> {copied ? '¡Copiado!' : 'Compartir resultado'}
                </Button>

                <div className="text-left space-y-3 pt-4 border-t border-border/50">
                  {playing.answered.map((a, i) => (
                    <div key={i} className="text-sm">
                      <p className="flex items-start gap-2 font-medium">
                        {a.chosen === a.correctIndex ? (
                          <Check className="w-4 h-4 mt-0.5 shrink-0 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
                        )}
                        {a.prompt}
                      </p>
                      <p className="pl-6 text-muted-foreground">
                        Respuesta: <span className="text-foreground">{a.options[a.correctIndex]}</span>
                        {a.chosen !== a.correctIndex && <> · elegiste {a.options[a.chosen]}</>}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            <MinigameStats game={gameId} refreshKey={statsKey} />
          </>
        )}
      </main>
    </div>
  )
}
