// The grid — one world (TRAILERS TR1, E466). The public 3×3 (src/game/grid/singleplayer.json, pitch 555 m): Driftwood the
// home cell at (0, 0), Signal Dunes west (−555, 0), Nalati east (555, 0), Pine Hollow north (0, 555), Sky Reach south
// (0, −555), the highway on the seams between them (x / z ±277.5). x east, z north; forward = (−sin yaw, −cos yaw).
// The page boots into the grid exactly as the title's Infinite Wildshard tap does: the tap's one-shot intent seeded before
// the boot (scripts/public-grid.mjs, the same seed the public-grid witness uses; no URL switch), then `chunk=` names the
// home cell's shard. Render coordinates start at the home cell's origin (Driftwood: world = render until a crossing).
// A held-input crossing from the road into a cell is not here yet: under the capture clock the cell screen ("LOADING
// DRIFTWOOD ISLE") stands on the seam for the whole drive, even into the home cell.
// The entry's sky-down reveal plays once per boot: a later shot on the same page (same url + init) starts after it.
import { publicGridIntentCode } from '../../public-grid.mjs';

const URL = 'chunk=driftwood-isle';
const INIT = publicGridIntentCode({ instance: 'driftwood-isle', slug: 'driftwood-isle' });
export const shots = [
  // the entry (SF21a, Jake's G98 "sky-down reveal"): the game's own camera comes down from ~400 m over Driftwood's pier to
  // the player's eye, the highway and the neighbouring shards' regions round it on the way. No rig: the reveal flies it.
  // (the reveal starts when the HUD enters: here after a 10 s warm-up, the neighbours streamed in as they are by the time
  // a player has read the title and tapped)
  { name: 'g-reveal', shard: 'grid', url: URL, init: INIT, secs: 5, warm: 600,
    afterWarm: 'window.__wildshard.world.hud.enterNow();',
    probe: 'window.__wsReveal ?? null' },
];
