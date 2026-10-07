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
  /** the Wildshard main menu (SF21a, G79 / G88: Jake's board B; the grid entry is "Infinite Wildshard" everywhere players see it) */
  mainMenu: {
    logo: 'WILDSHARD',
    label: 'Main menu',
    shardSelect: 'SHARD SELECT',
    infinite: 'INFINITE WILDSHARD',
    settings: 'SETTINGS',
    back: 'BACK',
    /** SF60 / G214 (art/menu/round-12-whats-new/B-banner*.jpg): the day's WHAT'S NEW banner under the logo */
    whatsNew: {
      label: "What's new",
      title: (count: number): string => `WHAT'S NEW · ${count} ${count === 1 ? 'CHANGE' : 'CHANGES'}`,
      buildLine: (build: string, date: string): string => date === '' ? `PLAYTEST BUILD ${build}` : `PLAYTEST BUILD ${build} · ${date}`,
      hide: 'HIDE UNTIL NEXT BUILD',
    },
  },
  /** a shard card whose shardfile needs a newer client (G86, temporary): dimmed, a badge and the save promise */
  upgrade: {
    badge: 'NEEDS UPGRADE',
    built: (version: number): string => `BUILT FOR SHARDFILE V${version}`,
    saveKept: 'YOUR SAVE IS KEPT',
  },
  /** G167 (art/grid/round-18-refused-cell): a shard that can't load. Its cell in the grid (B: the frozen grey far view under a
   *  static dome; A: the void and the holo sign) and its SHARD SELECT card (dimmed, an amber UNAVAILABLE badge and the reason) */
  unavailable: {
    sign: 'SHARD UNAVAILABLE',
    badge: 'UNAVAILABLE',
    line: (name: string, reason: string): string => `${name.toUpperCase()} · ${reason}`,
    upgrade: 'NEEDS UPGRADE',
    tooBig: 'TOO BIG FOR THIS DEVICE',
    safety: 'FAILED SAFETY CHECK',
    load: "COULDN'T LOAD",
  },
  /** G168 (art/hud/round-22-script-error): a shard script switched off after its strikes. The player's toast, once; with
   *  Developer on, the red strip names the module and its cause */
  script: {
    stopped: 'SOMETHING IN THIS SHARD STOPPED WORKING',
    disabled: (module: string, cause: string, strikes: number): string => `SCRIPT DISABLED · ${module} · ${cause} ×${strikes}`,
    outOfFuel: 'out of fuel',
    callDepth: 'call depth',
    queries: 'too many queries',
    effects: 'too many effects',
    trap: 'trapped',
  },
  /** Infinite Wildshard, the 3 × 3 grid (SHARD-PLATFORM §3.3, G58, G79; SF21a) */
  grid: {
    ended: 'Infinite Wildshard ended unexpectedly last time.',
    devserverCell: (x: number, z: number): string => `Infinite Wildshard (${x < 0 ? '−' : '+'}${Math.abs(x)}, ${z < 0 ? '−' : '+'}${Math.abs(z)})`,
    template: 'Template',
    waiting: (name: string): string => `${name} · NOT READY FOR GRID`,
    waitingSelect: 'ENTER THROUGH SHARD SELECT',
    /** G217: the Developer loading screen drawn in 3D on a cell you can't enter (loading, waiting or refused), for everyone */
    screen: {
      kicker: { loading: 'Loading chunk ·', waiting: 'Not ready ·', refused: 'Unavailable ·' },
      chip: { loading: 'LOADING', waiting: 'WAITING', refused: 'REFUSED' },
      build: (build: string): string => `BUILD ${build}`,
      meta: { memory: 'memory', over: 'over', tier: 'tier', build: 'build', cell: 'cell' },
      over: (bytes: string): string => `+${bytes} past the envelope · Developer`,
      memory: (cell: string, page: string, cap: string): string => `${cell} claimed · page ${page} / ${cap}`,
      download: 'download', setup: 'setup', steps: 'steps', notes: 'diagnostics',
      productFact: (state: string, declared: string): string => `product ${state} · ${declared} declared`,
      noProduct: 'no shardfile in this build',
      setupFact: (step: number, total: number, label: string): string => `step ${step} / ${total} · ${label}`,
      state: { admitted: 'admitted', admitting: 'admitting', queued: 'not requested yet', refused: 'refused' },
      rows: { far: 'far view', request: 'admission', product: 'product', runtime: 'runtime', colliders: 'colliders', sim: 'sim', wall: 'soft wall', shardfile: 'shardfile', select: 'shard select' },
      far: { resident: 'drawn', loading: 'streaming', none: 'none' },
      request: { on: 'in range, requested', todo: 'waits until you are near' },
      done: 'ready', pending: 'pending', failed: 'failed',
      wall: { closed: 'closed until every step is ready', refused: 'closed: this shard is refused' },
      shardfile: { format: 'none yet: converts in M3', hybrid: 'hybrid runtime: converts in M3' },
      select: 'playable there today',
      waitingWhy: 'This shard has no shardfile yet: it joins the grid in M3.',
      claims: (count: number, declared: string): string => `Claims ${count} · declared wire ${declared}`,
      line: { loading: (pct: number): string => `LOADING · ${pct}%`, waiting: 'PLAY IT THROUGH SHARD SELECT' },
    },
    /** G198 / G219: an open plot's showrooms (never the word "upload": there is no upload, it is singleplayer) */
    plot: {
      sign: 'THIS PLOT IS YOURS TO BUILD',
      signSub: 'BUILT WITH CLAUDE CODE + THE WILDSHARD SDK',
      billboard: 'WHAT WOULD YOU BUILD?',
      demo: (idea: string): string => `DEMO · ${idea}`,
      centre: '500 × 500 M · 4 ENTRIES',
      turnIn: 'OPEN PLOT',
      ideas: {
        'sky-race': 'FLOATING ISLAND RACE', 'night-market': 'NEON NIGHT MARKET', 'frozen-lighthouse': 'FROZEN LIGHTHOUSE',
        'canyon-railway': 'CANYON RAILWAY', 'coral-reef': 'CORAL REEF DIVE', 'alien-plain': 'PASTEL ALIEN PLAIN',
        'desert-ruin': 'DESERT RUIN', 'ink-valley': 'INK VALLEY',
      },
    },
    devserverCellNote: 'SF21a (G46): the DEVSERVER cell of Infinite Wildshard, or the template it replaces. Applies at the next grid start.',
    reveal: (home: string): string => `Arriving at ${home}`,
    revealSkip: 'Tap to skip',
    /** G78: the chip above ATTACK on the road and in no-man's land (the weapon is stowed there, G68) */
    safeZone: 'SAFE ZONE',
    /** G119: on the border shimmer while a crossing waits for its durable save, and when that save fails (the crossing retries) */
    saving: 'SAVING…',
    saveFailed: 'SAVE FAILED, RETRY',
    off: 'Off',
    on: 'On',
  },
  summary: {
    label: 'Wildshard progress',
    selected: (name: string, earned: number | null): string => `${name.toUpperCase()} · ${earned === null ? 'NOT VISITED' : `${earned} FEATS`}`,
    total: (earned: number): string => `WILDSHARD · ${earned} FEATS`,
  },
} as const;
