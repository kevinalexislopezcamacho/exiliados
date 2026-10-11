'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { clanLabel } from '@/lib/clans'
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, Flame, Trophy } from 'lucide-react'

type Closeness = 'match' | 'close' | 'miss'

interface CandidateOption {
  id: number
  name: string
  clan: string
  flag: string
}

interface NumberClue {
  value: number | null
  result: Closeness
  direction: 'up' | 'down' | null
}

interface Feedback {
  id: number
  name: string
  correct: boolean
  clan: { value: string; result: Closeness }
  nationality: { value: string; flag: string; result: Closeness }
  title: { value: string; result: Closeness }
  role: { value: string; result: Closeness }
  pts: NumberClue
  valor: NumberClue
}

interface GameState {
  day: string
  empty: boolean
  maxAttempts: number
  nextResetAt: string
  candidates: CandidateOption[]
  guesses: Feedback[]
  finished: boolean
  won: boolean
  answer: (CandidateOption & { title: string; pts: number | null; valor: number | null }) | null
}

interface LeaderboardEntry {
  name: string
  played: number
  wins: number
  currentStreak: number
  maxStreak: number
}

interface Stats {
  played: number
  wins: number
  losses: number
  winRate: number
  currentStreak: number
  maxStreak: number
  distribution: number[]
  leaderboard: LeaderboardEntry[]
}

const CELL: Record<Closeness, string> = {
  match: 'bg-green-500/20 border-green-500/50 text-green-600 dark:text-green-400',
  close: 'bg-amber-500/20 border-amber-500/50 text-amber-600 dark:text-amber-400',
  miss: 'bg-muted/40 border-border text-muted-foreground',
}

const EMOJI: Record<Closeness, string> = { match: '🟩', close: '🟨', miss: '⬛' }

function useCountdown(target: string | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!target) return ''
  const diff = Math.max(0, new Date(target).getTime() - now)
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function NumberCell({ clue, suffix = '' }: { clue: NumberClue; suffix?: string }) {
  return (
    <div className={`rounded-md border px-2 py-2 text-center text-xs font-medium flex items-center justify-center gap-1 ${CELL[clue.result]}`}>
      {clue.value === null ? '—' : `${clue.value}${suffix}`}
      {clue.direction === 'up' && <ArrowUp className="w-3.5 h-3.5" />}
      {clue.direction === 'down' && <ArrowDown className="w-3.5 h-3.5" />}
    </div>
  )
}

function TextCell({ result, children }: { result: Closeness; children: React.ReactNode }) {
  return (
    <div className={`rounded-md border px-2 py-2 text-center text-xs font-medium truncate ${CELL[result]}`}>{children}</div>
  )
}

