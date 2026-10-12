// Miniportadas ilustradas de cada minijuego para el panel. Son SVG simples
// con los colores de la página (rojo primario sobre fondo oscuro), más
// algunos escudos y banderas reales donde ayudan a reconocer el juego.

const CREST = (id: number) => `https://crests.football-data.org/${id}.png`
const FLAG = (code: string) => `https://flagcdn.com/w80/${code}.png`

// Colores del Wordle/feedback, iguales a los que usan los juegos.
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const GRAY = '#52525b'

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 160 100" className="w-full h-full" aria-hidden="true">
      {children}
    </svg>
  )
}

function AdivinaCover() {
  return (
    <Svg>
      <circle cx="80" cy="38" r="18" fill="currentColor" opacity="0.9" />
      <path d="M50 92c0-18 13-30 30-30s30 12 30 30z" fill="currentColor" opacity="0.9" />
      <text x="80" y="46" textAnchor="middle" fontSize="22" fontWeight="800" fill="#0a0a0a">?</text>
      {[
        [14, 18, GREEN],
        [14, 40, AMBER],
        [14, 62, GRAY],
        [124, 18, GRAY],
        [124, 40, GREEN],
        [124, 62, AMBER],
      ].map(([x, y, c], i) => (
        <rect key={i} x={x as number} y={y as number} width="22" height="14" rx="3" fill={c as string} />
      ))}
    </Svg>
  )
}

function MayorMenorCover() {
  return (
    <Svg>
      <rect x="34" y="26" width="34" height="62" rx="4" fill="currentColor" />
      <rect x="92" y="50" width="34" height="38" rx="4" fill="currentColor" opacity="0.45" />
      <path d="M51 8l10 12H41z" fill={GREEN} />
      <path d="M109 44l10-12H99z" fill="#ef4444" />
      <text x="51" y="64" textAnchor="middle" fontSize="12" fontWeight="800" fill="#0a0a0a">PTS</text>
      <text x="109" y="74" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">VS</text>
    </Svg>
  )
}

function DeDondeEsCover() {
  const flags = ['mx', 'ar', 'co', 'es', 'cl', 've']
  return (
    <div className="grid grid-cols-3 gap-2 p-3 w-full h-full place-items-center">
      {flags.map((f, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={f}
          src={FLAG(f)}
          alt=""
          loading="lazy"
          className={`w-full max-w-[52px] rounded-sm shadow ${i === 0 ? 'ring-2 ring-primary' : 'opacity-70'}`}
        />
      ))}
    </div>
  )
}

function WordleCover() {
  const rows = [
    [GRAY, AMBER, GRAY, GRAY, GREEN],
    [GREEN, GRAY, AMBER, GREEN, GREEN],
    [GREEN, GREEN, GREEN, GREEN, GREEN],
  ]
  const letters = ['MESSI', 'SALAH', '']
  return (
    <Svg>
      {rows.map((row, r) =>
        row.map((c, i) => (
          <g key={`${r}-${i}`}>
            <rect x={22 + i * 24} y={10 + r * 28} width="20" height="22" rx="3" fill={c} />
            <text x={32 + i * 24} y={26 + r * 28} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">
              {letters[r]?.[i] ?? ''}
            </text>
          </g>
        ))
      )}
    </Svg>
  )
}

function QuizCover({ label }: { label: string }) {
  return (
    <Svg>
      <rect x="16" y="10" width="128" height="24" rx="12" fill="currentColor" />
      <text x="80" y="27" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">
        {label}
      </text>
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={i % 2 === 0 ? 16 : 84}
          y={44 + Math.floor(i / 2) * 26}
          width="60"
          height="20"
          rx="5"
          fill={i === 1 ? GREEN : '#27272a'}
          stroke={i === 1 ? GREEN : '#3f3f46'}
        />
      ))}
    </Svg>
  )
}

function CompetenciasCover() {
  return (
    <Svg>
      <path d="M58 14h44v20a22 22 0 01-44 0z" fill={AMBER} />
      <path d="M58 20H46a10 10 0 0012 16M102 20h12a10 10 0 01-12 16" stroke={AMBER} strokeWidth="4" fill="none" />
      <rect x="74" y="56" width="12" height="14" fill={AMBER} />
      <rect x="62" y="70" width="36" height="10" rx="2" fill="currentColor" />
      <text x="80" y="96" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff" opacity="0.8">
        BHP · CN · LBH · WCC
      </text>
    </Svg>
  )
}

function OrdenaCover() {
  const widths = [110, 92, 74, 58, 40]
  return (
    <Svg>
      {widths.map((w, i) => (
        <g key={i}>
          <text x="20" y={20 + i * 17} textAnchor="middle" fontSize="11" fontWeight="800" fill="currentColor">
            {i + 1}
          </text>
          <rect x="30" y={10 + i * 17} width={w} height="12" rx="3" fill={i < 2 ? GREEN : '#3f3f46'} />
        </g>
      ))}
    </Svg>
  )
}

