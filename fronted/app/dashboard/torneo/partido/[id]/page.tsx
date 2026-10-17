'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Flag, formatDay } from '@/components/torneo/shared'
import { GAME_INTRO, GAME_LABELS, GameRound, RoundReveal, RoundTimer, type GameCurrent } from '@/components/torneo/game-rounds'
import { ArrowLeft, Check, ChevronRight, Lock, RefreshCw, ShieldAlert, Timer, X } from 'lucide-react'

interface Side {
  slot: number
  isBot: boolean
  name: string
  countryCode: string
  clan: string | null
  pot: number
  group: string
  cardUrl: string
  groupStats: { pj: number; pts: number; dg: number } | null
  groupPosition: number | null
  form: Array<'G' | 'E' | 'P'>
}

interface QuizCurrent {
  kind: 'quiz'
  roundIndex: number
  questionIndex: number
  prompt: string
  options: string[]
  image: string | null
  clubs: Array<{ name: string; image: string | null }> | null
}

interface MatchState {
  torneoName: string
  partido: {
    id: number
    stage: string
    stageLabel: string
    group: string | null
    matchday: number | null
    opensDay: string
    closesDay: string
    status: 'pendiente' | 'jugado'
    homeGoals: number | null
    awayGoals: number | null
    homePens: number | null
    awayPens: number | null
    winnerSlot: number | null
    homeLabel: string | null
    awayLabel: string | null
  }
  home: Side | null
  away: Side | null
  mySide: 'home' | 'away' | null
  open: boolean
  questionsPerRound: number
  play: {
    started: boolean
    finished: boolean
    roundActive: boolean
    strikes?: number
    roundNames: string[]
    rounds: number[]
    roundKinds?: string[]
    roundLimits?: number[]
    current: (QuizCurrent | GameCurrent) & { name?: string; timer?: { limitSec: number; remainingMs: number } } | null
    opponentFinished: boolean
  } | null
  result: {
    homeAbsent: boolean
    awayAbsent: boolean
    rounds: Array<{ name: string; home: number | null; away: number | null }>
  } | null
}

const FORM_STYLE = { G: 'bg-green-600', E: 'bg-zinc-500', P: 'bg-red-600' }

