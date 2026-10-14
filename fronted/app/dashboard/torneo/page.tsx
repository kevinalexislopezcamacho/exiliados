'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DrawCeremony } from '@/components/torneo/draw-ceremony'
import { Flag, formatDay, type TorneoData, type TorneoParticipante, type TorneoPartido } from '@/components/torneo/shared'
import { ArrowLeft, CalendarDays, Clapperboard, Network, Trophy, Users } from 'lucide-react'

type Tab = 'grupos' | 'calendario' | 'cuadro'

const STAGE_ORDER: TorneoPartido['stage'][] = ['G', 'R16', 'QF', 'SF', '3P', 'F']

function PlayerChip({ p, mySlot, align = 'left' }: { p: TorneoParticipante | undefined; mySlot: number | null; align?: 'left' | 'right' }) {
  if (!p) return null
  return (
    <span className={`flex items-center gap-1.5 min-w-0 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <Flag code={p.countryCode} className="w-5 shrink-0 rounded-[2px]" />
      <span className={`truncate ${p.slot === mySlot ? 'text-amber-300 font-bold' : ''}`}>
        {p.isBot && '🤖 '}
        {p.name}
      </span>
    </span>
  )
}

function MatchRow({
  m,
  bySlot,
  mySlot,
}: {
  m: TorneoPartido
  bySlot: Map<number, TorneoParticipante>
  mySlot: number | null
}) {
  const home = m.homeSlot !== null ? bySlot.get(m.homeSlot) : undefined
  const away = m.awaySlot !== null ? bySlot.get(m.awaySlot) : undefined
  const mine = (m.homeSlot !== null && m.homeSlot === mySlot) || (m.awaySlot !== null && m.awaySlot === mySlot)
  const content = (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
        mine ? 'border-amber-300/60 bg-amber-300/5' : 'border-border/60 bg-card/40'
      } ${home && away ? 'hover:border-primary/60' : ''}`}
    >
      {home ? <PlayerChip p={home} mySlot={mySlot} align="right" /> : <span className="text-right text-muted-foreground">{m.homeLabel}</span>}
      <span className="min-w-[56px] text-center font-black">
        {m.status === 'jugado' ? (
          <>
            {m.homeGoals} - {m.awayGoals}
            {m.homePens !== null && (
              <span className="block text-[10px] font-normal text-muted-foreground">
                pen. {m.homePens}-{m.awayPens}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">VS</span>
        )}
      </span>
      {away ? <PlayerChip p={away} mySlot={mySlot} /> : <span className="text-muted-foreground">{m.awayLabel}</span>}
    </div>
  )
  // Con los dos rivales definidos se puede abrir el cara a cara.
  return home && away ? (
    <Link href={`/dashboard/torneo/partido/${m.id}`} className="block">
      {content}
    </Link>
  ) : (
    content
  )
}

const BRACKET_COLUMNS: Array<{ label: string; stages: TorneoPartido['stage'][] }> = [
  { label: 'OCTAVOS', stages: ['R16'] },
  { label: 'CUARTOS', stages: ['QF'] },
  { label: 'SEMIS', stages: ['SF'] },
  { label: 'FINAL', stages: ['F', '3P'] },
]

function bracketMatches(partidos: TorneoPartido[], stages: TorneoPartido['stage'][]) {
  return partidos
    .filter((m) => stages.includes(m.stage))
    .sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage) || (a.bracketPos ?? 0) - (b.bracketPos ?? 0))
}

