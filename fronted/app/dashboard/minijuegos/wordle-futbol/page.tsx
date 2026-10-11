'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MinigameStats, useCountdown } from '@/components/minigame-stats'
import { ArrowLeft, Copy, Delete, Lightbulb } from 'lucide-react'

type LetterResult = 'match' | 'present' | 'miss'

interface WordleState {
  day: string
  empty: boolean
  nextResetAt: string
  length: number
  maxAttempts: number
  hint: string
  guesses: { word: string; result: LetterResult[] }[]
  finished: boolean
  won: boolean
  answer: string | null
}

const GAME = 'wordle-futbol'
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM']
const CELL: Record<LetterResult, string> = {
  match: 'bg-green-600 border-green-600 text-white',
  present: 'bg-amber-500 border-amber-500 text-white',
  miss: 'bg-zinc-600 border-zinc-600 text-white',
}
const EMOJI: Record<LetterResult, string> = { match: '🟩', present: '🟨', miss: '⬛' }
const PRIORITY: Record<LetterResult, number> = { miss: 0, present: 1, match: 2 }

export default function WordleFutbolPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [state, setState] = useState<WordleState | null>(null)
  const [current, setCurrent] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [statsKey, setStatsKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const countdown = useCountdown(state?.nextResetAt)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    fetch(`/api/minigames/${GAME}`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setState(r.data)
        else setError(r.error || 'No se pudo cargar el juego')
      })
      .catch(() => setError('Error cargando el juego'))
  }, [user])

  const submit = useCallback(async () => {
    if (!state || state.finished || submitting) return
    if (current.length !== state.length) {
      setError(`La palabra tiene que tener ${state.length} letras`)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/minigames/${GAME}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guess: current }),
      })
      const r = await res.json()
      if (!r.success) {
        setError(r.error || 'No se pudo registrar la palabra')
        return
      }
      setState(r.data)
      setCurrent('')
      if (r.data.finished) setStatsKey((k) => k + 1)
    } catch {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }, [state, current, submitting])

  const press = useCallback(
    (key: string) => {
      if (!state || state.finished || submitting) return
      if (key === 'ENTER') return void submit()
      if (key === 'BACK') return setCurrent((c) => c.slice(0, -1))
      // La Ñ se juega como N, igual que normaliza el servidor.
      const letter = key === 'Ñ' ? 'N' : key
      if (/^[A-Z]$/.test(letter)) setCurrent((c) => (c.length < state.length ? c + letter : c))
    },
    [state, submitting, submit]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Enter') press('ENTER')
      else if (e.key === 'Backspace') press('BACK')
      else if (e.key.length === 1) {
        const k = e.key.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
        press(k)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press])

  const handleShare = async () => {
    if (!state) return
    const rows = state.guesses.map((g) => g.result.map((r) => EMOJI[r]).join(''))
    const score = state.won ? `${state.guesses.length}/${state.maxAttempts}` : `X/${state.maxAttempts}`
    const text = `Wordle futbolero · EXILIADOS ${state.day}\n${score}\n${rows.join('\n')}`
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

  // Mejor resultado conocido de cada letra, para pintar el teclado.
  const keyStatus = new Map<string, LetterResult>()
  for (const g of state?.guesses ?? []) {
    g.word.split('').forEach((letter, i) => {
      const prev = keyStatus.get(letter)
      if (!prev || PRIORITY[g.result[i]] > PRIORITY[prev]) keyStatus.set(letter, g.result[i])
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard/minijuegos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-primary truncate">Wordle futbolero</h1>
            <p className="text-sm text-muted-foreground">Adiviná la palabra del día en 6 intentos</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6 max-w-3xl">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm">{error}</div>
        )}

        {!state && !error && <div className="h-96 rounded-lg bg-card/50 border border-border/50 animate-pulse" />}

        {state && !state.empty && (
          <>
            <Card className="p-4 flex items-center gap-2 text-sm">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                <span className="text-muted-foreground">Pista:</span> {state.hint}
              </span>
            </Card>

            <div className="flex flex-col items-center gap-1.5">
              {Array.from({ length: state.maxAttempts }).map((_, row) => {
                const guess = state.guesses[row]
                const isCurrentRow = !state.finished && row === state.guesses.length
                return (
                  <div key={row} className="flex gap-1.5">
                    {Array.from({ length: state.length }).map((_, col) => {
                      const letter = guess ? guess.word[col] : isCurrentRow ? current[col] ?? '' : ''
                      const color = guess
                        ? CELL[guess.result[col]]
                        : letter
                          ? 'border-primary/70'
                          : 'border-border'
                      return (
                        <div
                          key={col}
                          className={`w-12 h-12 sm:w-14 sm:h-14 border-2 rounded-md flex items-center justify-center text-2xl font-bold uppercase ${color}`}
                        >
                          {letter}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {state.finished ? (
              <Card className={`p-6 text-center space-y-3 ${state.won ? 'border-green-500/50' : 'border-destructive/50'}`}>
                <p className={`text-xl font-bold ${state.won ? 'text-green-500' : 'text-destructive'}`}>
                  {state.won ? `¡Acertaste en ${state.guesses.length}!` : 'Se acabaron los intentos'}
                </p>
                <p>
                  La palabra era <span className="font-bold tracking-widest text-primary">{state.answer}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Próximo reto en <span className="font-mono font-bold">{countdown}</span>
                </p>
                <Button variant="outline" className="gap-2" onClick={handleShare}>
                  <Copy className="w-4 h-4" /> {copied ? '¡Copiado!' : 'Compartir resultado'}
                </Button>
              </Card>
            ) : (
              <div className="space-y-1.5 select-none">
                {KEY_ROWS.map((row, i) => (
                  <div key={row} className="flex justify-center gap-1">
                    {i === 2 && (
                      <button
                        onClick={() => press('ENTER')}
                        disabled={submitting}
                        className="px-2 sm:px-3 h-12 rounded bg-primary text-primary-foreground text-xs font-bold"
                      >
                        ENVIAR
                      </button>
                    )}
                    {row.split('').map((k) => {
                      const status = keyStatus.get(k === 'Ñ' ? 'N' : k)
                      return (
                        <button
                          key={k}
                          onClick={() => press(k)}
                          className={`w-7 sm:w-10 h-12 rounded text-sm font-bold ${status ? CELL[status] : 'bg-muted hover:bg-muted/70'}`}
                        >
                          {k}
                        </button>
                      )
                    })}
                    {i === 2 && (
                      <button
                        onClick={() => press('BACK')}
                        className="px-2 sm:px-3 h-12 rounded bg-muted hover:bg-muted/70 flex items-center"
                        aria-label="Borrar"
                      >
                        <Delete className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600" /> Letra en su lugar</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500" /> Está en otra posición</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-zinc-600" /> No está</span>
            </div>

            <MinigameStats game={GAME} refreshKey={statsKey} />
          </>
        )}
      </main>
    </div>
  )
}
