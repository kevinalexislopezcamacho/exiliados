'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { MinigameSearch } from '@/components/minigame-search'
import { Check, ChevronRight, Delete, Flag, Lightbulb, X } from 'lucide-react'

// Rondas de juego de los partidos del Mundial: versiones cortas de los
// minijuegos. Cada una manda sus jugadas con onMove y termina con un puntaje
// de 0 a 3 (la pantalla del partido muestra el resultado de la ronda).

export type Letter = 'match' | 'present' | 'miss'

export type GameCurrent =
  | { kind: 'wordle'; roundIndex: number; length: number; hint: string; maxAttempts: number; guesses: Array<{ word: string; result: Letter[] }> }
  | {
      kind: 'escudo'
      roundIndex: number
      pixels: number
      options: string[]
      maxAttempts: number
      guesses: Array<{ name: string; ok: boolean }>
      hints: Array<{ label: string; value: string }>
    }
  | {
      kind: 'trayectoria'
      roundIndex: number
      clubs: Array<{ name: string; image: string | null }>
      options: string[]
      maxAttempts: number
      guesses: Array<{ name: string; ok: boolean }>
      hints: Array<{ label: string; value: string }>
    }
  | { kind: 'rayoexi'; roundIndex: number; names: string[]; limitSec: number; remainingMs: number }
  | {
      kind: 'grilla'
      roundIndex: number
      rows: HeaderInfo[]
      cols: HeaderInfo[]
      cells: Array<string | null>
      wrong: string[]
      tries: number
      maxAttempts: number
      players: string[]
    }

interface HeaderInfo {
  label: string
  type: 'club' | 'nation' | 'tag'
  image: string | null
}

type OnMove = (body: Record<string, unknown>) => Promise<unknown>

const CELL: Record<Letter, string> = {
  match: 'bg-green-600 border-green-600 text-white',
  present: 'bg-amber-500 border-amber-500 text-white',
  miss: 'bg-zinc-600 border-zinc-600 text-white',
}
const PRIORITY: Record<Letter, number> = { miss: 0, present: 1, match: 2 }
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM']

export const GAME_LABELS: Record<string, string> = {
  wordle: 'Wordle',
  escudo: 'Escudo',
  trayectoria: 'Trayectoria',
  rayoexi: '¿Rayo o Exi?',
  grilla: 'Grilla',
  quiz: 'Preguntas',
}

export const GAME_INTRO: Record<string, string> = {
  wordle: 'Adiviná el apellido del jugador (5 letras) en 6 intentos. Cuanto antes lo acertés, más puntos.',
  escudo: 'Adiviná el club por su escudo pixelado: cada error lo muestra más claro. 6 intentos.',
  trayectoria: 'Mirá los clubes por los que pasó y adiviná el jugador. 6 intentos, con pistas.',
  rayoexi: '10 integrantes en 20 segundos: ¿de qué clan es cada uno? Con 9 o más sacás los 3 puntos.',
  grilla: 'Completá la grilla 2×2 con jugadores que cumplan fila y columna. 6 intentos.',
  quiz: '3 preguntas de opción múltiple. Cada acierto suma un punto.',
}

function Hints({ hints }: { hints: Array<{ label: string; value: string }> }) {
  if (hints.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {hints.map((h) => (
        <span key={h.label} className="flex items-center gap-1 rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-300">
          <Lightbulb className="h-3 w-3" /> {h.label}: <b>{h.value}</b>
        </span>
      ))}
    </div>
  )
}

