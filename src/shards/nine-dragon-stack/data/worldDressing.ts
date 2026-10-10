// Nine Dragon's world build as data (SHARD-PLATFORM M3, ex world/build.ts): the sign fonts it waits for, the kit
// conversion's yield, the Well's silk sheet layers and the noodle stall's steam puffs (@wildshard/sdk/looks/fontWait,
// kit/kitConvert, looks/mistGeometry).

/** the sign faces are drawn into canvases: their fonts must be in before the atlas is (9 s cap, then system fallbacks) */
export const FONT_LOAD = { specs: ['700 64px "LXGW WenKai TC"', '900 64px "Noto Serif TC"'], capMs: 9000 } as const;

/** the kits' geometry conversion gives the page a turn (the loading panel paints) every this many ms */
export const KIT_YIELD_MS = 30;

/** each silk sheet across the Well is two layers: at its height, and 5 m under it at 70 % */
export const SHEET_LAYERS = [{ dy: 0, alpha: 1 }, { dy: -5, alpha: 0.7 }] as const;

/** soft steam billboards over the noodle stall's pots: six per pot, their seeds 0.37 apart pot to pot */
export const STEAM_PUFFS = { perPoint: 6, stride: 0.37 } as const;
