'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MinigameStats, useCountdown } from '@/components/minigame-stats'
import { MinigameEmpty, MinigameLoading, MinigameShell, ShareButton, useMinigame } from '@/components/minigame-shell'
import { Check, Timer, X } from 'lucide-react'

const GAME = 'rayo-o-exi'
type Clan = 'rayo' | 'exiliados'

interface TimedState {
  day: string
  empty: boolean
  nextResetAt: string
  total: number
  timeLimitSec: number
  winThreshold: number
  started: boolean
  finished: boolean
  won: boolean
  names?: string[]
  remainingMs?: number
  score?: number
  results?: Array<{ name: string; clan: Clan; chosen: Clan | null; ok: boolean }>
}

const CLAN_LABEL: Record<Clan, string> = { rayo: 'Rayo', exiliados: 'Exiliados' }

export default function RayoOExiPage() {
  const { state, error, setError, busy, move, statsKey } = useMinigame<TimedState>(GAME)
  const [answers, setAnswers] = useState<Array<Clan | null>>([])
  const [deadline, setDeadline] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const sentRef = useRef(false)
  const countdown = useCountdown(state?.nextResetAt)

  const playing = !!state && state.started && !state.finished && !!state.names

  // El servidor dice cuánto tiempo queda; con eso se arma el reloj local.
  useEffect(() => {
    if (playing && state?.remainingMs !== undefined && deadline === null) {
      setDeadline(Date.now() + state.remainingMs)
      setAnswers(Array(state.names!.length).fill(null))
    }
  }, [playing, state, deadline])

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [playing])

  const finish = useCallback(
    (final: Array<Clan | null>) => {
      if (sentRef.current) return
      sentRef.current = true
      move({ action: 'finish', answers: final })
    },
    [move]
  )

  const current = answers.findIndex((a) => a === null)
  const remaining = deadline === null ? 0 : Math.max(0, deadline - now)

  useEffect(() => {
    if (!playing || deadline === null) return
    if (remaining <= 0 || (answers.length > 0 && current === -1)) finish(answers)
  }, [playing, deadline, remaining, current, answers, finish])

  const choose = useCallback(
    (clan: Clan) => {
      if (!playing || current === -1 || remaining <= 0) return
      setAnswers((prev) => {
        const next = [...prev]
        next[current] = clan
        return next
      })
    },
    [playing, current, remaining]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') choose('rayo')
      else if (e.key === 'ArrowRight') choose('exiliados')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choose])

  const shareText =
    state?.finished && state.results
      ? `¿Rayo o Exi? · EXILIADOS ${state.day}\n${state.score}/${state.total}\n` +
        state.results.map((r) => (r.ok ? '🟩' : '🟥')).join('')
      : ''

  return (
    <MinigameShell title="¿Rayo o Exi?" subtitle="Contrarreloj: ¿de qué clan es cada integrante?" error={error}>
      {!state && !error && <MinigameLoading />}
      {state?.empty && <MinigameEmpty message="Hacen falta al menos 10 integrantes en el roster." />}

      {state && !state.empty && !state.started && (
        <Card className="p-8 text-center space-y-4">
          <Timer className="w-10 h-10 mx-auto text-primary" />
          <p className="text-lg font-semibold">
            {state.total} integrantes · {state.timeLimitSec} segundos
          </p>
          <p className="text-sm text-muted-foreground">
            Van apareciendo de a uno: tocá <b>Rayo</b> o <b>Exiliados</b> (o usá las flechas ← →). Se gana con{' '}
            {state.winThreshold} o más correctas. Una vez que empezás, el reloj no se detiene.
          </p>
          <Button size="lg" disabled={busy} onClick={() => move({ action: 'start' })}>
            Empezar
          </Button>
        </Card>
      )}

      {playing && state.names && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {Math.min(current === -1 ? state.names.length : current + 1, state.names.length)}/{state.names.length}
            </span>
            <span className={`font-mono font-bold ${remaining < 10_000 ? 'text-destructive' : 'text-primary'}`}>
              {(remaining / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="h-2 rounded bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-100"
              style={{ width: `${(remaining / (state.timeLimitSec * 1000)) * 100}%` }}
            />
          </div>
          <p className="text-3xl font-bold text-center py-6 break-words">
            {current === -1 ? 'Enviando...' : state.names[current]}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" variant="outline" className="h-16 text-lg" onClick={() => choose('rayo')}>
              ← Rayo
            </Button>
            <Button size="lg" className="h-16 text-lg" onClick={() => choose('exiliados')}>
              Exiliados →
            </Button>
          </div>
        </Card>
      )}

      {state?.finished && state.results && (
        <Card className={`p-6 space-y-4 ${state.won ? 'border-green-500/50' : 'border-destructive/50'}`}>
          <div className="text-center space-y-2">
            <p className="text-4xl font-bold">
              {state.score}/{state.total}
            </p>
            <p className={`font-bold ${state.won ? 'text-green-500' : 'text-destructive'}`}>
              {state.won ? '¡Reto superado!' : `Necesitabas ${state.winThreshold} o más`}
            </p>
            <p className="text-sm text-muted-foreground">
              Próximo reto en <span className="font-mono font-bold">{countdown}</span>
            </p>
            <ShareButton text={shareText} onError={setError} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-2 border-t border-border/50">
            {state.results.map((r) => (
              <div key={r.name} className="flex items-center gap-2 text-sm py-1">
                {r.ok ? <Check className="w-4 h-4 text-green-500 shrink-0" /> : <X className="w-4 h-4 text-destructive shrink-0" />}
                <span className="truncate flex-1">{r.name}</span>
                <span className="text-xs text-muted-foreground">{CLAN_LABEL[r.clan]}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {state && !state.empty && <MinigameStats game={GAME} refreshKey={statsKey} />}
    </MinigameShell>
  )
}
