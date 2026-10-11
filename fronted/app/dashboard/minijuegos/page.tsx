'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useCountdown } from '@/components/minigame-stats'
import { ArrowLeft, Check, ChevronRight, Flame, ListChecks, Lock, X } from 'lucide-react'

interface GameSummary {
  id: string
  name: string
  description: string
  category: 'clan' | 'futbol' | 'osm' | 'competencias'
  kind: 'guess-member' | 'quiz' | 'wordle'
  maxAttempts: number
  available: boolean
  today: { started: boolean; finished: boolean; won: boolean; score: number | null }
  currentStreak: number
  maxStreak: number
}

interface Summary {
  day: string
  nextResetAt: string
  games: GameSummary[]
  finishedToday: number
  dailyStreak: number
}

const CATEGORY_LABELS: Record<GameSummary['category'], string> = {
  clan: 'Clan',
  futbol: 'Fútbol',
  osm: 'OSM',
  competencias: 'Competencias',
}

const CATEGORY_ORDER: GameSummary['category'][] = ['clan', 'futbol', 'osm', 'competencias']

function gameHref(game: GameSummary) {
  if (game.kind === 'quiz') return `/dashboard/minijuegos/quiz/${game.id}`
  return `/dashboard/minijuegos/${game.id}`
}

function statusLabel(game: GameSummary) {
  if (!game.today.finished) return game.today.started ? 'En curso' : 'Sin jugar'
  if (game.kind === 'quiz') return `${game.today.score ?? 0}/5`
  return game.today.won ? `Acertaste en ${game.today.score}` : 'No acertaste'
}

export default function MinigamesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const countdown = useCountdown(summary?.nextResetAt)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    fetch('/api/minigames')
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setSummary(r.data)
        else setError(r.error || 'No se pudieron cargar los minijuegos')
      })
      .catch(() => setError('Error cargando los minijuegos'))
  }, [user])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isCaptain = user.role === 'captain'

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-primary">Minijuegos</h1>
              <p className="text-sm text-muted-foreground">Un reto nuevo de cada juego por día · cuidá tu racha</p>
            </div>
          </div>
          {isCaptain && (
            <Link href="/dashboard/minijuegos/preguntas">
              <Button variant="outline" className="gap-2 border-primary/40 hover:bg-primary/10">
                <ListChecks className="w-4 h-4" /> Preguntas
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 space-y-8">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm">{error}</div>
        )}

        {!summary ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 rounded-lg bg-card/50 border border-border/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 text-center">
                <p className="text-3xl font-bold text-amber-500 flex items-center justify-center gap-1">
                  <Flame className="w-7 h-7" /> {summary.dailyStreak}
                </p>
                <p className="text-xs text-muted-foreground">Días seguidos jugando</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-3xl font-bold text-primary">
                  {summary.finishedToday}/{summary.games.filter((g) => g.available).length}
                </p>
                <p className="text-xs text-muted-foreground">Retos terminados hoy</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-3xl font-bold font-mono">{countdown}</p>
                <p className="text-xs text-muted-foreground">Para los retos nuevos</p>
              </Card>
            </div>

            {CATEGORY_ORDER.map((category) => {
              const games = summary.games.filter((g) => g.category === category)
              if (games.length === 0) return null
              return (
                <section key={category}>
                  <h2 className="text-sm tracking-widest uppercase text-muted-foreground mb-3">
                    {CATEGORY_LABELS[category]}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {games.map((game) => (
                      <Card
                        key={game.id}
                        className={`p-5 flex flex-col ${
                          game.today.finished
                            ? game.today.won
                              ? 'border-green-500/40'
                              : 'border-destructive/40'
                            : 'border-primary/30 bg-gradient-to-br from-primary/5 to-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-bold text-primary">{game.name}</h3>
                          {game.currentStreak > 0 && (
                            <span className="flex items-center gap-0.5 text-sm font-bold text-amber-500" title="Racha actual">
                              <Flame className="w-4 h-4" /> {game.currentStreak}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-4 flex-1">{game.description}</p>

                        {!game.available ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Lock className="w-4 h-4" />
                            {isCaptain ? 'Sin preguntas todavía: cargalas en "Preguntas".' : 'Los capitanes todavía no cargaron preguntas.'}
                          </div>
                        ) : (
                          <Link href={gameHref(game)}>
                            <Button
                              variant={game.today.finished ? 'outline' : 'default'}
                              className="w-full justify-between"
                            >
                              <span className="flex items-center gap-2">
                                {game.today.finished &&
                                  (game.today.won ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <X className="w-4 h-4 text-destructive" />
                                  ))}
                                {game.today.finished ? statusLabel(game) : game.today.started ? 'Seguir jugando' : 'Jugar'}
                              </span>
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        )}
                      </Card>
                    ))}
                  </div>
                </section>
              )
            })}
          </>
        )}
      </main>
    </div>
  )
}
