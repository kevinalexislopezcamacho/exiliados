'use client'

import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FastForward, SkipForward } from 'lucide-react'
import { Flag, type TorneoParticipante } from './shared'

// Ceremonia del sorteo, al estilo de los sorteos de Mundial: bombo de
// cristal con las bolitas, cada bolita cae, se abre, muestra al jugador, se
// revela su grupo y la tarjeta vuela a su lugar. Se ve la primera vez que
// cada integrante entra al torneo (y se puede volver a ver).

type Phase = 'intro' | 'pot' | 'shake' | 'drop' | 'open' | 'place' | 'finale'

const DURATION: Record<Exclude<Phase, 'finale'>, number> = {
  intro: 3600,
  pot: 2000,
  shake: 900,
  drop: 750,
  open: 1700,
  place: 950,
}

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

// Colores de las bolitas por bombo: oro, plata, bronce y rojo.
const POT_STYLE: Record<number, { ball: string; text: string; label: string }> = {
  1: { ball: 'from-yellow-200 via-amber-400 to-amber-700', text: 'text-amber-950', label: 'text-amber-300' },
  2: { ball: 'from-white via-zinc-300 to-zinc-500', text: 'text-zinc-900', label: 'text-zinc-200' },
  3: { ball: 'from-orange-200 via-orange-500 to-orange-800', text: 'text-orange-950', label: 'text-orange-300' },
  4: { ball: 'from-red-300 via-red-600 to-red-900', text: 'text-white', label: 'text-red-400' },
}