// Un cruce del cuadro: ganador resaltado, perdedor atenuado y, si se
// definió por desempate, la cantidad de aciertos de cada uno.
function BracketMatch({ m, bySlot, mySlot }: { m: TorneoPartido; bySlot: Map<number, TorneoParticipante>; mySlot: number | null }) {
  const played = m.status === 'jugado'
  const box = (
    <div>
      {m.stage === '3P' && <p className="mb-1 text-center text-[10px] text-muted-foreground">Tercer puesto</p>}
      <div
        className={`overflow-hidden rounded-lg border transition-colors ${
          m.stage === 'F' ? 'border-amber-300/60 bg-amber-300/5' : 'border-border/60 bg-card/40'
        } ${m.homeSlot !== null && m.awaySlot !== null ? 'hover:border-primary/60' : ''}`}
      >
        {(['home', 'away'] as const).map((side) => {
          const slot = side === 'home' ? m.homeSlot : m.awaySlot
          const goals = side === 'home' ? m.homeGoals : m.awayGoals
          const pens = side === 'home' ? m.homePens : m.awayPens
          const p = slot !== null ? bySlot.get(slot) : undefined
          const won = played && m.winnerSlot !== null && m.winnerSlot === slot
          const lost = played && m.winnerSlot !== null && m.winnerSlot !== slot
          return (
            <div
              key={side}
              className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${side === 'home' ? 'border-b border-border/40' : ''} ${
                won ? 'font-bold bg-green-500/5' : ''
              } ${lost ? 'opacity-50' : ''}`}
            >
              {p ? (
                <PlayerChip p={p} mySlot={mySlot} />
              ) : (
                <span className="text-muted-foreground text-xs">{side === 'home' ? m.homeLabel : m.awayLabel}</span>
              )}
              <span className="flex items-center gap-1 font-black tabular-nums">
                {won && m.stage === 'F' && <span title="Campeón">🏆</span>}
                {played ? goals : ''}
                {played && pens !== null && <span className="text-[10px] font-semibold text-muted-foreground">({pens})</span>}
              </span>
            </div>
          )
        })}
        {played && m.homePens !== null && (
          <p className="border-t border-border/40 px-3 py-1 text-center text-[10px] text-muted-foreground">
            Desempate por aciertos {m.homePens}-{m.awayPens}
          </p>
        )}
      </div>
    </div>
  )
  return m.homeSlot !== null && m.awaySlot !== null ? (
    <Link href={`/dashboard/torneo/partido/${m.id}`} className="block">
      {box}
    </Link>
  ) : (
    box
  )
}

// Premio del torneo, en dorado.
function PrizeBadge({ prize, label = 'Premio' }: { prize: string; label?: string }) {
  return (
    <motion.div
      className="mx-auto mt-4 inline-flex items-center gap-3 rounded-full border-2 border-amber-300/70 bg-gradient-to-r from-amber-500/20 via-amber-300/25 to-amber-500/20 px-5 py-2 shadow-[0_0_35px_rgba(251,191,36,0.35)]"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.2 }}
    >
      {/* Moneda dibujada: el emoji 🪙 no existe en varios Windows. */}
      <motion.svg
        viewBox="0 0 40 40"
        className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="coin-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="18" fill="url(#coin-gold)" stroke="#92400e" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="13" fill="none" stroke="#fef3c7" strokeOpacity="0.7" strokeWidth="1.5" />
        <text x="20" y="25.5" textAnchor="middle" fontSize="15" fontWeight="900" fill="#78350f">
          $
        </text>
        <ellipse cx="14" cy="12" rx="5" ry="2.5" fill="#fff" opacity="0.45" transform="rotate(-30 14 12)" />
      </motion.svg>
      <span className="text-left leading-tight">
        <span className="block text-[10px] tracking-[0.35em] text-amber-200/80 uppercase">{label}</span>
        <span className="block text-xl sm:text-2xl font-black text-amber-300">{prize}</span>
      </span>
    </motion.div>
  )
}

// Tu próximo partido, con acceso directo para jugarlo.
function NextMatchCard({
  m,
  bySlot,
  mySlot,
}: {
  m: NonNullable<TorneoData['nextMatch']>
  bySlot: Map<number, TorneoParticipante>
  mySlot: number | null
}) {
  const home = m.homeSlot !== null ? bySlot.get(m.homeSlot) : undefined
  const away = m.awaySlot !== null ? bySlot.get(m.awaySlot) : undefined
  const rival = home?.slot === mySlot ? away : home
  const label = m.stage === 'G' ? `Fecha ${m.matchday} · Grupo ${m.group}` : m.stageLabel
  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-300/50 bg-zinc-950 p-5 sm:p-6">
      <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-primary/25 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] tracking-[0.4em] text-amber-300 uppercase">Tu próximo partido · {label}</p>
          <div className="mt-2 flex items-center gap-3 text-lg sm:text-2xl font-black text-white">
            {home ? <PlayerChip p={home} mySlot={mySlot} /> : <span className="text-zinc-500 text-base">{m.homeLabel}</span>}
            <span className="text-primary text-base">VS</span>
            {away ? <PlayerChip p={away} mySlot={mySlot} /> : <span className="text-zinc-500 text-base">{m.awayLabel}</span>}
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            {m.open
              ? `Se juega hasta el ${formatDay(m.closesDay)} (2 días). ${m.myFinished ? 'Ya jugaste: esperando a tu rival.' : ''}`
              : `Abre el ${formatDay(m.opensDay)} y se puede jugar hasta el ${formatDay(m.closesDay)}.`}
            {rival?.isBot && ' Tu rival es un bot.'}
          </p>
        </div>
        {home && away && (
          <Link href={`/dashboard/torneo/partido/${m.id}`}>
            <Button size="lg" className="w-full sm:w-auto px-8 font-black" variant={m.open && !m.myFinished ? 'default' : 'outline'}>
              {m.open && !m.myFinished ? (m.myStarted ? 'SEGUIR JUGANDO' : 'JUGAR') : 'VER CARA A CARA'}
            </Button>
          </Link>
        )}
      </div>
    </section>
  )
}

export default function TorneoPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<TorneoData | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('grupos')
  const [replay, setReplay] = useState(false)
  const [newName, setNewName] = useState('Mundial Exiliados')
  const [prizeDraft, setPrizeDraft] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const load = useCallback(() => {
    fetch('/api/torneo')
      .then((r) => r.json())
      .then((r) => (r.success ? setData(r.data) : setError(r.error || 'No se pudo cargar el torneo')))
      .catch(() => setError('Error cargando el torneo'))
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  const post = async (url: string, body?: unknown, method = 'POST') => {
    setBusy(true)
    setError('')
    try {
      const r = await (
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      ).json()
      if (!r.success) setError(r.error || 'No se pudo completar')
      load()
      return r.success as boolean
    } catch {
      setError('Error de conexión')
      return false
    } finally {
      setBusy(false)
    }
  }

  const bySlot = useMemo(() => new Map((data?.participantes ?? []).map((p) => [p.slot, p])), [data])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isCaptain = user.role === 'captain'
  const torneo = data?.torneo ?? null
  const mySlot = data?.mySlot ?? null

  // La ceremonia del sorteo se muestra la primera vez (o si piden repetirla).
  const showCeremony =
    torneo?.status === 'en_juego' && data?.participantes && data.drawOrder && (replay || !data.drawSeen)
  if (showCeremony && torneo && data?.participantes && data.drawOrder) {
    return (
      <DrawCeremony
        participantes={data.participantes}
        order={data.drawOrder}
        mySlot={mySlot}
        torneoName={torneo.name}
        onFinish={() => {
          setReplay(false)
          if (!data.drawSeen) post('/api/torneo/sorteo-visto')
        }}
      />
    )
  }

  const inscritos = data?.inscritos ?? []
  const total = torneo?.totalPlayers ?? 32
  const bots = Math.max(0, total - inscritos.length)

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
              <h1 className="text-2xl font-black text-primary truncate">{torneo?.name ?? 'Mundial Exiliados'}</h1>
              <p className="text-sm text-muted-foreground truncate">32 jugadores · grupos, octavos, cuartos, semis y final</p>
            </div>
          </div>
          {torneo?.status === 'en_juego' && (
            <Button variant="outline" className="gap-2 border-primary/40" onClick={() => setReplay(true)}>
              <Clapperboard className="w-4 h-4" /> <span className="hidden sm:inline">Ver el sorteo</span>
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6 max-w-6xl">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm">{error}</div>
        )}
        {!data && !error && <div className="h-64 rounded-2xl bg-card/50 border border-border/50 animate-pulse" />}

        {/* Sin torneo */}
        {data && !torneo && (
          <Card className="p-8 text-center space-y-4">
            <Trophy className="w-12 h-12 mx-auto text-primary" />
            <p className="text-xl font-bold">Todavía no hay torneo</p>
            {isCaptain ? (
              <div className="max-w-sm mx-auto space-y-3">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del torneo" />
                <Button className="w-full" disabled={busy} onClick={() => post('/api/torneo', { name: newName })}>
                  Crear torneo y abrir inscripción
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Cuando los capitanes lo abran, te vas a poder inscribir acá.</p>
            )}
          </Card>
        )}

        {/* Inscripción */}
        {torneo?.status === 'inscripcion' && (
          <>
            <section className="relative overflow-hidden rounded-2xl border border-primary/40 bg-zinc-950 p-6 sm:p-10 text-center">
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-primary/20 blur-3xl" />
              <div className="relative">
                <motion.p
                  className="text-6xl"
                  animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.06, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  🏆
                </motion.p>
                <p className="mt-2 text-xs tracking-[0.5em] text-amber-300 uppercase">Inscripción abierta</p>
                <h2 className="mt-2 text-4xl sm:text-6xl font-black">{torneo.name.toUpperCase()}</h2>
                {torneo.prize && <PrizeBadge prize={torneo.prize} />}
                <p className="mt-3 text-sm text-zinc-400">
                  8 grupos de 4 · pasan 2 · partidos de 5 rondas · 2 días para jugar cada partido
                </p>
                <div className="mx-auto mt-6 max-w-md">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>{inscritos.length} inscriptos</span>
                    <span>{total} lugares</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-amber-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (inscritos.length / total) * 100)}%` }}
                    />
                  </div>
                </div>
                {data?.canJoin && !data.meInscrito && (
                  <Button
                    size="lg"
                    className="mt-6 px-10 text-lg font-black"
                    disabled={busy}
                    onClick={() => post('/api/torneo/inscripcion', { inscribir: true })}
                  >
                    INSCRIBIRME
                  </Button>
                )}
                {data?.meInscrito && (
                  <motion.div
                    className="mx-auto mt-6 max-w-md rounded-xl border border-green-500/40 bg-green-500/10 p-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <p className="font-black text-green-400">✓ ¡Estás inscripto!</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      El torneo iniciará pronto. Cuando se completen los {total} lugares
                      {inscritos.length < total ? ` (faltan ${total - inscritos.length})` : ''} se hace el sorteo en vivo y vas a
                      ver en qué grupo caíste.
                    </p>
                    <button
                      className="mt-2 text-xs text-zinc-500 underline hover:text-zinc-300"
                      disabled={busy}
                      onClick={() => post('/api/torneo/inscripcion', { inscribir: false })}
                    >
                      Bajarme del torneo
                    </button>
                  </motion.div>
                )}
              </div>
            </section>

            <Card className="p-5">
              <h3 className="mb-3 flex items-center gap-2 font-bold text-primary">
                <Users className="w-5 h-5" /> Inscriptos ({inscritos.length})
              </h3>
              {inscritos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no se anotó nadie. ¡Sé el primero!</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {inscritos.map((p) => (
                    <div key={p.memberId} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm">
                      <Flag code={p.countryCode} className="w-6 rounded-[2px]" />
                      <span className="truncate">{p.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {data?.isOrganizer && (
              <Card className="p-5 space-y-3 border-amber-300/30">
                <h3 className="font-bold">Panel del organizador</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={prizeDraft ?? torneo.prize}
                    onChange={(e) => setPrizeDraft(e.target.value)}
                    placeholder="Premio (ej. 1125 COINS)"
                  />
                  <Button
                    variant="outline"
                    disabled={busy || prizeDraft === null || prizeDraft === torneo.prize}
                    onClick={async () => {
                      if (await post(`/api/torneo/${torneo.id}/premio`, { prize: prizeDraft }, 'PUT')) setPrizeDraft(null)
                    }}
                  >
                    Guardar premio
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Con {total} inscriptos el sorteo se hace solo. Si querés arrancar antes, iniciá el torneo: se cierra la
                  inscripción.{' '}
                  {inscritos.length > total
                    ? `Hay ${inscritos.length} inscriptos: entran los ${total} mejores del ranking general.`
                    : bots > 0
                      ? `Se completan los ${bots} lugares que faltan con bots.`
                      : 'Están los 32 completos.'}{' '}
                  Los bombos se arman según el ranking general.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy || inscritos.length < 2}
                    onClick={() => {
                      if (confirm(`¿Iniciar el torneo con ${inscritos.length} inscriptos${bots > 0 ? ` y ${bots} bots` : ''}? No se puede deshacer.`)) {
                        post('/api/torneo/sorteo')
                      }
                    }}
                  >
                    Iniciar torneo ahora
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (confirm('¿Borrar este torneo y sus inscripciones?')) post(`/api/torneo/${torneo.id}`, undefined, 'DELETE')
                    }}
                  >
                    Borrar torneo
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}

        {/* Torneo en juego */}
        {torneo && torneo.status !== 'inscripcion' && data?.participantes && (
          <>
            {data.podium && data.podium.champion !== null && (
              <section className="relative overflow-hidden rounded-2xl border border-amber-300/60 bg-zinc-950 p-6 sm:p-10 text-center">
                <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[30rem] h-[30rem] rounded-full bg-amber-400/20 blur-3xl" aria-hidden="true" />
                <div className="relative">
                  <motion.p className="text-7xl" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 140, damping: 10 }}>
                    🏆
                  </motion.p>
                  <p className="mt-2 text-xs tracking-[0.5em] text-amber-300 uppercase">Campeón del {torneo.name}</p>
                  <div className="mt-3 flex justify-center">
                    <div className="flex items-center gap-3 text-3xl sm:text-5xl font-black text-white">
                      <Flag code={bySlot.get(data.podium.champion)?.countryCode ?? ''} className="w-12 sm:w-16 rounded" />
                      {bySlot.get(data.podium.champion)?.name}
                    </div>
                  </div>
                  {torneo.prize && <PrizeBadge prize={torneo.prize} label="Se lleva" />}
                  <div className="mt-5 flex flex-wrap justify-center gap-6 text-sm text-zinc-300">
                    {data.podium.runnerUp !== null && <span>🥈 {bySlot.get(data.podium.runnerUp)?.name}</span>}
                    {data.podium.third !== null && <span>🥉 {bySlot.get(data.podium.third)?.name}</span>}
                  </div>
                </div>
              </section>
            )}

            {torneo.status === 'en_juego' && torneo.prize && (
              <div className="flex justify-center">
                <PrizeBadge prize={torneo.prize} />
              </div>
            )}

            {data.nextMatch && <NextMatchCard m={data.nextMatch} bySlot={bySlot} mySlot={mySlot} />}

            {torneo.status === 'en_juego' && torneo.startDay && data.today && data.today < torneo.startDay && (
              <Card className="p-4 flex items-center gap-3 border-primary/30 bg-primary/5">
                <CalendarDays className="w-5 h-5 text-primary shrink-0" />
                <p className="text-sm">
                  El torneo arranca el <b>{formatDay(torneo.startDay)}</b>. Cada partido se juega en 5 rondas de minijuegos y
                  hay 2 días para jugarlo.
                </p>
              </Card>
            )}

            <div className="flex gap-2 overflow-x-auto">
              {(
                [
                  ['grupos', 'Grupos', Users],
                  ['calendario', 'Calendario', CalendarDays],
                  ['cuadro', 'Cuadro final', Network],
                ] as const
              ).map(([key, label, Icon]) => (
                <Button key={key} variant={tab === key ? 'default' : 'outline'} className="gap-2" onClick={() => setTab(key)}>
                  <Icon className="w-4 h-4" /> {label}
                </Button>
              ))}
            </div>

            {tab === 'grupos' && (
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(data.grupos ?? {}).map(([g, rows]) => (
                  <Card key={g} className="p-4 overflow-hidden">
                    <p className="mb-2 font-black tracking-[0.3em] text-primary">GRUPO {g}</p>
                    <table className="w-full text-sm">
                      <thead className="text-[11px] text-muted-foreground">
                        <tr>
                          <th className="text-left py-1 w-5">#</th>
                          <th className="text-left py-1">Jugador</th>
                          <th className="py-1 px-1.5 sm:px-2.5 text-center">PJ</th>
                          <th className="py-1 px-1.5 sm:px-2.5 text-center">G</th>
                          <th className="py-1 px-1.5 sm:px-2.5 text-center">E</th>
                          <th className="py-1 px-1.5 sm:px-2.5 text-center">P</th>
                          <th className="py-1 px-1.5 sm:px-2.5 text-center">DG</th>
                          <th className="py-1 px-1.5 sm:px-2.5 text-center">PTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={r.slot} className={`border-t border-border/40 ${i < 2 ? 'bg-green-500/5' : ''}`}>
                            <td className={`py-1.5 font-bold ${i < 2 ? 'text-green-500' : 'text-muted-foreground'}`}>{i + 1}</td>
                            <td className="py-1.5 max-w-0 w-full">
                              <PlayerChip p={bySlot.get(r.slot)} mySlot={mySlot} />
                            </td>
                            <td className="py-1.5 px-1.5 sm:px-2.5 text-center tabular-nums">{r.pj}</td>
                            <td className="py-1.5 px-1.5 sm:px-2.5 text-center tabular-nums">{r.g}</td>
                            <td className="py-1.5 px-1.5 sm:px-2.5 text-center tabular-nums">{r.e}</td>
                            <td className="py-1.5 px-1.5 sm:px-2.5 text-center tabular-nums">{r.p}</td>
                            <td className="py-1.5 px-1.5 sm:px-2.5 text-center tabular-nums">{r.dg > 0 ? `+${r.dg}` : r.dg}</td>
                            <td className="py-1.5 px-1.5 sm:px-2.5 text-center font-black tabular-nums">{r.pts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                ))}
              </div>
            )}

            {tab === 'calendario' && (
              <div className="space-y-5">
                {STAGE_ORDER.flatMap((stage) => {
                  const ofStage = (data.partidos ?? []).filter((m) => m.stage === stage)
                  if (stage === 'G') {
                    return [1, 2, 3].map((md) => {
                      const ms = ofStage.filter((m) => m.matchday === md)
                      if (ms.length === 0) return null
                      return (
                        <Card key={`G${md}`} className="p-4 space-y-2">
                          <p className="font-bold text-primary">
                            Fecha {md} · Grupos{' '}
                            <span className="text-xs font-normal text-muted-foreground">
                              {formatDay(ms[0].opensDay)} – {formatDay(ms[0].closesDay)}
                            </span>
                          </p>
                          <div className="grid gap-2 md:grid-cols-2">
                            {ms.map((m) => (
                              <div key={m.id}>
                                <p className="text-[10px] text-muted-foreground mb-0.5">Grupo {m.group}</p>
                                <MatchRow m={m} bySlot={bySlot} mySlot={mySlot} />
                              </div>
                            ))}
                          </div>
                        </Card>
                      )
                    })
                  }
                  if (ofStage.length === 0) return []
                  return [
                    <Card key={stage} className="p-4 space-y-2">
                      <p className="font-bold text-primary">
                        {ofStage[0].stageLabel}{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                          {formatDay(ofStage[0].opensDay)} – {formatDay(ofStage[0].closesDay)}
                        </span>
                      </p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {ofStage.map((m) => (
                          <MatchRow key={m.id} m={m} bySlot={bySlot} mySlot={mySlot} />
                        ))}
                      </div>
                    </Card>,
                  ]
                })}
              </div>
            )}

            {tab === 'cuadro' && (
              <>
                {/* PC: el cuadro clásico, de octavos a la final. */}
                <div className="hidden md:grid grid-cols-4 gap-4">
                  {BRACKET_COLUMNS.map((col) => (
                    <div key={col.label} className="flex flex-col gap-3">
                      <p className="text-center text-xs font-black tracking-[0.3em] text-primary">{col.label}</p>
                      <div className="flex flex-1 flex-col justify-around gap-3">
                        {bracketMatches(data.partidos ?? [], col.stages).map((m) => (
                          <BracketMatch key={m.id} m={m} bySlot={bySlot} mySlot={mySlot} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Celular: fase por fase, de arriba hacia abajo. */}
                <div className="md:hidden space-y-6">
                  {[...BRACKET_COLUMNS].reverse().map((col) => (
                    <section key={col.label}>
                      <p className="mb-2 text-xs font-black tracking-[0.3em] text-primary">{col.label}</p>
                      <div className="grid gap-2">
                        {bracketMatches(data.partidos ?? [], col.stages).map((m) => (
                          <BracketMatch key={m.id} m={m} bySlot={bySlot} mySlot={mySlot} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}

            {torneo.status === 'finalizado' && isCaptain && (
              <Card className="p-5 space-y-3">
                <p className="font-bold">¿Otro torneo?</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del torneo" />
                  <Button disabled={busy} onClick={() => post('/api/torneo', { name: newName })}>
                    Crear y abrir inscripción
                  </Button>
                </div>
              </Card>
            )}

            {data.isOrganizer && torneo.status === 'en_juego' && (
              <div className="pt-6 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm('¿Cancelar el torneo? Se borran el sorteo, los partidos y los resultados.') &&
                      confirm('¿Seguro? No se puede deshacer.')
                    ) {
                      post(`/api/torneo/${torneo.id}`, undefined, 'DELETE')
                    }
                  }}
                >
                  Cancelar torneo
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
