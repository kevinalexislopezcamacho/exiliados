export const RANKED_CLANS = ['rayo', 'exiliados'] as const
export type RankedClan = (typeof RANKED_CLANS)[number]