function hash(n: number) {
  let x = (n + 1) * 2654435761
  x ^= x >>> 13
  x = Math.imul(x, 1597334677)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

function Ball({ slot, pot, size = 'sm' }: { slot: number; pot: number; size?: 'sm' | 'lg' }) {
  const style = POT_STYLE[pot]
  return (
    <div
      className={`rounded-full bg-gradient-to-br ${style.ball} shadow-[inset_-6px_-8px_14px_rgba(0,0,0,0.35),0_4px_12px_rgba(0,0,0,0.6)] flex items-center justify-center font-black ${style.text} ${
        size === 'lg' ? 'w-28 h-28 text-4xl' : 'w-8 h-8 sm:w-9 sm:h-9 text-xs'
      }`}
      data-slot={slot}
    >
      <span className="opacity-80">{pot}</span>
    </div>
  )
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 110 }, (_, i) => ({
        left: hash(i) * 100,
        delay: hash(i + 500) * 1.6,
        duration: 2.6 + hash(i + 900) * 2.4,
        rotate: (hash(i + 1300) - 0.5) * 900,
        color: ['#ef4444', '#f59e0b', '#fafafa', '#22c55e', '#dc2626', '#fde68a'][i % 6],
        w: 6 + hash(i + 1700) * 8,
      })),
    []
  )
  return (
    <div className="pointer-events-none fixed inset-0 z-[120] overflow-hidden">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block rounded-sm"
          style={{ left: `${p.left}%`, width: p.w, height: p.w * 0.45, background: p.color }}
          initial={{ y: '-5vh', rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', rotate: p.rotate, opacity: [1, 1, 0.8] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  )
}

export function DrawCeremony({
  participantes,
  order,
  mySlot,
  torneoName,
  onFinish,
  initialSpeed = 1,
}: {
  participantes: TorneoParticipante[]
  order: number[]
  mySlot: number | null
  torneoName: string
  onFinish: () => void
  initialSpeed?: number
}) {
  const bySlot = useMemo(() => new Map(participantes.map((p) => [p.slot, p])), [participantes])
  const [phase, setPhase] = useState<Phase>('intro')
  const [idx, setIdx] = useState(0)
  const [speed, setSpeed] = useState(initialSpeed)

  const currentSlot = order[Math.min(idx, order.length - 1)]
  const current = bySlot.get(currentSlot)
  const currentPot = current?.pot ?? 1

  // Máquina de estados de la ceremonia.
  useEffect(() => {
    if (phase === 'finale') return
    const t = setTimeout(() => {
      if (phase === 'intro') setPhase('pot')
      else if (phase === 'pot') setPhase('shake')
      else if (phase === 'shake') setPhase('drop')
      else if (phase === 'drop') setPhase('open')
      else if (phase === 'open') setPhase('place')
      else if (phase === 'place') {
        const next = idx + 1
        setIdx(next)
        if (next >= order.length) setPhase('finale')
        else setPhase(bySlot.get(order[next])!.pot !== currentPot ? 'pot' : 'shake')
      }
    }, DURATION[phase] / speed)
    return () => clearTimeout(t)
  }, [phase, idx, speed, order, bySlot, currentPot])

  const placed = useMemo(
    () => new Set(order.slice(0, Math.min(order.length, idx + (phase === 'place' ? 1 : 0)))),
    [order, idx, phase]
  )

  // Bolitas que quedan en el bombo del bombo actual.
  const ballsInPot = order.filter((slot, i) => {
    const p = bySlot.get(slot)!
    if (p.pot !== currentPot) return false
    if (i > idx) return true
    return i === idx && (phase === 'pot' || phase === 'shake')
  })
  const shaking = phase === 'shake'
  const transitionSpeed = { duration: 0.8 / speed, ease: [0.22, 1, 0.36, 1] as const }

  const myGroup = mySlot !== null ? bySlot.get(mySlot)?.group : null

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black text-white">
      {/* Luces de estadio */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-1/3 -left-1/4 w-[80vw] h-[80vw] rounded-full bg-[radial-gradient(circle,rgba(220,38,38,0.35),transparent_60%)]"
          animate={{ x: [0, 80, 0], y: [0, 40, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-1/3 -right-1/4 w-[70vw] h-[70vw] rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.18),transparent_60%)]"
          animate={{ x: [0, -60, 0], y: [0, -50, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_80px,rgba(255,255,255,0.02)_80px,rgba(255,255,255,0.02)_81px)]" />
      </div>

      {/* Intro */}
      <AnimatePresence>
        {phase === 'intro' && (
          <motion.div
            key="intro"
            className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black text-center px-4"
            exit={{ opacity: 0, scale: 1.15 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              className="text-7xl sm:text-8xl mb-4"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 160, damping: 12, delay: 0.2 }}
            >
              🏆
            </motion.div>
            <motion.p
              className="text-xs sm:text-sm tracking-[0.6em] text-amber-300 uppercase"
              initial={{ opacity: 0, letterSpacing: '1.5em' }}
              animate={{ opacity: 1, letterSpacing: '0.6em' }}
              transition={{ duration: 1.2, delay: 0.5 }}
            >
              Sorteo oficial
            </motion.p>
            <motion.h1
              className="mt-3 text-5xl sm:text-7xl md:text-8xl font-black tracking-tight"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9 }}
            >
              {torneoName.toUpperCase()}
            </motion.h1>
            <motion.div
              className="mt-6 h-1 bg-primary"
              initial={{ width: 0 }}
              animate={{ width: 260 }}
              transition={{ duration: 1, delay: 1.5 }}
            />
            <motion.p
              className="mt-5 text-sm text-zinc-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
            >
              32 jugadores · 8 grupos · 4 bombos
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cartel de cada bombo */}
      <AnimatePresence>
        {phase === 'pot' && (
          <motion.div
            key={`pot-${currentPot}`}
            className="fixed inset-0 z-[105] flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="rounded-2xl border border-white/15 bg-black/80 backdrop-blur px-10 py-6 text-center"
              initial={{ scale: 0.6, rotateX: 60 }}
              animate={{ scale: 1, rotateX: 0 }}
              transition={{ type: 'spring', stiffness: 140, damping: 14 }}
            >
              <p className="text-xs tracking-[0.5em] text-zinc-400 uppercase">Ahora</p>
              <p className={`text-5xl sm:text-6xl font-black ${POT_STYLE[currentPot].label}`}>BOMBO {currentPot}</p>
              <p className="text-xs text-zinc-400 mt-1">
                {currentPot === 1 ? 'Cabezas de serie' : currentPot === 4 ? 'Último bombo' : 'Según el ranking general'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-[101] mx-auto max-w-7xl px-3 sm:px-6 py-4">
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] sm:text-xs tracking-[0.4em] text-amber-300 uppercase">Sorteo oficial</p>
            <h2 className="text-xl sm:text-3xl font-black">{torneoName}</h2>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 border-white/20 bg-white/5 hover:bg-white/10"
              onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
            >
              <FastForward className="w-4 h-4" /> x{speed}
            </Button>
            {phase !== 'finale' && (
              <Button size="sm" variant="outline" className="gap-1 border-white/20 bg-white/5 hover:bg-white/10" onClick={onFinish}>
                <SkipForward className="w-4 h-4" /> Saltar
              </Button>
            )}
          </div>
        </div>

        <LayoutGroup>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] items-start">
            {/* Bombo + escenario */}
            <div className="flex flex-col items-center gap-4 lg:sticky lg:top-4">
              <p className={`text-sm font-bold tracking-[0.3em] ${POT_STYLE[currentPot].label}`}>
                {phase === 'finale' ? 'SORTEO TERMINADO' : `BOMBO ${currentPot}`}
              </p>
              <div className="relative">
                <motion.div
                  className="relative w-56 h-56 sm:w-72 sm:h-72 rounded-full border-2 border-white/25 bg-[radial-gradient(circle_at_35%_28%,rgba(255,255,255,0.28),rgba(255,255,255,0.05)_42%,rgba(0,0,0,0.55)_75%)] shadow-[0_0_60px_rgba(220,38,38,0.35),inset_0_0_40px_rgba(255,255,255,0.08)]"
                  animate={shaking ? { rotate: [0, -9, 8, -6, 5, 0] } : { rotate: 0 }}
                  transition={{ duration: 0.8 / speed }}
                >
                  {ballsInPot.map((slot) => {
                    const r = 0.18 + hash(slot) * 0.24
                    const a = hash(slot + 77) * Math.PI * 2
                    const amp = 6 + hash(slot + 33) * 10
                    return (
                      <motion.div
                        key={slot}
                        layoutId={`ball-${slot}`}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${50 + Math.cos(a) * r * 100}%`, top: `${50 + Math.sin(a) * r * 100}%` }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{
                          scale: 1,
                          opacity: 1,
                          x: [0, amp, -amp, amp * 0.5, 0],
                          y: [0, -amp, amp * 0.7, -amp * 0.4, 0],
                        }}
                        transition={{
                          scale: { duration: 0.4 },
                          x: { duration: (shaking ? 0.3 : 1.6 + hash(slot + 9)) / speed, repeat: Infinity, ease: 'easeInOut' },
                          y: { duration: (shaking ? 0.35 : 1.9 + hash(slot + 19)) / speed, repeat: Infinity, ease: 'easeInOut' },
                        }}
                      >
                        <Ball slot={slot} pot={currentPot} />
                      </motion.div>
                    )
                  })}
                  {/* Brillo del cristal */}
                  <div className="pointer-events-none absolute left-[18%] top-[12%] w-[30%] h-[18%] rounded-full bg-white/20 blur-md rotate-[-25deg]" />
                </motion.div>
                {/* Boca y pie del bombo */}
                <div className="mx-auto -mt-1 w-12 h-5 rounded-b-lg bg-gradient-to-b from-zinc-500 to-zinc-800 border border-white/20" />
                <div className="mx-auto w-28 h-3 rounded-full bg-gradient-to-b from-zinc-600 to-zinc-900" />
              </div>

              {/* Escenario: la bolita cae, se abre y aparece el jugador */}
              <div className="relative w-full min-h-[330px] flex items-center justify-center">
                <AnimatePresence mode="popLayout">
                  {phase === 'drop' && current && (
                    <motion.div
                      key={`drop-${currentSlot}`}
                      layoutId={`ball-${currentSlot}`}
                      transition={transitionSpeed}
                      exit={{ opacity: 0, transition: { duration: 0.05 } }}
                    >
                      <Ball slot={currentSlot} pot={current.pot} size="lg" />
                    </motion.div>
                  )}
                  {phase === 'open' && current && (
                    <motion.div key={`open-${currentSlot}`} className="relative flex items-center justify-center">
                      {/* Mitades de la bolita */}
                      <motion.div
                        className={`absolute w-28 h-14 rounded-t-full bg-gradient-to-br ${POT_STYLE[current.pot].ball}`}
                        style={{ top: 'calc(50% - 56px)', left: 'calc(50% - 56px)' }}
                        initial={{ y: 0, rotate: 0, opacity: 1 }}
                        animate={{ y: -90, rotate: -35, opacity: 0 }}
                        transition={{ duration: 0.7 / speed }}
                      />
                      <motion.div
                        className={`absolute w-28 h-14 rounded-b-full bg-gradient-to-br ${POT_STYLE[current.pot].ball}`}
                        style={{ top: '50%', left: 'calc(50% - 56px)' }}
                        initial={{ y: 0, rotate: 0, opacity: 1 }}
                        animate={{ y: 90, rotate: 30, opacity: 0 }}
                        transition={{ duration: 0.7 / speed }}
                      />
                      <motion.div
                        layoutId={`card-${currentSlot}`}
                        className={`relative w-64 rounded-2xl border-2 bg-gradient-to-b from-zinc-900 to-black p-5 text-center ${
                          currentSlot === mySlot
                            ? 'border-amber-300 shadow-[0_0_70px_rgba(251,191,36,0.55)]'
                            : 'border-primary/70 shadow-[0_0_60px_rgba(220,38,38,0.45)]'
                        }`}
                        initial={{ scale: 0.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 170, damping: 15, delay: 0.15 / speed }}
                      >
                        <p className={`text-[10px] tracking-[0.4em] uppercase ${POT_STYLE[current.pot].label}`}>Bombo {current.pot}</p>
                        <div className="my-3 flex justify-center">
                          <Flag code={current.countryCode} className="w-24 rounded shadow-lg" />
                        </div>
                        <p className="text-2xl font-black leading-tight break-words">{current.name}</p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {current.isBot ? '🤖 Bot' : current.clan === 'rayo' ? '⚡ Rayo' : current.clan === 'exiliados' ? '⚔️ Exiliados' : ''}
                          {currentSlot === mySlot && <span className="ml-1 text-amber-300 font-bold">· ¡SOS VOS!</span>}
                        </p>
                        <motion.div
                          className="mt-4 rounded-xl bg-primary py-2"
                          initial={{ opacity: 0, scale: 0.4 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.75 / speed }}
                        >
                          <p className="text-[10px] tracking-[0.4em] text-white/80">GRUPO</p>
                          <p className="text-4xl font-black leading-none">{current.group}</p>
                        </motion.div>
                      </motion.div>
                    </motion.div>
                  )}
                  {phase === 'finale' && (
                    <motion.div
                      key="finale"
                      className="w-full max-w-sm rounded-2xl border border-amber-300/50 bg-black/70 backdrop-blur p-6 text-center"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 150, damping: 14 }}
                    >
                      <p className="text-5xl mb-2">🏆</p>
                      <p className="text-2xl font-black">¡GRUPOS DEFINIDOS!</p>
                      {myGroup ? (
                        <p className="mt-2 text-sm text-zinc-300">
                          Caíste en el <span className="font-black text-amber-300 text-lg">GRUPO {myGroup}</span>
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-zinc-400">Que empiece el torneo</p>
                      )}
                      <Button className="mt-5 w-full" size="lg" onClick={onFinish}>
                        Ver el torneo
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Grupos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {GROUPS.map((g) => {
                const members = participantes.filter((p) => p.group === g).sort((a, b) => a.groupPos - b.groupPos)
                const isMine = g === myGroup && phase === 'finale'
                return (
                  <div
                    key={g}
                    className={`rounded-xl border bg-white/[0.03] p-2 sm:p-3 ${
                      isMine ? 'border-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.3)]' : 'border-white/10'
                    }`}
                  >
                    <p className="mb-2 text-center text-xs font-black tracking-[0.3em] text-primary">GRUPO {g}</p>
                    <div className="space-y-1.5">
                      {members.map((p) => {
                        const isPlaced = placed.has(p.slot)
                        const justPlaced = phase === 'place' && p.slot === currentSlot
                        return (
                          <div key={p.slot} className="h-8">
                            {isPlaced ? (
                              <motion.div
                                layoutId={`card-${p.slot}`}
                                transition={transitionSpeed}
                                className={`flex h-8 items-center gap-1.5 rounded-md border px-1.5 text-[11px] sm:text-xs font-semibold overflow-hidden ${
                                  p.slot === mySlot
                                    ? 'border-amber-300 bg-amber-300/15 text-amber-100'
                                    : justPlaced
                                      ? 'border-primary bg-primary/25'
                                      : 'border-white/10 bg-white/5'
                                }`}
                              >
                                <Flag code={p.countryCode} className="w-5 shrink-0 rounded-[2px]" />
                                <span className="truncate">{p.name}</span>
                              </motion.div>
                            ) : (
                              <div className="flex h-8 items-center justify-center rounded-md border border-dashed border-white/10 text-[10px] text-white/25">
                                Bombo {p.groupPos}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </LayoutGroup>
      </div>

      {phase === 'finale' && <Confetti />}
    </div>
  )
}
