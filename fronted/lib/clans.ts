export const CLAN_LABELS: Record<string, string> = {
  exiliados: 'Exiliados',
  rayo: 'Rayo',
}

export function clanLabel(clan: string | null | undefined): string {
  if (!clan) return 'Sin clan'
  return CLAN_LABELS[clan] ?? clan
}