// Un lado del cara a cara: la carta del integrante si tiene, si no la bandera.
function VsSide({ side, align, winner }: { side: Side | null; align: 'left' | 'right'; winner: boolean }) {
  if (!side) return <div className="flex-1" />
  return (
    <motion.div
      className={`flex-1 min-w-0 flex flex-col items-center gap-2 sm:gap-3 ${align === 'left' ? 'sm:items-end' : 'sm:items-start'}`}
      initial={{ x: align === 'left' ? -160 : 160, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 90, damping: 16, delay: 0.15 }}
    >
      <div
        className={`relative w-[7.5rem] sm:w-56 aspect-[3/4] overflow-hidden rounded-xl border-2 bg-zinc-900 ${
          winner ? 'border-amber-300 shadow-[0_0_50px_rgba(251,191,36,0.45)]' : 'border-white/15'
        }`}
      >
        {side.cardUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={side.cardUrl} alt={side.name} className="w-full h-full object-contain bg-black" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-800 to-black p-3">
            <Flag code={side.countryCode} className="w-16 sm:w-32 rounded shadow-lg" />
            <span className="text-3xl sm:text-5xl">{side.isBot ? '🤖' : '⚽'}</span>
          </div>
        )}
      </div>
      <div className={`text-center ${align === 'left' ? 'sm:text-right' : 'sm:text-left'} min-w-0 max-w-full`}>
        <p className="text-base sm:text-3xl font-black text-white break-words leading-tight">{side.name}</p>
        <p className="text-[10px] sm:text-xs text-zinc-400">
          {side.isBot ? '🤖 Bot' : side.clan === 'rayo' ? '⚡ Rayo' : side.clan === 'exiliados' ? '⚔️ Exiliados' : ''} · Bombo {side.pot}
          {side.groupPosition && side.groupStats && side.groupStats.pj > 0 ? ` · ${side.groupPosition}º del grupo ${side.group} (${side.groupStats.pts} pts)` : ''}
        </p>
        {side.form.length > 0 && (
          <div className={`mt-1.5 flex gap-1 justify-center ${align === 'left' ? 'sm:justify-end' : 'sm:justify-start'}`}>
            {side.form.map((f, i) => (
              <span key={i} className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center text-white ${FORM_STYLE[f]}`}>
                {f}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function PartidoPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [state, setState] = useState<MatchState | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Corrección de la última respuesta, visible un momento antes de seguir.
  const [feedback, setFeedback] = useState<{ chosen: number; correctIndex: number; question: NonNullable<MatchState['play']>['current'] } | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const load = useCallback(() => {
    fetch(`/api/torneo/partido/${params.id}`)
      .then((r) => r.json())
      .then((r) => (r.success ? setState(r.data) : setError(r.error || 'No se pudo cargar el partido')))
      .catch(() => setError('Error cargando el partido'))
  }, [params.id])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  // Mientras espera al rival, revisa cada 30 segundos si ya terminó.
  const waiting = !!state?.play?.finished && state.partido.status === 'pendiente'
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [waiting, load])

  const [notice, setNotice] = useState('')
  const fmtLimit = (sec: number) => (sec < 60 ? `${sec} segundos` : sec % 60 === 0 ? `${sec / 60} ${sec === 60 ? 'minuto' : 'minutos'}` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} minutos`)

  const start = async () => {
    setNotice('')
    setBusy(true)
    setError('')
    try {
      const r = await (await fetch(`/api/torneo/partido/${params.id}/empezar`, { method: 'POST' })).json()
      if (r.success) setState(r.data)
      else setError(r.error || 'No se pudo empezar')
    } catch {
      setError('Error de conexión')
    } finally {
      setBusy(false)
    }
  }

  // Resultado de la ronda de juego que se acaba de terminar: se muestra antes
  // de pasar a la siguiente.
  const [reveal, setReveal] = useState<{
    name: string
    kind: string
    score: number
    feedback: Record<string, unknown> | undefined
    next: MatchState
    last: boolean
  } | null>(null)

  // Una jugada de una ronda de juego (intento, casilla, respuestas...).
  const act = async (body: Record<string, unknown>) => {
    if (busy) return null
    const cur = state?.play?.current
    setBusy(true)
    setError('')
    try {
      const r = await (
        await fetch(`/api/torneo/partido/${params.id}/jugada`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      ).json()
      if (!r.success) {
        setError(r.error || 'No se pudo registrar la jugada')
        return null
      }
      if (r.data.roundDone && cur && cur.kind !== 'quiz') {
        setReveal({
          name: cur.name ?? GAME_LABELS[cur.kind],
          kind: cur.kind,
          score: r.data.roundScore ?? 0,
          feedback: r.data.feedback,
          next: r.data.state,
          last: !!r.data.finished,
        })
      } else {
        if (r.data.timedOut && cur) setNotice(`⏰ Se acabó el tiempo en «${cur.name ?? 'la ronda'}»: sumaste ${r.data.roundScore ?? 0}/3`)
        setState(r.data.state)
      }
      return r.data
    } catch {
      setError('Error de conexión')
      return null
    } finally {
      setBusy(false)
    }
  }

  // Anti trampa: si sale de la ventana en plena ronda, la primera vez es un
  // aviso y después pierde la ronda (lo decide el servidor).
  const [cheat, setCheat] = useState<{ strikes: number; lost: boolean; roundName: string } | null>(null)
  const roundLive = !!state && state.open && state.partido.status === 'pendiente' && !!state.play?.roundActive && !reveal
  const liveRef = useRef(false)
  liveRef.current = roundLive
  useEffect(() => {
    let away = false
    // Recargar o cerrar la página también dispara "visibilitychange": no es trampa.
    let unloading = false
    const onUnload = () => {
      unloading = true
    }
    const report = async () => {
      try {
        const r = await (await fetch(`/api/torneo/partido/${params.id}/trampa`, { method: 'POST', keepalive: true })).json()
        if (r.success) {
          setCheat({ strikes: r.data.strikes, lost: r.data.lost, roundName: r.data.roundName ?? '' })
          setFeedback(null)
          setState(r.data.state)
        }
      } catch {
        // sin conexión: no se puede registrar
      }
    }
    const leave = () => {
      if (!liveRef.current || away || unloading) return
      away = true
      report()
    }
    const back = () => {
      away = false
    }
    const onVisibility = () => (document.visibilityState === 'hidden' ? leave() : back())
    const onFocus = () => {
      if (document.visibilityState === 'visible') back()
    }
    window.addEventListener('beforeunload', onUnload)
    window.addEventListener('pagehide', onUnload)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', leave)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      window.removeEventListener('pagehide', onUnload)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', leave)
      window.removeEventListener('focus', onFocus)
    }
  }, [params.id])

  const answer = async (index: number) => {
    if (busy || !state?.play?.current) return
    const question = state.play.current
    setBusy(true)
    setError('')
    try {
      const r = await (
        await fetch(`/api/torneo/partido/${params.id}/responder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer: index }),
        })
      ).json()
      if (!r.success) {
        setError(r.error || 'No se pudo registrar la respuesta')
        return
      }
      if (r.data.timedOut || !r.data.feedback) {
        setNotice(`⏰ Se acabó el tiempo en «${state.play.roundNames[state.play.rounds.length] ?? 'la ronda'}»: sumaste ${r.data.roundScore ?? 0}/3`)
        setState(r.data.state)
        return
      }
      setFeedback({ chosen: index, correctIndex: r.data.feedback.correctIndex, question })
      setTimeout(() => {
        setFeedback(null)
        setState(r.data.state)
      }, 1100)
    } catch {
      setError('Error de conexión')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const p = state?.partido
  const play = state?.play
  const result = state?.result
  const label = p ? (p.stage === 'G' ? `Fecha ${p.matchday} · Grupo ${p.group}` : p.stageLabel) : ''
  const shownAny = feedback?.question ?? play?.current ?? null
  const shown = shownAny && shownAny.kind === 'quiz' ? shownAny : null
  const gameCurrent = play?.current && play.current.kind !== 'quiz' && !reveal ? (play.current as GameCurrent & { name?: string }) : null

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Fondo de estadio */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-1/3 -left-1/4 w-[70vw] h-[70vw] rounded-full bg-[radial-gradient(circle,rgba(220,38,38,0.3),transparent_60%)]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.15),transparent_60%)]" />
      </div>

      <AnimatePresence>
        {cheat && (
          <motion.div
            key="cheat"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl border-2 border-red-500 bg-zinc-950 p-6 text-center shadow-[0_0_60px_rgba(239,68,68,0.45)]"
              initial={{ scale: 0.7, rotate: -3 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 15 }}
            >
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.9, repeat: Infinity }}>
                <ShieldAlert className="mx-auto h-16 w-16 text-red-500" />
              </motion.div>
              <p className="mt-3 text-xs font-bold tracking-[0.35em] text-red-400">{cheat.lost ? 'RONDA PERDIDA' : 'ADVERTENCIA'}</p>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">¡Cambiaste de ventana!</h2>
              <p className="mt-3 text-sm text-zinc-300">No se permite hacer trampa.</p>
              {cheat.lost ? (
                <p className="mt-2 text-sm text-zinc-300">
                  Ya habías recibido una advertencia, así que perdiste la ronda{cheat.roundName ? <b> «{cheat.roundName}»</b> : null} (0 puntos). Cada vez que salgas de la ventana en plena ronda
                  perderás la que estés jugando.
                </p>
              ) : (
                <p className="mt-2 text-sm text-zinc-300">
                  Esta es tu única advertencia: <b className="text-red-300">la próxima vez que salgas de la ventana perderás la ronda</b>.
                </p>
              )}
              <Button size="lg" className="mt-5 w-full font-black" onClick={() => setCheat(null)}>
                {cheat.lost ? 'Continuar' : 'Entendido, sigo jugando'}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="relative z-10 border-b border-white/10 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard/torneo">
            <Button variant="ghost" size="icon" className="hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.4em] text-amber-300 uppercase truncate">{state?.torneoName ?? 'Mundial Exiliados'}</p>
            <h1 className="text-xl font-black truncate">{label || 'Partido'}</h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-6 sm:py-10 space-y-8 max-w-5xl">
        {error && <div className="bg-destructive/15 border border-destructive/30 rounded-lg p-3 text-red-300 text-sm">{error}</div>}
        {!state && !error && <div className="h-80 rounded-2xl bg-white/5 animate-pulse" />}

        {state && p && (
          <>
            {/* Cara a cara */}
            <section className="flex flex-row items-start gap-2 sm:gap-4">
              <VsSide side={state.home} align="left" winner={p.status === 'jugado' && p.winnerSlot === state.home?.slot} />
              <motion.div
                className="flex flex-col items-center justify-center self-start mt-16 sm:mt-0 sm:self-center shrink-0"
                initial={{ scale: 3, opacity: 0, rotate: -12 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.55 }}
              >
                {p.status === 'jugado' ? (
                  <div className="text-center">
                    <p className="text-3xl sm:text-7xl font-black tabular-nums whitespace-nowrap">
                      {p.homeGoals}
                      <span className="text-zinc-500 mx-1 sm:mx-2">-</span>
                      {p.awayGoals}
                    </p>
                    {p.homePens !== null && (
                      <p className="text-xs text-zinc-400 mt-1">
                        Desempate por aciertos {p.homePens}-{p.awayPens}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] tracking-[0.3em] text-zinc-400">FINAL</p>
                  </div>
                ) : (
                  <div className="relative">
                    <motion.div
                      className="absolute inset-0 rounded-full bg-primary blur-2xl"
                      animate={{ opacity: [0.4, 0.9, 0.4] }}
                      transition={{ duration: 1.6, repeat: Infinity }}
                    />
                    <p className="relative text-4xl sm:text-8xl font-black italic text-primary drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]">VS</p>
                  </div>
                )}
              </motion.div>
              <VsSide side={state.away} align="right" winner={p.status === 'jugado' && p.winnerSlot === state.away?.slot} />
            </section>

            <p className="text-center text-xs text-zinc-400">
              {p.status === 'jugado' ? 'Partido terminado' : `Se juega del ${formatDay(p.opensDay)} al ${formatDay(p.closesDay)}`}
              {' · '}5 rondas (3 minijuegos y 2 de preguntas): cada ronda ganada es un gol
            </p>

            {/* Mi partida */}
            {play && p.status === 'pendiente' && (
              <Card className="relative overflow-hidden border-white/10 bg-white/[0.04] p-5 sm:p-8 text-white">
                {!state.open && !play.finished && (
                  <p className="text-center text-zinc-300">
                    Este partido abre el <b>{formatDay(p.opensDay)}</b>. ¡Preparate!
                  </p>
                )}

                {state.open && !play.started && (
                  <div className="text-center space-y-4">
                    <p className="text-3xl font-black">¿Listo para el partido?</p>
                    <p className="text-sm text-zinc-400 max-w-lg mx-auto">
                      Vas a jugar 5 rondas: 3 minijuegos y 2 de preguntas ({play.roundNames.join(', ')}). Cada ronda da de 0 a 3
                      puntos y la gana quien saque más: eso es un gol. Si empatan la ronda, nadie mete gol. El tiempo de cada ronda
                      cuenta para el desempate en eliminatorias, y podés hacer una pausa entre ronda y ronda. Cada ronda tiene su cronómetro (de 20 segundos a 2:30 minutos según el juego): cuando se acaba, la ronda se cierra con lo que lleves.
                    </p>
                    <p className="mx-auto flex max-w-lg items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-left text-xs text-red-200">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <b>Anti trampa:</b> durante una ronda no puedes cambiar de ventana ni de pestaña. La primera vez recibes una advertencia y,
                        si vuelve a pasar, pierdes la ronda que estés jugando.
                      </span>
                    </p>
                    <Button size="lg" className="px-10 text-lg font-black" disabled={busy} onClick={start}>
                      ¡EMPEZAR PARTIDO!
                    </Button>
                  </div>
                )}

                {state.open && play.started && !play.finished && !play.roundActive && !feedback && !reveal && (
                  <motion.div className="text-center space-y-4" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    <p className="text-xs tracking-[0.4em] text-amber-300">RONDA {play.rounds.length + 1} DE 5</p>
                    <p className="text-3xl sm:text-4xl font-black">{play.roundNames[play.rounds.length]}</p>
                    {play.roundKinds?.[play.rounds.length] && (
                      <p className="mx-auto max-w-md text-sm text-zinc-400">{GAME_INTRO[play.roundKinds[play.rounds.length]]}</p>
                    )}
                    {play.roundLimits?.[play.rounds.length] && (
                      <p className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-sm font-bold text-amber-200">
                        <Timer className="h-4 w-4" /> Tienes {fmtLimit(play.roundLimits[play.rounds.length])} para esta ronda
                      </p>
                    )}
                    {play.rounds.length > 0 && (
                      <p className="text-sm text-zinc-400">
                        Tus rondas hasta ahora: {play.rounds.map((r) => `${r}/3`).join(' · ')}
                      </p>
                    )}
                    <Button size="lg" className="px-10 font-black gap-2" disabled={busy} onClick={start}>
                      Empezar ronda {play.rounds.length + 1} <ChevronRight className="w-5 h-5" />
                    </Button>
                  </motion.div>
                )}

                {reveal && (
                  <RoundReveal
                    name={reveal.name}
                    kind={reveal.kind}
                    score={reveal.score}
                    feedback={reveal.feedback}
                    last={reveal.last}
                    onContinue={() => {
                      setState(reveal.next)
                      setReveal(null)
                    }}
                  />
                )}

                {play.roundActive && !reveal && (
                  <p
                    className={`mb-4 flex items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-center text-xs ${
                      (play.strikes ?? 0) > 0 ? 'border-red-500/50 bg-red-500/15 text-red-200' : 'border-white/10 bg-white/5 text-zinc-400'
                    }`}
                  >
                    {(play.strikes ?? 0) > 0 ? <ShieldAlert className="h-4 w-4 shrink-0" /> : <Lock className="h-4 w-4 shrink-0" />}
                    {(play.strikes ?? 0) > 0
                      ? 'Ya usaste tu advertencia: si sales de la ventana otra vez, pierdes la ronda'
                      : 'Anti trampa activo: no cambies de ventana durante la ronda'}
                  </p>
                )}

                {play.roundActive && !reveal && play.current?.timer && play.current.kind !== 'rayoexi' && (
                  <div className="mb-4">
                    <RoundTimer
                      key={`timer-${play.current.roundIndex}`}
                      limitSec={play.current.timer.limitSec}
                      remainingMs={play.current.timer.remainingMs}
                      onExpire={() => void act({ tick: true })}
                    />
                  </div>
                )}

                {notice && !reveal && (
                  <p className="mb-4 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-center text-sm font-semibold text-amber-200">{notice}</p>
                )}

                {gameCurrent && (
                  <motion.div key={`game-${gameCurrent.roundIndex}`} className="space-y-4" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}>
                    <p className="text-xs font-bold tracking-[0.2em] text-amber-300">
                      RONDA {gameCurrent.roundIndex + 1} · {gameCurrent.name ?? GAME_LABELS[gameCurrent.kind]}
                    </p>
                    <GameRound current={gameCurrent} matchId={p.id} busy={busy} onMove={act} />
                  </motion.div>
                )}

                {shown && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${shown.roundIndex}-${shown.questionIndex}`}
                      className="space-y-5"
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -40 }}
                    >
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span className="font-bold tracking-[0.2em] text-amber-300">
                          RONDA {shown.roundIndex + 1} · {play?.roundNames[shown.roundIndex]}
                        </span>
                        <span>
                          Pregunta {shown.questionIndex + 1}/{state.questionsPerRound}
                        </span>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold">{shown.prompt}</p>
                      {shown.image && (
                        <div className="flex justify-center">
                          {/* Desenfocado: muchos escudos traen el nombre escrito. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={shown.image} alt="Escudo" className="w-32 h-32 sm:w-40 sm:h-40 object-contain blur-[4px] drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]" />
                        </div>
                      )}
                      {shown.clubs && (
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {shown.clubs.map((c, i) => (
                            <span key={i} className="flex items-center gap-1.5">
                              <span className="flex flex-col items-center gap-1 w-[70px] rounded-lg border border-white/15 bg-white/5 px-1 py-2 text-center">
                                {c.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={c.image} alt="" className="w-9 h-9 object-contain" />
                                ) : (
                                  <span className="w-9 h-9 flex items-center justify-center">🛡️</span>
                                )}
                                <span className="text-[10px] leading-tight">{c.name}</span>
                              </span>
                              {i < shown.clubs!.length - 1 && <ChevronRight className="w-3 h-3 text-zinc-500" />}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className={`grid gap-2 ${shown.options.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2'}`}>
                        {shown.options.map((opt, i) => {
                          const isCorrect = feedback && i === feedback.correctIndex
                          const isWrong = feedback && i === feedback.chosen && feedback.chosen !== feedback.correctIndex
                          return (
                            <button
                              key={i}
                              disabled={busy || !!feedback}
                              onClick={() => answer(i)}
                              className={`flex items-center justify-between gap-2 rounded-xl border-2 px-4 py-3 text-left font-semibold transition-colors ${
                                isCorrect
                                  ? 'border-green-500 bg-green-500/20'
                                  : isWrong
                                    ? 'border-red-500 bg-red-500/20'
                                    : 'border-white/15 bg-white/5 hover:border-primary hover:bg-primary/15'
                              }`}
                            >
                              <span>{opt}</span>
                              {isCorrect && <Check className="w-5 h-5 text-green-400 shrink-0" />}
                              {isWrong && <X className="w-5 h-5 text-red-400 shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}

                {play.finished && !feedback && !reveal && (
                  <div className="text-center space-y-3">
                    <p className="text-3xl font-black">¡Terminaste tu partido!</p>
                    <div className="flex justify-center gap-2">
                      {play.rounds.map((r, i) => (
                        <div key={i} className="w-14 rounded-lg border border-white/15 bg-white/5 py-2">
                          <p className="text-[10px] text-zinc-400">R{i + 1}</p>
                          <p className="font-black">{r}/3</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-zinc-400">
                      {play.opponentFinished
                        ? 'Calculando el resultado...'
                        : `Esperando a tu rival. El resultado se revela cuando juegue (o al cerrar el partido el ${formatDay(p.closesDay)}).`}
                    </p>
                    <Button variant="outline" size="sm" className="gap-2 border-white/20 bg-white/5 hover:bg-white/10" onClick={load}>
                      <RefreshCw className="w-4 h-4" /> Actualizar
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {/* Resultado ronda por ronda */}
            {result && p.status === 'jugado' && (
              <Card className="border-white/10 bg-white/[0.04] p-5 sm:p-8 text-white">
                <p className="mb-4 text-center text-xs tracking-[0.4em] text-amber-300">RONDA POR RONDA</p>
                {result.homeAbsent || result.awayAbsent ? (
                  <p className="text-center text-zinc-300">
                    {result.homeAbsent && result.awayAbsent
                      ? 'Ninguno de los dos jugó el partido.'
                      : `${result.homeAbsent ? state.home?.name : state.away?.name} no se presentó: pierde 0-3.`}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {result.rounds.map((r, i) => {
                      const goal = r.home !== null && r.away !== null ? (r.home > r.away ? 'home' : r.away > r.home ? 'away' : null) : null
                      return (
                        <motion.div
                          key={i}
                          className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.9 + i * 0.45 }}
                        >
                          <span className="text-right text-sm">
                            {goal === 'home' && <span className="mr-2">⚽</span>}
                            <b className="tabular-nums">{r.home ?? '-'}</b>
                          </span>
                          <span className="text-center text-[11px] text-zinc-400 min-w-[120px]">
                            R{i + 1} · {r.name}
                          </span>
                          <span className="text-sm">
                            <b className="tabular-nums">{r.away ?? '-'}</b>
                            {goal === 'away' && <span className="ml-2">⚽</span>}
                          </span>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
                {p.winnerSlot !== null && (
                  <motion.p
                    className="mt-5 text-center text-lg font-black text-amber-300"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 3.4, type: 'spring' }}
                  >
                    🏆 Gana {p.winnerSlot === state.home?.slot ? state.home?.name : state.away?.name}
                  </motion.p>
                )}
                {p.winnerSlot === null && p.stage === 'G' && (
                  <motion.p
                    className="mt-5 text-center text-lg font-black text-zinc-300"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 3.4 }}
                  >
                    Empate
                  </motion.p>
                )}
              </Card>
            )}

            {!play && p.status === 'pendiente' && (
              <p className="text-center text-sm text-zinc-400">
                El resultado aparece cuando los dos terminen de jugar (o al cerrar el partido el {formatDay(p.closesDay)}).
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