function Attempts({ guesses, max }: { guesses: Array<{ name: string; ok: boolean }>; max: number }) {
  return (
    <div className="space-y-1.5">
      {guesses.map((g) => (
        <div
          key={g.name}
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${g.ok ? 'border-green-500 bg-green-500/10' : 'border-red-500/40 bg-red-500/5'}`}
        >
          {g.ok ? <Check className="h-4 w-4 text-green-400" /> : <X className="h-4 w-4 text-red-400" />}
          {g.name}
        </div>
      ))}
      <p className="text-right text-[11px] text-zinc-500">
        {guesses.length}/{max} intentos
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Wordle
// ---------------------------------------------------------------------------

function WordleRound({ c, busy, onMove }: { c: Extract<GameCurrent, { kind: 'wordle' }>; busy: boolean; onMove: OnMove }) {
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const status = new Map<string, Letter>()
  for (const g of c.guesses) {
    g.word.split('').forEach((letter, i) => {
      const prev = status.get(letter)
      if (!prev || PRIORITY[g.result[i]] > PRIORITY[prev]) status.set(letter, g.result[i])
    })
  }

  const submit = useCallback(async () => {
    if (typed.length !== c.length || busy) return
    setError('')
    const guess = typed
    const r = await onMove({ guess })
    if (r === null) setError('No se pudo enviar. Probá con otra palabra.')
    else setTyped('')
  }, [typed, c.length, busy, onMove])

  const press = useCallback(
    (key: string) => {
      if (busy) return
      if (key === 'ENTER') return void submit()
      if (key === 'BACK') return setTyped((t) => t.slice(0, -1))
      const letter = key === 'Ñ' ? 'N' : key
      if (/^[A-Z]$/.test(letter)) setTyped((t) => (t.length < c.length ? t + letter : t))
    },
    [busy, submit, c.length]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (e.key === 'Enter') press('ENTER')
      else if (e.key === 'Backspace') press('BACK')
      else if (e.key.length === 1) press(e.key.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press])

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm">
        <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" /> <span className="text-zinc-400">Pista:</span> {c.hint}
      </p>
      <div className="flex flex-col items-center gap-1.5">
        {Array.from({ length: c.maxAttempts }).map((_, row) => {
          const guess = c.guesses[row]
          const isCurrent = row === c.guesses.length
          return (
            <div key={row} className="flex gap-1.5">
              {Array.from({ length: c.length }).map((__, col) => {
                const letter = guess ? guess.word[col] : isCurrent ? typed[col] ?? '' : ''
                const color = guess ? CELL[guess.result[col]] : letter ? 'border-primary/70' : 'border-white/15'
                return (
                  <div key={col} className={`flex h-11 w-11 items-center justify-center rounded-md border-2 text-xl font-bold sm:h-12 sm:w-12 ${color}`}>
                    {letter}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      {error && <p className="text-center text-xs text-red-300">{error}</p>}
      <div className="select-none space-y-1.5">
        {KEY_ROWS.map((row, i) => (
          <div key={row} className="flex justify-center gap-1">
            {i === 2 && (
              <button onClick={() => press('ENTER')} disabled={busy} className="h-11 rounded bg-primary px-2 text-[11px] font-bold sm:px-3">
                ENVIAR
              </button>
            )}
            {row.split('').map((k) => {
              const s = status.get(k === 'Ñ' ? 'N' : k)
              return (
                <button key={k} onClick={() => press(k)} className={`h-11 w-[8.6vw] max-w-9 rounded text-sm font-bold ${s ? CELL[s] : 'bg-white/10 hover:bg-white/20'}`}>
                  {k}
                </button>
              )
            })}
            {i === 2 && (
              <button onClick={() => press('BACK')} className="flex h-11 items-center rounded bg-white/10 px-2 hover:bg-white/20 sm:px-3" aria-label="Borrar">
                <Delete className="h-5 w-5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Escudo borroso
// ---------------------------------------------------------------------------

function PixelCrest({ src, pixels }: { src: string; pixels: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const image = new Image()
    image.onload = () => setImg(image)
    image.onerror = () => setFailed(true)
    image.src = src
  }, [src])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !img) return
    const size = canvas.width
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, size, size)
    const scale = Math.min(size / img.width, size / img.height)
    const w = img.width * scale
    const h = img.height * scale
    const x = (size - w) / 2
    const y = (size - h) / 2
    const small = document.createElement('canvas')
    small.width = pixels
    small.height = pixels
    const sctx = small.getContext('2d')
    if (!sctx) return
    sctx.drawImage(img, (x / size) * pixels, (y / size) * pixels, (w / size) * pixels, (h / size) * pixels)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(small, 0, 0, pixels, pixels, 0, 0, size, size)
  }, [img, pixels])

  if (failed) return <p className="text-center text-sm text-red-300">No se pudo cargar el escudo. Recargá la página.</p>
  return <canvas ref={canvasRef} width={240} height={240} className="mx-auto h-44 w-44 rounded-lg bg-white/5 sm:h-52 sm:w-52" style={{ imageRendering: 'pixelated' }} />
}

function EscudoRound({ c, matchId, busy, onMove }: { c: Extract<GameCurrent, { kind: 'escudo' }>; matchId: number; busy: boolean; onMove: OnMove }) {
  return (
    <div className="space-y-4">
      <PixelCrest src={`/api/torneo/partido/${matchId}/escudo?r=${c.roundIndex}`} pixels={c.pixels} />
      <p className="text-center text-xs text-zinc-400">Cada error lo muestra más claro. Al tercer error aparece el país.</p>
      <Hints hints={c.hints} />
      <MinigameSearch options={c.options} exclude={c.guesses.map((g) => g.name)} placeholder="Escribí el club..." disabled={busy} onPick={(guess) => void onMove({ guess })} />
      <Attempts guesses={c.guesses} max={c.maxAttempts} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trayectoria
// ---------------------------------------------------------------------------

function TrayectoriaRound({ c, busy, onMove }: { c: Extract<GameCurrent, { kind: 'trayectoria' }>; busy: boolean; onMove: OnMove }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-400">Clubes en orden</p>
      <div className="flex flex-wrap items-start gap-1.5">
        {c.clubs.map((club, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="flex w-[70px] flex-col items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-1 py-2 text-center">
              {club.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={club.image} alt="" loading="lazy" className="h-9 w-9 object-contain" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center text-xl">🛡️</span>
              )}
              <span className="text-[10px] font-medium leading-tight">{club.name}</span>
            </span>
            {i < c.clubs.length - 1 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
          </span>
        ))}
      </div>
      <Hints hints={c.hints} />
      <p className="text-[11px] text-zinc-500">Al segundo error aparece la nacionalidad y al cuarto, la posición.</p>
      <MinigameSearch options={c.options} exclude={c.guesses.map((g) => g.name)} placeholder="Escribí el jugador..." disabled={busy} onPick={(guess) => void onMove({ guess })} />
      <Attempts guesses={c.guesses} max={c.maxAttempts} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ¿Rayo o Exi?
// ---------------------------------------------------------------------------

function RayoExiRound({ c, busy, onMove }: { c: Extract<GameCurrent, { kind: 'rayoexi' }>; busy: boolean; onMove: OnMove }) {
  const [answers, setAnswers] = useState<Array<'rayo' | 'exiliados' | null>>(() => c.names.map(() => null))
  const [deadline] = useState(() => Date.now() + c.remainingMs)
  const [now, setNow] = useState(() => Date.now())
  const sent = useRef(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [])

  const current = answers.findIndex((a) => a === null)
  const remaining = Math.max(0, deadline - now)

  const send = useCallback(
    (final: Array<'rayo' | 'exiliados' | null>) => {
      if (sent.current) return
      sent.current = true
      void onMove({ answers: final })
    },
    [onMove]
  )

  useEffect(() => {
    if (remaining <= 0 || current === -1) send(answers)
  }, [remaining, current, answers, send])

  const choose = useCallback(
    (clan: 'rayo' | 'exiliados') => {
      if (current === -1 || remaining <= 0 || sent.current) return
      setAnswers((prev) => {
        const next = [...prev]
        next[current] = clan
        return next
      })
    },
    [current, remaining]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') choose('rayo')
      else if (e.key === 'ArrowRight') choose('exiliados')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choose])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">
          {Math.min(current === -1 ? c.names.length : current + 1, c.names.length)}/{c.names.length}
        </span>
        <span className={`font-mono font-bold ${remaining < 7000 ? 'text-red-400' : 'text-primary'}`}>{(remaining / 1000).toFixed(1)}s</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-white/10">
        <div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${(remaining / (c.limitSec * 1000)) * 100}%` }} />
      </div>
      <p className="break-words py-5 text-center text-3xl font-bold">{current === -1 ? 'Enviando...' : c.names[current]}</p>
      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" variant="outline" className="h-16 border-white/20 bg-white/5 text-lg hover:bg-white/10" disabled={busy} onClick={() => choose('rayo')}>
          ← Rayo
        </Button>
        <Button size="lg" className="h-16 text-lg" disabled={busy} onClick={() => choose('exiliados')}>
          Exiliados →
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Grilla 2×2
// ---------------------------------------------------------------------------

function Header({ h }: { h: HeaderInfo }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-1 text-center">
      {h.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={h.image} alt={h.label} loading="lazy" className={h.type === 'nation' ? 'h-auto w-10 rounded-sm shadow' : 'h-9 w-9 object-contain'} />
      ) : (
        <span className="text-xl">{h.label.includes('Balón') ? '🥇' : '🏆'}</span>
      )}
      <span className="text-[10px] font-bold leading-tight text-primary">{h.label}</span>
    </div>
  )
}

function GrillaRound({ c, busy, onMove }: { c: Extract<GameCurrent, { kind: 'grilla' }>; busy: boolean; onMove: OnMove }) {
  const [selected, setSelected] = useState<number | null>(null)
  const used = c.cells.filter(Boolean) as string[]
  return (
    <div className="space-y-4">
      <div className="mx-auto grid max-w-sm grid-cols-[minmax(0,0.8fr)_repeat(2,minmax(0,1fr))] gap-2">
        <div />
        {c.cols.map((h) => (
          <div key={h.label} className="flex items-end justify-center">
            <Header h={h} />
          </div>
        ))}
        {c.rows.map((row, r) => (
          <div key={row.label} className="contents">
            <div className="flex items-center justify-center">
              <Header h={row} />
            </div>
            {[0, 1].map((col) => {
              const cell = r * 2 + col
              const value = c.cells[cell]
              return (
                <button
                  key={cell}
                  disabled={!!value}
                  onClick={() => setSelected(selected === cell ? null : cell)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-lg border-2 p-1 text-center text-xs font-semibold transition-colors ${
                    value ? 'border-green-600 bg-green-600/15' : selected === cell ? 'border-primary bg-primary/15' : 'border-white/15 hover:border-primary/60'
                  }`}
                >
                  {value ?? '+'}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      {selected === null ? (
        <p className="text-center text-xs text-zinc-400">Tocá una casilla y escribí un jugador. Cada intento cuenta, acierte o no.</p>
      ) : (
        <MinigameSearch
          options={c.players}
          exclude={used}
          placeholder="Buscá un jugador..."
          disabled={busy}
          onPick={async (player) => {
            const r = (await onMove({ cell: selected, player })) as { feedback?: { ok?: boolean } } | null
            if (r?.feedback?.ok) setSelected(null)
          }}
        />
      )}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          {c.tries}/{c.maxAttempts} intentos
        </span>
        <button className="flex items-center gap-1 text-zinc-400 hover:text-white" disabled={busy} onClick={() => void onMove({ giveUp: true })}>
          <Flag className="h-3.5 w-3.5" /> Terminar
        </button>
      </div>
      {c.wrong.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {c.wrong.map((w, i) => (
            <span key={i} className="rounded bg-red-500/15 px-2 py-0.5 text-[11px] text-red-300">
              {w}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function GameRound({ current, matchId, busy, onMove }: { current: GameCurrent; matchId: number; busy: boolean; onMove: OnMove }) {
  switch (current.kind) {
    case 'wordle':
      return <WordleRound key={current.roundIndex} c={current} busy={busy} onMove={onMove} />
    case 'escudo':
      return <EscudoRound key={current.roundIndex} c={current} matchId={matchId} busy={busy} onMove={onMove} />
    case 'trayectoria':
      return <TrayectoriaRound key={current.roundIndex} c={current} busy={busy} onMove={onMove} />
    case 'rayoexi':
      return <RayoExiRound key={current.roundIndex} c={current} busy={busy} onMove={onMove} />
    case 'grilla':
      return <GrillaRound key={current.roundIndex} c={current} busy={busy} onMove={onMove} />
  }
}

// Resultado de una ronda de juego recién terminada.
export function RoundReveal({
  name,
  kind,
  score,
  feedback,
  onContinue,
  last,
}: {
  name: string
  kind: string
  score: number
  feedback: Record<string, unknown> | undefined
  onContinue: () => void
  last: boolean
}) {
  const detail =
    kind === 'wordle' || kind === 'escudo' || kind === 'trayectoria'
      ? feedback?.won
        ? `¡Acertaste! Era ${feedback.answer}`
        : `No salió. Era ${feedback?.answer}`
      : kind === 'rayoexi'
        ? feedback?.late
          ? 'Se acabó el tiempo.'
          : `${feedback?.correct} de ${feedback?.total} correctas`
        : `${feedback?.filled} de 4 casillas completadas`
  return (
    <motion.div className="space-y-4 py-4 text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
      <p className="text-xs tracking-[0.4em] text-amber-300">{name.toUpperCase()}</p>
      <p className="text-6xl font-black">
        {score}
        <span className="text-2xl text-zinc-500">/3</span>
      </p>
      <p className={score >= 2 ? 'font-bold text-green-400' : score === 1 ? 'font-bold text-amber-300' : 'font-bold text-red-400'}>{detail}</p>
      <Button size="lg" className="gap-2 px-8 font-black" onClick={onContinue}>
        {last ? 'Ver mi partido' : 'Siguiente ronda'} <ChevronRight className="h-5 w-5" />
      </Button>
    </motion.div>
  )
}
