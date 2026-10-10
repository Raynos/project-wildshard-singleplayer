// PROGRESS-TRAILER PT4: the two shots on today's build, through the trailer agent's capture
// (`scripts/steam-trailer/capture.mjs --shots-file=scripts/progress-trailer/head-shots.mjs`, 64c6d84f0; their files are
// read, never edited). The cold open is the Nine Dragon teaser's real grapple (LOCK claims the gallery ring, a fresh JUMP
// fires the claw, Rapier carries the player) from a new start look, so frame 0 (the share thumbnail) is not the teaser's
// (R3C-15). The close is the grid's own sky-down reveal, long enough to run on under both end cards (§2.2 0:52–1:00).
import { at, js } from '../steam-trailer/shots/lib.mjs';
import { publicGridIntentCode } from '../public-grid.mjs';

const D = Math.PI / 180;
/** in-page: the player standing at (x, y, z), facing yaw / pitch (radians), the jian in hand (as the teaser's `stand`) */
const stand = (x, y, z, yaw, pitch) => `(() => { const w = window.__wildshard?.world; w.freeCamera = false; w.weapons.visible = true; const p = w.player; p.position.set(${x}, ${y}, ${z}); p.yaw = ${yaw}; p.pitch = ${pitch}; if (p.velocity) p.velocity.set(0, 0, 0); p.keys?.clear(); })();`;
/** in-page per tick: the look eased between two poses (degrees, player convention) */
const lookLerp = (t, t0, t1, a, b) => {
  const k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
  return `window.__wildshard.world.player.yaw = ${((a[0] + (b[0] - a[0]) * e) * D).toFixed(5)}; window.__wildshard.world.player.pitch = ${((a[1] + (b[1] - a[1]) * e) * D).toFixed(5)};`;
};
// the start look: 6° right of and 3° above the teaser's (−0.6, −0.35 rad), still on the gallery ring LOCK claims
const START = [-0.6 + 6 * D, -0.35 + 3 * D];

export const shots = [
  { name: 'pt-grapple', shard: 'nine-dragon', url: 'chunk=nine-dragon-stack', secs: 2.8, warm: 180,
    setup: stand(-19.5, 125, 12.25, START[0], START[1]),
    afterWarm: js(stand(-19.5, 125, 12.25, START[0], START[1]), 'window.__wildshard.world.lockSys.toggle();'),
    tick: (t, i, sb, step) => js(
      at(t, 0.24, step) ? 'window.__wildshard.world.player.touchJump = true;' : '',
      lookLerp(t, 1.25, 2.8, [START[0] / D, START[1] / D], [-10, -9]),
    ),
    probe: `(() => { const w = window.__wildshard?.world; return { position: w.player.position.toArray(), entered: w.hud.entered }; })()` },
  { name: 'pt-grid', shard: 'grid', url: 'chunk=driftwood-isle', init: publicGridIntentCode({ instance: 'driftwood-isle', slug: 'driftwood-isle' }), secs: 8.5, warm: 600,
    afterWarm: 'window.__wildshard.world.hud.enterNow();',
    probe: 'window.__wsReveal ?? null' },
];