export default function GuessMemberPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [state, setState] = useState<GameState | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const countdown = useCountdown(state?.nextResetAt)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const loadStats = () =>
    fetch('/api/minigames/adivina-integrante/stats')
      .then((r) => r.json())
      .then((r) => r.success && setStats(r.data))
      .catch(() => {})

  useEffect(() => {
    if (!user) return
    fetch('/api/minigames/adivina-integrante')
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setState(r.data)
        else setError(r.error || 'No se pudo cargar el juego')
      })
      .catch(() => setError('Error cargando el juego'))
    loadStats()
  }, [user])

  const guessedIds = useMemo(() => new Set(state?.guesses.map((g) => g.id) ?? []), [state])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!state || !q) return []
    return state.candidates.filter((c) => !guessedIds.has(c.id) && c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, state, guessedIds])

  const handleGuess = async (candidateId: number) => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/minigames/adivina-integrante/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId }),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error)
      setState(result.data)
      setQuery('')
      if (result.data.finished) loadStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error registrando el intento')
    } finally {
      setSubmitting(false)
    }
  }

  const handleShare = async () => {
    if (!state) return
    const rows = state.guesses.map((g) =>
      [g.clan.result, g.nationality.result, g.title.result, g.role.result, g.pts.result, g.valor.result]
        .map((r) => EMOJI[r])
        .join('')
    )
    const score = state.won ? `${state.guesses.length}/${state.maxAttempts}` : `X/${state.maxAttempts}`
    const text = `Adivina el integrante · EXILIADOS ${state.day}\n${score}\n${rows.join('\n')}`
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

  const attemptsLeft = state && !state.empty ? state.maxAttempts - state.guesses.length : 0
  const maxDistribution = Math.max(1, ...(stats?.distribution ?? [0]))

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
              <h1 className="text-2xl font-bold text-primary truncate">Adivina el integrante</h1>
              <p className="text-sm text-muted-foreground">Reto diario · Rayo + Exiliados</p>
            </div>
          </div>
          {stats && (
            <span className="flex items-center gap-1 text-lg font-bold text-amber-500" title="Racha actual">
              <Flame className="w-5 h-5" /> {stats.currentStreak}
            </span>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6 max-w-4xl">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm">{error}</div>
        )}

        {!state ? (
          <div className="h-40 rounded-lg bg-card/50 border border-border/50 animate-pulse" />
        ) : state.empty ? (
          <Card className="p-8 text-center text-muted-foreground">Todavía no hay integrantes en el roster para jugar.</Card>
        ) : (
          <>
            {!state.finished ? (
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Intento {state.guesses.length + 1} de {state.maxAttempts} · te quedan {attemptsLeft}
                </p>
                <div className="relative">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Escribí el nombre de un integrante..."
                    disabled={submitting}
                    autoComplete="off"
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-background shadow-lg overflow-hidden">
                      {suggestions.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleGuess(c.id)}
                          disabled={submitting}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                        >
                          <span>
                            {c.flag} {c.name}
                          </span>
                          <span className="text-xs text-muted-foreground">{clanLabel(c.clan)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  🟩 coincide · 🟨 cerca (selección parecida o número a menos de 15%) · ⬛ no coincide · ↑↓ el secreto
                  tiene más / menos
                </p>
              </Card>
            ) : (
              <Card className={`p-6 text-center ${state.won ? 'border-green-500/40' : 'border-destructive/40'}`}>
                <p className="text-2xl font-bold mb-1">
                  {state.won ? `¡Lo adivinaste en ${state.guesses.length}!` : 'Se acabaron los intentos'}
                </p>
                {state.answer && (
                  <p className="text-muted-foreground">
                    Era <span className="font-bold text-primary">{state.answer.flag} {state.answer.name}</span> (
                    {clanLabel(state.answer.clan)})
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-3">
                  Próximo reto en <span className="font-mono font-bold text-foreground">{countdown}</span>
                </p>
                <Button onClick={handleShare} variant="outline" className="mt-4 gap-2">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado' : 'Compartir resultado'}
                </Button>
              </Card>
            )}

            {state.guesses.length > 0 && (
              <div className="overflow-x-auto">
                <div className="min-w-[640px] space-y-2">
                  <div className="grid grid-cols-[1.6fr_repeat(6,1fr)] gap-2 text-[11px] uppercase tracking-wide text-muted-foreground text-center">
                    <span className="text-left">Integrante</span>
                    <span>Clan</span>
                    <span>País</span>
                    <span>Selección</span>
                    <span>Rango</span>
                    <span>PTS</span>
                    <span>Valor</span>
                  </div>
                  {[...state.guesses].reverse().map((g) => (
                    <div key={g.id} className="grid grid-cols-[1.6fr_repeat(6,1fr)] gap-2">
                      <div
                        className={`rounded-md border px-2 py-2 text-xs font-bold truncate ${
                          g.correct ? CELL.match : 'border-border bg-card/50'
                        }`}
                      >
                        {g.name}
                      </div>
                      <TextCell result={g.clan.result}>{clanLabel(g.clan.value)}</TextCell>
                      <TextCell result={g.nationality.result}>
                        {g.nationality.flag || '🌍'} {g.nationality.value.toUpperCase() || '—'}
                      </TextCell>
                      <TextCell result={g.title.result}>{g.title.value || '—'}</TextCell>
                      <TextCell result={g.role.result}>{g.role.value === 'captain' ? 'Capitán' : 'Miembro'}</TextCell>
                      <NumberCell clue={g.pts} />
                      <NumberCell clue={g.valor} suffix="M" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-bold text-lg text-primary mb-4">Tus estadísticas</h3>
              <div className="grid grid-cols-3 gap-3 text-center mb-5">
                <div>
                  <p className="text-2xl font-bold">{stats.played}</p>
                  <p className="text-[11px] text-muted-foreground">Jugadas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-500">{stats.wins}</p>
                  <p className="text-[11px] text-muted-foreground">Aciertos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{stats.losses}</p>
                  <p className="text-[11px] text-muted-foreground">Fallos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{Math.round(stats.winRate * 100)}%</p>
                  <p className="text-[11px] text-muted-foreground">% victorias</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-500">{stats.currentStreak}</p>
                  <p className="text-[11px] text-muted-foreground">Racha actual</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.maxStreak}</p>
                  <p className="text-[11px] text-muted-foreground">Mejor racha</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Intentos para acertar</p>
              <div className="space-y-1">
                {stats.distribution.map((count, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-muted-foreground">{i + 1}</span>
                    <div
                      className="h-5 rounded bg-primary/70 text-primary-foreground flex items-center justify-end px-1.5 font-medium min-w-[1.5rem]"
                      style={{ width: `${(count / maxDistribution) * 100}%` }}
                    >
                      {count}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-bold text-lg text-primary mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5" /> Ranking del clan
              </h3>
              {stats.leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía nadie terminó un reto. ¡Sé el primero!</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-[11px] text-muted-foreground uppercase">
                    <tr>
                      <th className="text-left py-1">#</th>
                      <th className="text-left py-1">Integrante</th>
                      <th className="text-center py-1">Racha</th>
                      <th className="text-center py-1">Aciertos</th>
                      <th className="text-center py-1">Mejor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.leaderboard.map((e, i) => (
                      <tr key={e.name} className="border-t border-border/50">
                        <td className="py-1.5 font-bold text-primary">{i + 1}</td>
                        <td className="py-1.5 truncate max-w-[10rem]">{e.name}</td>
                        <td className="py-1.5 text-center font-bold text-amber-500">🔥 {e.currentStreak}</td>
                        <td className="py-1.5 text-center">
                          {e.wins}/{e.played}
                        </td>
                        <td className="py-1.5 text-center text-muted-foreground">{e.maxStreak}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
