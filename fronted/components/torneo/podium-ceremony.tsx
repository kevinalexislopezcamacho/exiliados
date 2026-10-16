'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RotateCcw, SkipForward, X } from 'lucide-react'
import { Flag, type TorneoParticipante } from './shared'

// Ceremonia del podio: se revela el tercer puesto, después el segundo y al
// final, con redoble y confeti, el campeón con su premio.

type Phase = 'intro' | 'third' | 'second' | 'drum' | 'first' | 'done'
type Player = TorneoParticipante & { cardUrl?: string }

const DURATION: Record<Exclude<Phase, 'done'>, number> = {
  intro: 3200,
  third: 3600,
  second: 3600,
  drum: 3000,
  first: 5200,
}
const NEXT: Record<Exclude<Phase, 'done'>, Phase> = { intro: 'third', third: 'second', second: 'drum', drum: 'first', first: 'done' }

function hash(n: number) {
  let x = (n + 1) * 2654435761
  x ^= x >>> 13
  x = Math.imul(x, 1597334677)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

function Confetti({ count = 130, seed = 0 }: { count?: number; seed?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: hash(i + seed) * 100,
        delay: hash(i + 500 + seed) * 1.4,
        duration: 2.8 + hash(i + 900 + seed) * 2.6,
        rotate: (hash(i + 1300 + seed) - 0.5) * 1000,
        color: ['#fbbf24', '#f59e0b', '#fafafa', '#ef4444', '#dc2626', '#fde68a', '#22c55e'][i % 7],
        w: 6 + hash(i + 1700 + seed) * 9,
      })),
    [count, seed]
  )
  return (
    <div className="pointer-events-none fixed inset-0 z-[130] overflow-hidden">
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

const STYLE = {
  1: { medal: '🥇', label: 'CAMPEÓN', ring: 'border-amber-300 shadow-[0_0_70px_rgba(251,191,36,0.65)]', block: 'from-amber-300 via-amber-400 to-amber-700', text: 'text-amber-950', accent: 'text-amber-300' },
  2: { medal: '🥈', label: 'SEGUNDO LUGAR', ring: 'border-zinc-200 shadow-[0_0_45px_rgba(228,228,231,0.4)]', block: 'from-zinc-100 via-zinc-300 to-zinc-500', text: 'text-zinc-800', accent: 'text-zinc-200' },
  3: { medal: '🥉', label: 'TERCER LUGAR', ring: 'border-orange-400 shadow-[0_0_45px_rgba(251,146,60,0.45)]', block: 'from-orange-300 via-orange-500 to-orange-800', text: 'text-orange-950', accent: 'text-orange-300' },
} as const

function PodiumPlayer({ player, place, visible, big }: { player: Player | undefined; place: 1 | 2 | 3; visible: boolean; big?: boolean }) {
  const st = STYLE[place]
  const height = place === 1 ? 'h-[13vh]' : place === 2 ? 'h-[9.5vh]' : 'h-[6.5vh]'
  // El ancho también depende del alto de pantalla para que todo el podio quepa sin scroll.
  const w = big ? 'min(33vw, 250px, 24vh)' : 'min(28vw, 200px, 19vh)'
  const widthStyle = { width: w }
  return (
    <div className={`flex flex-col items-center justify-end ${big ? 'z-10' : ''}`}>
      <div className="flex items-end" style={{ minHeight: `calc(${w} * 1.33 + 3.5rem)` }}>
        <AnimatePresence>
          {visible && player && (
            <motion.div
              style={widthStyle}
              className="flex flex-col items-center"
              initial={{ y: -420, opacity: 0, scale: 0.7, rotate: place === 2 ? -6 : place === 3 ? 6 : 0 }}
              animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: place === 1 ? 110 : 140, damping: place === 1 ? 11 : 13 }}
            >
              <div className={`relative w-full overflow-hidden rounded-xl border-2 bg-zinc-900 ${st.ring} ${big ? 'aspect-[3/4]' : 'aspect-[3/4]'}`}>
                {player.cardUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={player.cardUrl} alt={player.name} className="h-full w-full bg-black object-contain" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-zinc-800 to-black p-2">
                    <Flag code={player.countryCode} className={big ? 'w-24 rounded shadow-lg' : 'w-14 rounded shadow-lg sm:w-20'} />
                    <span className={big ? 'text-5xl' : 'text-3xl'}>{player.isBot ? '🤖' : '⚽'}</span>
                  </div>
                )}
                {place === 1 && (
                  <motion.div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent"
                    initial={{ x: '-120%' }}
                    animate={{ x: '120%' }}
                    transition={{ duration: 1.4, delay: 0.8, repeat: 2, repeatDelay: 1.2 }}
                  />
                )}
              </div>
              <p style={{ width: 'max(100%, 8.5rem)' }} className={`mt-2 text-center font-black leading-tight text-white ${big ? 'text-lg sm:text-3xl' : 'text-sm sm:text-xl'}`}>
                <Flag code={player.countryCode} className="mr-1.5 inline-block w-5 align-middle rounded-[2px] sm:w-7" />
                {player.name}
              </p>
              <p className={`text-[10px] font-semibold sm:text-xs ${st.accent}`}>
                {player.isBot ? '🤖 Bot' : player.clan === 'rayo' ? '⚡ Rayo' : player.clan === 'exiliados' ? '⚔️ Exiliados' : ''}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Escalón */}
      <motion.div
        className={`${height} mt-2 flex items-center justify-center rounded-t-lg bg-gradient-to-b ${st.block} shadow-[0_-8px_30px_rgba(0,0,0,0.4)]`}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: visible ? 1 : 0.18, opacity: visible ? 1 : 0.35 }}
        style={{ ...widthStyle, originY: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      >
        <span className={`text-2xl font-black sm:text-4xl ${st.text}`}>{place}</span>
      </motion.div>
    </div>
  )
}

