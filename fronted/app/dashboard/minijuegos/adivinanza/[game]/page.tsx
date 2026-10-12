'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { MinigameStats, useCountdown } from '@/components/minigame-stats'
import { MinigameEmpty, MinigameLoading, MinigameShell, ShareButton, useMinigame } from '@/components/minigame-shell'
import { MinigameSearch } from '@/components/minigame-search'
import { Check, ChevronRight, X } from 'lucide-react'

type Clue = { type: 'career'; clubs: string[] } | { type: 'crest'; pixels: number | null }

interface GuessState {
  day: string
  empty: boolean
  game: { id: string; name: string; description: string }
  nextResetAt: string
  maxAttempts: number
  options: string[]
  clue: Clue
  hints: Array<{ label: string; value: string }>
  guesses: Array<{ name: string; ok: boolean }>
  finished: boolean
  won: boolean
  answer: string | null
}

// Dibuja el escudo achicado a `pixels` bloques de ancho y lo vuelve a
// agrandar sin suavizado: queda pixelado. Sin pixels, se ve nítido.
function PixelCrest({ game, pixels }: { game: string; pixels: number | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const image = new Image()
    image.onload = () => setImg(image)
    image.onerror = () => setFailed(true)
    image.src = `/api/minigames/${game}/crest`
  }, [game])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !img) return
    const size = canvas.width
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, size, size)
    // Mantiene la proporción del escudo dentro del cuadrado.
    const scale = Math.min(size / img.width, size / img.height)
    const w = img.width * scale
    const h = img.height * scale
    const x = (size - w) / 2
    const y = (size - h) / 2
    if (!pixels) {
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(img, x, y, w, h)
      return
    }
    const small = document.createElement('canvas')
    small.width = pixels
    small.height = pixels
    const sctx = small.getContext('2d')
    if (!sctx) return
    sctx.drawImage(img, (x / size) * pixels, (y / size) * pixels, (w / size) * pixels, (h / size) * pixels)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(small, 0, 0, pixels, pixels, 0, 0, size, size)
  }, [img, pixels])

  if (failed) return <p className="text-sm text-destructive text-center">No se pudo cargar el escudo.</p>
  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={240}
      className="mx-auto w-48 h-48 sm:w-60 sm:h-60 rounded-lg bg-white/5"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

export default function AdivinanzaPage() {
  const params = useParams<{ game: string }>()
  const gameId = params.game
  const { state, error, setError, busy, move, statsKey } = useMinigame<GuessState>(gameId)
  const countdown = useCountdown(state && !state.empty ? state.nextResetAt : undefined)

  const isCrest = state?.clue?.type === 'crest'
  const shareText =
    state && state.finished
      ? `${state.game.name} · EXILIADOS ${state.day}\n${state.won ? `${state.guesses.length}/${state.maxAttempts}` : `X/${state.maxAttempts}`}\n` +
        state.guesses.map((g) => (g.ok ? '🟩' : '🟥')).join('')
      : ''

  return (
    <MinigameShell
      title={state?.game.name ?? 'Minijuego'}
      subtitle={state?.game.description}
      error={error}
      right={
        state && !state.empty ? (
          <span className="text-sm font-bold text-primary whitespace-nowrap">
            {state.guesses.length}/{state.maxAttempts}
          </span>
        ) : null
      }
    >
      {!state && !error && <MinigameLoading />}
      {state?.empty && <MinigameEmpty message="No hay contenido para hoy." />}

      {state && !state.empty && (
        <>
          <Card className="p-6 space-y-4">
            {state.clue.type === 'career' ? (
              <div>
                <p className="text-xs text-muted-foreground mb-3">Clubes en orden</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {state.clue.clubs.map((club, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <span className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-sm font-medium">
                        {club}
                      </span>
                      {i < (state.clue as { clubs: string[] }).clubs.length - 1 && (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <PixelCrest game={gameId} pixels={state.clue.pixels} />
            )}

            {state.hints.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {state.hints.map((h) => (
                  <span key={h.label} className="text-xs rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-1">
                    {h.label}: <b>{h.value}</b>
                  </span>
                ))}
              </div>
            )}
            {!state.finished && (
              <p className="text-xs text-muted-foreground">
                {isCrest
                  ? 'Cada error muestra el escudo más nítido. Al tercer error aparece el país.'
                  : 'Al segundo error aparece la nacionalidad y al cuarto, la posición.'}
              </p>
            )}

            {!state.finished && (
              <MinigameSearch
                options={state.options}
                exclude={state.guesses.map((g) => g.name)}
                placeholder={isCrest ? 'Escribí el club...' : 'Escribí el jugador...'}
                disabled={busy}
                onPick={(guess) => move({ guess })}
              />
            )}
          </Card>

          {state.guesses.length > 0 && (
            <div className="space-y-1.5">
              {state.guesses.map((g) => (
                <div
                  key={g.name}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    g.ok ? 'border-green-500 bg-green-500/10' : 'border-destructive/40 bg-destructive/5'
                  }`}
                >
                  {g.ok ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-destructive" />}
                  {g.name}
                </div>
              ))}
            </div>
          )}

          {state.finished && (
            <Card className={`p-6 text-center space-y-3 ${state.won ? 'border-green-500/50' : 'border-destructive/50'}`}>
              <p className={`text-xl font-bold ${state.won ? 'text-green-500' : 'text-destructive'}`}>
                {state.won ? `¡Acertaste en ${state.guesses.length}!` : 'Se acabaron los intentos'}
              </p>
              <p>
                Era <span className="font-bold text-primary">{state.answer}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Próximo reto en <span className="font-mono font-bold">{countdown}</span>
              </p>
              <ShareButton text={shareText} onError={setError} />
            </Card>
          )}

          <MinigameStats game={gameId} refreshKey={statsKey} />
        </>
      )}
    </MinigameShell>
  )
}
