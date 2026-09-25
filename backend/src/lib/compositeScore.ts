interface Weighted {
  value: number | null
  weight: number
}

// Promedio ponderado 0-1 solo de las métricas que la persona sí tiene (si le
// falta el armado, por ejemplo, no se le castiga con 0 — se reparte el peso
// entre lo que sí hay).
export function weightedScore(parts: Weighted[]): number {
  let sumWeighted = 0
  let sumWeights = 0
  for (const p of parts) {
    if (p.value === null) continue
    sumWeighted += p.value * p.weight
    sumWeights += p.weight
  }
  return sumWeights > 0 ? sumWeighted / sumWeights : 0
}

// Puntaje compuesto (0-100, un decimal) usado en todos los rankings:
// 40% efectividad de liga, 25% eficiencia de armado, 20% valor de equipo
// (normalizado 0-1 contra el resto del grupo que se está comparando),
// 15% si cumplió meta.
export function compositeScore(params: {
  efectividad: number | null
  eficiencia: number | null
  valorNormalizado: number | null
  metaMet: boolean | null
}): number {
  const score = weightedScore([
    { value: params.efectividad, weight: 0.4 },
    { value: params.eficiencia, weight: 0.25 },
    { value: params.valorNormalizado, weight: 0.2 },
    { value: params.metaMet === null ? null : params.metaMet ? 1 : 0, weight: 0.15 },
  ])
  return Math.round(score * 1000) / 10
}

// Normaliza un valor 0-1 por min-max contra un conjunto de valores.
export function normalize(value: number | null, all: Array<number | null>): number | null {
  if (value === null) return null
  const nums = all.filter((v): v is number => v !== null)
  if (nums.length === 0) return null
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const range = max - min
  return range > 0 ? (value - min) / range : 0.5
}