export function PodiumCeremony({
  torneoName,
  prize,
  first,
  second,
  third,
  onClose,
}: {
  torneoName: string
  prize: string
  first: Player | undefined
  second: Player | undefined
  third: Player | undefined
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (phase === 'done') return
    const t = setTimeout(() => setPhase(NEXT[phase]), DURATION[phase])
    return () => clearTimeout(t)
  }, [phase, round])

  const showThird = ['third', 'second', 'drum', 'first', 'done'].includes(phase)
  const showSecond = ['second', 'drum', 'first', 'done'].includes(phase)
  const showFirst = ['first', 'done'].includes(phase)

  const caption: Record<Phase, string> = {
    intro: '',
    third: 'TERCER LUGAR',
    second: 'SEGUNDO LUGAR',
    drum: '',
    first: '¡EL CAMPEÓN!',
    done: '',
  }

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-black text-white">
      {/* Luces */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-1/3 left-1/2 h-[90vw] w-[90vw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.28),transparent_60%)]"
          animate={{ opacity: showFirst ? [0.6, 1, 0.7] : 0.4, scale: showFirst ? [1, 1.12, 1] : 1 }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <div className="absolute -bottom-1/3 -left-1/4 h-[70vw] w-[70vw] rounded-full bg-[radial-gradient(circle,rgba(220,38,38,0.28),transparent_60%)]" />
        <div className="absolute -bottom-1/3 -right-1/4 h-[70vw] w-[70vw] rounded-full bg-[radial-gradient(circle,rgba(220,38,38,0.22),transparent_60%)]" />
      </div>

      {/* Destello al revelar al campeón */}
      <AnimatePresence>
        {phase === 'first' && (
          <motion.div
            key="flash"
            className="pointer-events-none fixed inset-0 z-[125] bg-white"
            initial={{ opacity: 0.95 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* Intro */}
      <AnimatePresence>
        {phase === 'intro' && (
          <motion.div
            key="intro"
            className="fixed inset-0 z-[126] flex flex-col items-center justify-center bg-black px-4 text-center"
            exit={{ opacity: 0, scale: 1.15 }}
            transition={{ duration: 0.6 }}
          >
            <motion.p className="mb-4 text-7xl" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 150, damping: 10 }}>
              🏆
            </motion.p>
            <motion.p className="text-xs uppercase text-amber-300 sm:text-sm" initial={{ opacity: 0, letterSpacing: '1.6em' }} animate={{ opacity: 1, letterSpacing: '0.55em' }} transition={{ duration: 1.3, delay: 0.3 }}>
              Se acabó el torneo
            </motion.p>
            <motion.h1 className="mt-3 text-5xl font-black tracking-tight sm:text-7xl" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.8 }}>
              {torneoName.toUpperCase()}
            </motion.h1>
            <motion.p className="mt-5 text-xl font-bold text-zinc-300 sm:text-2xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}>
              Este es el podio
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-[121] mx-auto flex min-h-screen max-w-4xl flex-col px-3 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-amber-300 sm:text-xs">Podio final</p>
            <h2 className="text-xl font-black sm:text-3xl">{torneoName}</h2>
          </div>
          <div className="flex gap-2">
            {phase !== 'done' ? (
              <Button size="sm" variant="outline" className="gap-1 border-white/20 bg-white/5 hover:bg-white/10" onClick={() => setPhase('done')}>
                <SkipForward className="h-4 w-4" /> Saltar
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 border-white/20 bg-white/5 hover:bg-white/10"
                onClick={() => {
                  setPhase('intro')
                  setRound((r) => r + 1)
                }}
              >
                <RotateCcw className="h-4 w-4" /> Repetir
              </Button>
            )}
            <Button size="icon" variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10" onClick={onClose} aria-label="Cerrar">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Texto que acompaña cada revelación */}
        <div className="flex h-[11vh] min-h-[4.5rem] items-center justify-center text-center">
          <AnimatePresence mode="wait">
            {caption[phase] && (
              <motion.p
                key={phase}
                className={`text-3xl font-black tracking-[0.2em] sm:text-5xl ${phase === 'first' ? 'text-amber-300' : 'text-white'}`}
                initial={{ opacity: 0, scale: 2.2, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ type: 'spring', stiffness: 200, damping: 14 }}
              >
                {caption[phase]}
              </motion.p>
            )}
            {phase === 'drum' && (
              <motion.div key="drum" className="text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-sm tracking-[0.3em] text-zinc-300 sm:text-lg">Y el campeón del Mundial es…</p>
                <div className="mt-2 flex justify-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-3 w-3 rounded-full bg-amber-300"
                      animate={{ scale: [1, 1.8, 1], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
            {phase === 'done' && (
              <motion.p key="done" className="text-3xl font-black text-amber-300 sm:text-5xl" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}>
                🏆 ¡FELICITACIONES! 🏆
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Podio: 2º a la izquierda, 1º al centro, 3º a la derecha */}
        <div className="mt-2 grid flex-1 grid-cols-3 items-end gap-1.5 sm:gap-4">
          <PodiumPlayer player={second} place={2} visible={showSecond} />
          <PodiumPlayer player={first} place={1} visible={showFirst} big />
          <PodiumPlayer player={third} place={3} visible={showThird} />
        </div>

        {/* Premio */}
        <div className="flex min-h-[4.5rem] items-center justify-center py-2">
          <AnimatePresence>
            {showFirst && prize && (
              <motion.div
                className="inline-flex items-center gap-3 rounded-full border-2 border-amber-300/80 bg-gradient-to-r from-amber-500/25 via-amber-300/30 to-amber-500/25 px-6 py-2.5 shadow-[0_0_45px_rgba(251,191,36,0.5)]"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 1.6 }}
              >
                <svg viewBox="0 0 40 40" className="h-10 w-10 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]" aria-hidden="true">
                  <defs>
                    <linearGradient id="podium-coin" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#fde68a" />
                      <stop offset="50%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#b45309" />
                    </linearGradient>
                  </defs>
                  <circle cx="20" cy="20" r="18" fill="url(#podium-coin)" stroke="#92400e" strokeWidth="1.5" />
                  <circle cx="20" cy="20" r="13" fill="none" stroke="#fef3c7" strokeOpacity="0.7" strokeWidth="1.5" />
                  <text x="20" y="25.5" textAnchor="middle" fontSize="15" fontWeight="900" fill="#78350f">
                    $
                  </text>
                </svg>
                <span className="text-left leading-tight">
                  <span className="block text-[10px] uppercase tracking-[0.35em] text-amber-200/80">{first?.name} se lleva</span>
                  <span className="block text-2xl font-black text-amber-300 sm:text-3xl">{prize}</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {phase === 'done' && (
          <div className="pb-6 text-center">
            <Button size="lg" className="px-10 font-black" onClick={onClose}>
              Ver el torneo
            </Button>
          </div>
        )}
      </div>

      {(phase === 'third' || phase === 'second') && <Confetti key={`c-${phase}-${round}`} count={45} seed={phase === 'third' ? 11 : 23} />}
      {phase === 'first' && <Confetti key={`cf-${round}`} count={200} seed={99} />}
    </div>
  )
}
