'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { useCountdown } from '@/components/minigame-stats'
import { MinigameCover } from '@/components/minigame-covers'
import { ArrowLeft, Check, Clock, Flame, ListChecks, Lock, Trophy, X } from 'lucide-react'

interface GameSummary {
  id: string
  name: string
  description: string
  category: 'clan' | 'futbol' | 'osm' | 'competencias'
  kind: 'guess-member' | 'quiz' | 'wordle' | 'order' | 'timed' | 'grid' | 'guess'
  maxAttempts: number
  scoreMax?: number
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

const CATEGORIES: Array<{ id: GameSummary['category']; label: string; hint: string }> = [
  { id: 'clan', label: 'Clan', hint: 'Rayo y Exiliados: ¿cuánto conocés a tu gente?' },
  { id: 'futbol', label: 'Fútbol', hint: 'Jugadores, clubes, escudos y Mundiales' },
  { id: 'osm', label: 'OSM', hint: 'Online Soccer Manager' },
  { id: 'competencias', label: 'Competencias', hint: 'Torneos de la comunidad' },
]

function gameHref(game: GameSummary) {
  if (game.kind === 'quiz') return `/dashboard/minijuegos/quiz/${game.id}`
  if (game.kind === 'guess') return `/dashboard/minijuegos/adivinanza/${game.id}`
  return `/dashboard/minijuegos/${game.id}`
}

function resultLabel(game: GameSummary) {
  if (game.scoreMax) return `${game.today.score ?? 0}/${game.scoreMax}`
  if (!game.today.won) return 'No acertaste'
  return game.today.score ? `En ${game.today.score} intento${game.today.score === 1 ? '' : 's'}` : '¡Acertaste!'
}

// Tarjeta tipo portada: ilustración arriba y franja con el nombre abajo.
// Las jugadas hoy quedan atenuadas con el resultado encima.
function GameTile({ game, isCaptain }: { game: GameSummary; isCaptain: boolean }) {
  const done = game.today.finished
  const won = game.today.won

  const tile = (
    <div
      className={`group relative h-full flex flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-200 ${
        game.available
          ? 'hover:-translate-y-1 hover:border-primary hover:shadow-[0_8px_30px_-6px] hover:shadow-primary/50'
          : 'opacity-60'
      } ${done ? (won ? 'border-green-600/50' : 'border-destructive/50') : 'border-border'}`}
    >
      {/* Portada */}
      <div className="relative aspect-[16/10] text-primary bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_32%,transparent),transparent_70%)] bg-zinc-950">
        <div className={`absolute inset-0 flex items-center justify-center p-3 transition-transform duration-300 group-hover:scale-105 ${done ? 'opacity-35' : ''}`}>
          <MinigameCover id={game.id} />
        </div>

        {game.currentStreak > 0 && (
          <span
            className="absolute top-2 right-2 flex items-center gap-0.5 rounded-full bg-black/70 backdrop-blur px-2 py-0.5 text-xs font-bold text-amber-400 ring-1 ring-amber-400/40"
            title="Racha actual"
          >
            <Flame className="w-3.5 h-3.5" /> {game.currentStreak}
          </span>
        )}

        {done && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span
              className={`flex items-center justify-center w-11 h-11 rounded-full shadow-lg ${
                won ? 'bg-green-600' : 'bg-destructive'
              }`}
            >
              {won ? <Check className="w-6 h-6 text-white" /> : <X className="w-6 h-6 text-white" />}
            </span>
            <span className="rounded-full bg-black/75 px-2.5 py-0.5 text-xs font-bold text-white">{resultLabel(game)}</span>
          </div>
        )}

        {!game.available && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Franja inferior */}
      <div
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 text-center ${
          done ? 'bg-muted/40' : 'bg-primary/90 group-hover:bg-primary'
        } transition-colors`}
      >
        <span className={`text-sm sm:text-base font-black tracking-wider ${done ? 'text-muted-foreground' : 'text-primary-foreground'}`}>
          {!game.available ? 'PRÓXIMAMENTE' : done ? 'VER RESULTADO' : game.today.started ? 'SEGUIR' : 'JUGAR'}
        </span>
        <span className={`text-xs sm:text-sm font-semibold leading-tight ${done ? 'text-foreground' : 'text-primary-foreground/90'}`}>
          {game.name}
        </span>
      </div>
    </div>
  )

  if (!game.available) {
    return (
      <div title={isCaptain ? 'Cargá preguntas en "Preguntas" para activarlo' : 'Los capitanes todavía no cargaron preguntas'}>
        {tile}
      </div>
    )
  }
  return (
    <Link href={gameHref(game)} title={game.description} className="block h-full">
      {tile}
    </Link>
  )
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
  const available = summary?.games.filter((g) => g.available).length ?? 0
  const progress = summary && available > 0 ? Math.min(1, summary.finishedToday / available) : 0

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
              <p className="text-sm text-muted-foreground truncate">Un reto nuevo de cada juego por día · cuidá tu racha</p>
            </div>
          </div>
          {isCaptain && (
            <Link href="/dashboard/minijuegos/preguntas">
              <Button variant="outline" className="gap-2 border-primary/40 hover:bg-primary/10">
                <ListChecks className="w-4 h-4" /> <span className="hidden sm:inline">Preguntas</span>
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-10 max-w-6xl">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm">{error}</div>
        )}

        {/* Resumen del día */}
        <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-zinc-950 p-5 sm:p-6">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/25 blur-3xl" aria-hidden="true" />
          <div className="relative grid grid-cols-3 gap-3 sm:gap-6 text-center">
            <div>
              <p className="flex items-center justify-center gap-1 text-2xl sm:text-4xl font-black text-amber-400">
                <Flame className="w-6 h-6 sm:w-8 sm:h-8" /> {summary?.dailyStreak ?? '–'}
              </p>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">días seguidos jugando</p>
            </div>
            <div>
              <p className="flex items-center justify-center gap-1 text-2xl sm:text-4xl font-black text-primary">
                <Trophy className="w-6 h-6 sm:w-8 sm:h-8" /> {summary ? `${summary.finishedToday}/${available}` : '–'}
              </p>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">retos de hoy</p>
            </div>
            <div>
              <p className="flex items-center justify-center gap-1 text-2xl sm:text-4xl font-black font-mono text-white">
                <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" /> {countdown || '–'}
              </p>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">para los retos nuevos</p>
            </div>
          </div>
          <div className="relative mt-5 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
        </section>

        {!summary ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/4] rounded-2xl bg-card/50 border border-border/50 animate-pulse" />
            ))}
          </div>
        ) : (
          CATEGORIES.map((category) => {
            const games = summary.games.filter((g) => g.category === category.id)
            if (games.length === 0) return null
            const doneHere = games.filter((g) => g.today.finished).length
            return (
              <section key={category.id}>
                <div className="flex items-end justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-black tracking-widest uppercase text-primary">{category.label}</h2>
                    <p className="text-xs text-muted-foreground">{category.hint}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {doneHere}/{games.length} jugados
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {games.map((game) => (
                    <GameTile key={game.id} game={game} isCaptain={isCaptain} />
                  ))}
                </div>
              </section>
            )
          })
        )}
      </main>
    </div>
  )
}
