/** Wildshard-owned labels; title summary never imports a shard plugin for its strings. */
export const GAME_STRINGS = {
  summary: {
    label: 'Wildshard progress',
    notVisited: 'NOT VISITED',
    known: (earned: number, total: number): string => `${earned} / ${total} FEATS`,
    unknown: (earned: number): string => `${earned} FEATS`,
    total: (earned: number): string => `WILDSHARD · ${earned} FEATS`,
  },
} as const;
