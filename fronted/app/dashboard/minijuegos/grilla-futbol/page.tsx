'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MinigameStats, useCountdown } from '@/components/minigame-stats'
import { MinigameEmpty, MinigameLoading, MinigameShell, ShareButton, useMinigame } from '@/components/minigame-shell'
import { MinigameSearch } from '@/components/minigame-search'
import { Flag } from 'lucide-react'

const GAME = 'grilla-futbol'

interface GridState {
  day: string
  empty: boolean
  nextResetAt: string
  rows: string[]
  cols: string[]
  cells: Array<string | null>
  attemptsUsed: number
  maxAttempts: number
  winCells: number
  wrong: Array<{ cell: number; player: string }>
  players: string[]
  finished: boolean
  won: boolean
  score: number
  examples: string[][] | null
}

export default function GrillaFutbolPage() {
  const { state, error, setError, busy, move, statsKey } = useMinigame<GridState>(GAME)
  const [selected, setSelected] = useState<number | null>(null)
  const countdown = useCountdown(state?.nextResetAt)

  const used = state ? (state.cells.filter(Boolean) as string[]) : []
  const shareText = state?.finished
    ? `Grilla 3×3 · EXILIADOS ${state.day}\n${state.score}/9\n` +
      [0, 1, 2].map((r) => [0, 1, 2].map((c) => (state.cells[r * 3 + c] ? '🟩' : '⬛')).join('')).join('\n')
    : ''

  const guess = async (player: string) => {
    if (selected === null) return
    const next = await move({ cell: selected, player })
    if (next && next.cells[selected]) setSelected(null)
  }

  return (
    <MinigameShell
      title="Grilla 3×3"
      subtitle="Un jugador que cumpla la fila y la columna"
      error={error}
      right={
        state && !state.empty ? (
          <span className="text-sm font-bold text-primary whitespace-nowrap">
            {state.maxAttempts - state.attemptsUsed} intentos
          </span>
        ) : null
      }
    >
      {!state && !error && <MinigameLoading />}
      {state?.empty && <MinigameEmpty message="No se pudo armar la grilla de hoy." />}

      {state && !state.empty && (
        <>
          <Card className="p-3 sm:p-5">
            <div className="grid grid-cols-[minmax(0,0.8fr)_repeat(3,minmax(0,1fr))] gap-1.5 sm:gap-2">
              <div />
              {state.cols.map((c) => (
                <div key={c} className="flex items-end justify-center text-center text-[11px] sm:text-sm font-bold text-primary p-1">
                  {c}
                </div>
              ))}
              {state.rows.map((rowLabel, r) => (
                <div key={rowLabel} className="contents">
                  <div className="flex items-center text-[11px] sm:text-sm font-bold text-primary p-1">{rowLabel}</div>
                  {[0, 1, 2].map((c) => {
                    const cell = r * 3 + c
                    const value = state.cells[cell]
                    const isSelected = selected === cell
                    return (
                      <button
                        key={cell}
                        disabled={state.finished || !!value}
                        onClick={() => setSelected(isSelected ? null : cell)}
                        className={`aspect-square rounded-lg border-2 p-1 text-[11px] sm:text-sm font-semibold flex flex-col items-center justify-center text-center transition-colors ${
                          value
                            ? 'border-green-600 bg-green-600/15 text-foreground'
                            : isSelected
                              ? 'border-primary bg-primary/15'
                              : 'border-border hover:border-primary/60'
                        }`}
                      >
                        {value ?? (state.finished ? '' : '+')}
                        {state.finished && !value && state.examples?.[cell]?.length ? (
                          <span className="text-[10px] font-normal text-muted-foreground leading-tight">
                            {state.examples[cell].join(', ')}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </Card>

          {!state.finished && (
            <Card className="p-4 space-y-3">
              {selected === null ? (
                <p className="text-sm text-muted-foreground">
                  Tocá una casilla vacía y escribí un jugador. Cada intento cuenta, acierte o no. Se gana completando{' '}
                  {state.winCells} de 9.
                </p>
              ) : (
                <>
                  <p className="text-sm">
                    <span className="text-primary font-medium">{state.rows[Math.floor(selected / 3)]}</span> +{' '}
                    <span className="text-primary font-medium">{state.cols[selected % 3]}</span>
                  </p>
                  <MinigameSearch
                    options={state.players}
                    exclude={used}
                    placeholder="Buscá un jugador..."
                    disabled={busy}
                    onPick={guess}
                  />
                </>
              )}
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  disabled={busy}
                  onClick={() => {
                    if (confirm('¿Terminar la grilla así como está?')) move({ giveUp: true })
                  }}
                >
                  <Flag className="w-4 h-4" /> Terminar
                </Button>
              </div>
            </Card>
          )}

          {state.wrong.length > 0 && (
            <Card className="p-4">
              <p className="text-xs text-muted-foreground mb-2">Intentos fallados</p>
              <div className="flex flex-wrap gap-1">
                {state.wrong.map((w, i) => (
                  <span key={i} className="text-xs rounded bg-destructive/15 text-destructive px-2 py-1">
                    {w.player}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {state.finished && (
            <Card className={`p-6 text-center space-y-3 ${state.won ? 'border-green-500/50' : 'border-destructive/50'}`}>
              <p className="text-4xl font-bold">{state.score}/9</p>
              <p className={`font-bold ${state.won ? 'text-green-500' : 'text-destructive'}`}>
                {state.won ? '¡Grilla superada!' : `Necesitabas ${state.winCells} casillas`}
              </p>
              <p className="text-xs text-muted-foreground">En las casillas vacías aparecen algunas respuestas posibles.</p>
              <p className="text-sm text-muted-foreground">
                Próximo reto en <span className="font-mono font-bold">{countdown}</span>
              </p>
              <ShareButton text={shareText} onError={setError} />
            </Card>
          )}

          <MinigameStats game={GAME} refreshKey={statsKey} />
        </>
      )}
    </MinigameShell>
  )
}
