'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MinigameStats, useCountdown } from '@/components/minigame-stats'
import { MinigameEmpty, MinigameLoading, MinigameShell, ShareButton, useMinigame } from '@/components/minigame-shell'
import { ArrowDown, ArrowUp, Check, X } from 'lucide-react'

const GAME = 'ordena-top5'

interface OrderState {
  day: string
  empty: boolean
  nextResetAt: string
  statLabel: string
  items: string[]
  maxAttempts: number
  attempts: Array<{ order: string[]; correct: boolean[] }>
  finished: boolean
  won: boolean
  answer: Array<{ name: string; display: string }> | null
}

export default function OrdenaTop5Page() {
  const { state, error, setError, busy, move, statsKey } = useMinigame<OrderState>(GAME)
  const [order, setOrder] = useState<string[]>([])
  const countdown = useCountdown(state?.nextResetAt)

  // Arranca desde el último intento (para corregir solo lo que falló) o
  // desde el orden mezclado del día.
  useEffect(() => {
    if (!state || state.empty) return
    setOrder(state.attempts.at(-1)?.order ?? state.items)
  }, [state])

  const swap = (i: number, j: number) => {
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
  }

  const last = state?.attempts.at(-1)
  const shareText =
    state && state.finished
      ? `Ordená el top 5 · EXILIADOS ${state.day}\n${state.won ? `${state.attempts.length}/${state.maxAttempts}` : `X/${state.maxAttempts}`}\n` +
        state.attempts.map((a) => a.correct.map((c) => (c ? '🟩' : '⬛')).join('')).join('\n')
      : ''

  return (
    <MinigameShell
      title="Ordená el top 5"
      subtitle={state && !state.empty ? `De mayor a menor por ${state.statLabel}` : 'Reto diario'}
      error={error}
      right={
        state && !state.empty ? (
          <span className="text-sm font-bold text-primary whitespace-nowrap">
            {state.attempts.length}/{state.maxAttempts}
          </span>
        ) : null
      }
    >
      {!state && !error && <MinigameLoading />}
      {state?.empty && <MinigameEmpty message="Hacen falta reportes con estadísticas de al menos 5 integrantes." />}

      {state && !state.empty && (
        <>
          {!state.finished ? (
            <Card className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Ordená de <span className="text-foreground font-medium">mayor a menor</span> por{' '}
                <span className="text-primary font-medium">{state.statLabel}</span>. Te quedan{' '}
                {state.maxAttempts - state.attempts.length} intentos.
              </p>
              <div className="space-y-2">
                {order.map((name, i) => {
                  const wasCorrect = last && last.order[i] === name && last.correct[i]
                  return (
                    <div
                      key={name}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                        wasCorrect ? 'border-green-500 bg-green-500/10' : 'border-border/70'
                      }`}
                    >
                      <span className="w-6 text-center font-bold text-primary">{i + 1}</span>
                      <span className="flex-1 truncate font-medium">{name}</span>
                      <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => swap(i, i - 1)} aria-label="Subir">
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={i === order.length - 1}
                        onClick={() => swap(i, i + 1)}
                        aria-label="Bajar"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
              <Button className="w-full" disabled={busy || order.length === 0} onClick={() => move({ order })}>
                {busy ? 'Enviando...' : 'Enviar orden'}
              </Button>
            </Card>
          ) : (
            <Card className={`p-6 space-y-4 ${state.won ? 'border-green-500/50' : 'border-destructive/50'}`}>
              <p className={`text-xl font-bold text-center ${state.won ? 'text-green-500' : 'text-destructive'}`}>
                {state.won ? `¡Lo ordenaste en ${state.attempts.length}!` : 'Se acabaron los intentos'}
              </p>
              <div className="space-y-1">
                {state.answer?.map((a, i) => (
                  <div key={a.name} className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm">
                    <span className="w-6 text-center font-bold text-primary">{i + 1}</span>
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="font-mono text-muted-foreground">{a.display}</span>
                  </div>
                ))}
              </div>
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Próximo reto en <span className="font-mono font-bold">{countdown}</span>
                </p>
                <ShareButton text={shareText} onError={setError} />
              </div>
            </Card>
          )}

          {state.attempts.length > 0 && (
            <Card className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Tus intentos (✓ = posición correcta)</p>
              {state.attempts.map((a, n) => (
                <div key={n} className="flex flex-wrap gap-1 text-xs">
                  {a.order.map((name, i) => (
                    <span
                      key={name}
                      className={`flex items-center gap-1 rounded px-2 py-1 ${
                        a.correct[i] ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {a.correct[i] ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {i + 1}. {name}
                    </span>
                  ))}
                </div>
              ))}
            </Card>
          )}

          <MinigameStats game={GAME} refreshKey={statsKey} />
        </>
      )}
    </MinigameShell>
  )
}