function RayoExiCover() {
  return (
    <Svg>
      <path d="M0 0h86L74 100H0z" fill="currentColor" />
      <path d="M86 0h74v100H74z" fill="#18181b" />
      <text x="32" y="56" textAnchor="middle" fontSize="17" fontWeight="900" fill="#fff">RAYO</text>
      <text x="124" y="56" textAnchor="middle" fontSize="17" fontWeight="900" fill="currentColor">EXI</text>
      <circle cx="80" cy="50" r="16" fill="#0a0a0a" stroke="#fff" strokeWidth="2" />
      <text x="80" y="55" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">30s</text>
    </Svg>
  )
}

function AlineacionCover() {
  const players = [
    [80, 88],
    [40, 70], [66, 72], [94, 72], [120, 70],
    [52, 48], [80, 50], [108, 48],
    [44, 24], [80, 18], [116, 24],
  ]
  return (
    <Svg>
      <rect x="10" y="4" width="140" height="92" rx="6" fill="#14532d" />
      <rect x="10" y="4" width="140" height="92" rx="6" fill="none" stroke="#fff" strokeOpacity="0.35" />
      <line x1="10" y1="50" x2="150" y2="50" stroke="#fff" strokeOpacity="0.35" />
      <circle cx="80" cy="50" r="12" fill="none" stroke="#fff" strokeOpacity="0.35" />
      {players.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" fill="currentColor" stroke="#fff" strokeWidth="1.5" />
      ))}
    </Svg>
  )
}

function GrillaCover() {
  const cols = [86, 81, 66]
  const rows = [109, 5]
  return (
    <div className="grid grid-cols-4 grid-rows-3 gap-1 h-full aspect-[4/3]">
      <div />
      {cols.map((id) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={id} src={CREST(id)} alt="" loading="lazy" className="w-full h-full min-h-0 object-contain p-0.5" />
      ))}
      {rows.map((id, r) => (
        <div key={id} className="contents">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CREST(id)} alt="" loading="lazy" className="w-full h-full min-h-0 object-contain p-0.5" />
          {[0, 1, 2].map((c) => (
            <div
              key={c}
              className={`rounded border ${
                (r + c) % 2 === 0 ? 'bg-green-600/70 border-green-500' : 'bg-white/5 border-white/15'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function TrayectoriaCover() {
  const ids = [503, 548, 86, 5]
  return (
    <div className="flex items-center justify-center gap-1 w-full h-full px-2">
      {ids.map((id, i) => (
        <div key={id} className="flex items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CREST(id)} alt="" loading="lazy" className="w-8 h-8 sm:w-9 sm:h-9 object-contain" />
          {i < ids.length - 1 && <span className="text-primary font-black">›</span>}
        </div>
      ))}
    </div>
  )
}

function EscudoCover() {
  // Escudo "pixelado" dibujado con bloques.
  const pattern = [
    '..XXXXXX..',
    '.XXOOOOXX.',
    '.XOOXXOOX.',
    '.XOXXXXOX.',
    '.XOOXXOOX.',
    '..XOOOOX..',
    '...XOOX...',
    '....XX....',
  ]
  return (
    <Svg>
      {pattern.flatMap((row, r) =>
        row.split('').map((cell, c) =>
          cell === '.' ? null : (
            <rect
              key={`${r}-${c}`}
              x={40 + c * 8}
              y={10 + r * 10}
              width="8"
              height="10"
              fill={cell === 'X' ? 'currentColor' : '#fafafa'}
              opacity={cell === 'X' ? 1 : 0.85}
            />
          )
        )
      )}
    </Svg>
  )
}

function GolesCover() {
  return (
    <Svg>
      <text x="40" y="58" textAnchor="middle" fontSize="34" fontWeight="900" fill="currentColor">16</text>
      <text x="120" y="58" textAnchor="middle" fontSize="34" fontWeight="900" fill="#fff" opacity="0.5">15</text>
      <text x="80" y="54" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">VS</text>
      <circle cx="80" cy="80" r="12" fill="#fff" />
      <path d="M80 72l6 4-2 7h-8l-2-7z" fill="#0a0a0a" />
      <text x="40" y="78" textAnchor="middle" fontSize="9" fill="#fff" opacity="0.7">goles</text>
      <text x="120" y="78" textAnchor="middle" fontSize="9" fill="#fff" opacity="0.7">goles</text>
    </Svg>
  )
}

export function MinigameCover({ id }: { id: string }) {
  switch (id) {
    case 'adivina-integrante':
      return <AdivinaCover />
    case 'mayor-menor':
      return <MayorMenorCover />
    case 'de-donde-es':
      return <DeDondeEsCover />
    case 'wordle-futbol':
      return <WordleCover />
    case 'trivia-futbol':
      return <QuizCover label="¿Campeón en 2010?" />
    case 'trivia-osm':
      return <QuizCover label="Trivia OSM" />
    case 'trivia-competencias':
      return <CompetenciasCover />
    case 'ordena-top5':
      return <OrdenaCover />
    case 'rayo-o-exi':
      return <RayoExiCover />
    case 'alineacion-ganadora':
      return <AlineacionCover />
    case 'grilla-futbol':
      return <GrillaCover />
    case 'trayectoria':
      return <TrayectoriaCover />
    case 'escudo-borroso':
      return <EscudoCover />
    case 'mas-menos-goles':
      return <GolesCover />
    default:
      return <QuizCover label="Minijuego" />
  }
}
