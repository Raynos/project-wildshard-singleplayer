/** Wildshard-owned labels; title summary never imports a shard plugin for its strings. */
export const GAME_STRINGS = {
  developer: {
    ribbon: 'DEVELOPER ONLY',
    banner: (label: string): string => `DEVELOPER ONLY · ${label.toUpperCase()}`,
  },
  /** a draft's COMING SOON card on the title deck (WORLDCLAW-TOOLS W9, J38) */
  drafts: {
    comingSoon: 'Coming soon',
    ribbon: (stage: string): string => `Draft · ${stage}`,
    notPlayable: 'Not yet playable',
    followBuild: 'Follow the build',
    draftMode: 'Draft mode',
  },
  /** the main menu's two entries (SHARD-PLATFORM §3.3, G58; SF21a) */
  grid: {
    select: 'Select a shard',
    entry: 'EXPERIMENTAL Wildshard',
    menu: 'Main menu',
    ended: 'EXPERIMENTAL Wildshard ended unexpectedly last time.',
    devserverCell: (x: number, z: number): string => `EXPERIMENTAL Wildshard (${x < 0 ? '−' : '+'}${Math.abs(x)}, ${z < 0 ? '−' : '+'}${Math.abs(z)})`,
    template: 'Template',
    devserverCellNote: 'SF21a (G46): the DEVSERVER cell of EXPERIMENTAL Wildshard, or the template it replaces. Applies at the next grid start.',
    oneFrame: 'Grid one frame',
    oneFrameNote: 'SF19a: one sky, sun, exposure and air for the whole grid, each pixel graded by its own region. Applies at the next grid start.',
    off: 'Off',
    on: 'On',
  },
  summary: {
    label: 'Wildshard progress',
    selected: (name: string, earned: number | null): string => `${name.toUpperCase()} · ${earned === null ? 'NOT VISITED' : `${earned} FEATS`}`,
    total: (earned: number): string => `WILDSHARD · ${earned} FEATS`,
  },
} as const;
