// Shard VI — Sky Reach (`far-reach`, golden-hour toon; TRAILERS TR1, E466). Islands float over a cloud sea, so every
// key is absolute (no `rel`: the heightfield under an islet is the sea far below). Coordinates are data/layout.ts's:
// Sunrest (0, 0) deck 30 with the rise behind the spawn, the windmill isle (0, −64) deck 30 across the rope bridge, the
// grove (−54, 5), the Roost (60, −12) +34, the keeper (−58, −60), the ruin (65, −72), the high step (−64, −126) +44 with the
// winch, the storm crown (0, −190) +44 under the vortex. The low sun stands west-north-west (azimuth 300°): looking north
// or west is into the glow. `window.__wildshard.shard.farReach` is the plugin (stage, raise, roc, built).
// Rig shots park the player on Sunrest under a free camera (bootstrap `freeCamera`, as nine-dragon.mjs does): nothing
// falls into the clouds under the lens.
import { at } from './lib.mjs';

const U = 'chunk=far-reach';
const FR = 'window.__wildshard.shard.farReach';
/** in-page: a free camera with the player parked at the spawn */
const FREE = `(() => { const w = window.__wildshard?.world; w.freeCamera = true; w.weapons.visible = false; const p = w.player; p.position.set(0, 30, -5.5); if (p.velocity) p.velocity.set(0, 0, 0); p.keys?.clear(); })();`;
/** in-page: the player standing on the crown's south rise, facing north into the storm, the fan away */
const CROWN = `(() => { const w = window.__wildshard?.world; w.freeCamera = false; w.weapons.visible = false; const p = w.player; p.position.set(0, 46.5, -175.5); p.yaw = 0; p.pitch = 0.1; if (p.velocity) p.velocity.set(0, 0, 0); p.keys?.clear(); })();`;
export const shots = [
  // open: up out of the cloud sea beside Sunrest's keel, craning over its rim to the archipelago and the windmill
  { name: 'sr-rise', shard: 'sky-reach', url: U, secs: 4,
    setup: FREE,
    rig: { carryPlayer: false, ease: true, keys: [
      { t: 0, p: [14, 18, 34], l: [-2, 30, -60], fov: 52 },
      { t: 4, p: [6, 46, 40], l: [-4, 26, -70], fov: 54 },
    ] } },
  // the rope bridge: off the spawn rise and down its planks toward the windmill isle, sails turning in the low sun
  { name: 'sr-bridge', shard: 'sky-reach', url: U, secs: 4,
    setup: FREE,
    rig: { carryPlayer: false, keys: [
      { t: 0, p: [0.3, 34.4, 6], l: [0, 34, -64], fov: 54 },
      { t: 4, p: [0.2, 32.6, -12], l: [0, 35, -64], fov: 54 },
    ] } },
  // the windmill: a low arc under its sails, the isles hanging in the glow behind
  { name: 'sr-windmill', shard: 'sky-reach', url: U, secs: 4,
    setup: FREE,
    rig: { carryPlayer: false, ease: true, keys: [
      { t: 0, p: [-12, 31.6, -50], l: [0, 39, -66], fov: 56 },
      { t: 4, p: [-3, 31.4, -47], l: [2, 40, -66], fov: 54 },
    ] } },
  // the archipelago: a slow lateral drift high over the cloud sea, every isle dripping its waterfalls in the sun
  { name: 'sr-aerial', shard: 'sky-reach', url: U, secs: 4,
    setup: FREE,
    rig: { carryPlayer: false, keys: [
      { t: 0, p: [-30, 90, 70], l: [-10, 30, -90], fov: 55 },
      { t: 4, p: [20, 92, 72], l: [6, 30, -90], fov: 55 },
    ] } },
  // the winch: the crown bridge swings up off the high step toward the storm crown, seen side-on from the east (the
  // winch's own motion, in play)
  { name: 'sr-winch', shard: 'sky-reach', url: U, secs: 4,
    setup: `${FREE}${FR}.stage('quest-winch');`,
    rig: { carryPlayer: false, ease: true, keys: [
      { t: 0, p: [-2, 50, -128], l: [-36, 42, -160], fov: 56 },
      { t: 4, p: [-8, 52, -124], l: [-34, 43, -162], fov: 54 },
    ] },
    tick: (t, i, sb, step) => (at(t, 0.4, step) ? `${FR}.raise();` : '') },
  // the storm crown: the Storm Roc lifts off its perch under the vortex, lightning in the storm (quest done, the fight on)
  { name: 'sr-roc', shard: 'sky-reach', url: U, secs: 4, warm: 300,
    setup: `${CROWN}${FR}.stage('quest-crown');`,
    afterWarm: `${FR}.stage('roc-opening');`,
    rig: { carryPlayer: false, ease: true, keys: [
      { t: 0, p: [1.2, 47.6, -173], l: [0, 54, -200], fov: 58 },
      { t: 4, p: [0.6, 47.2, -177], l: [0, 56, -200], fov: 56 },
    ] },
    probe: `(() => { const r = ${FR}.roc; return r ? { alive: r.alive, at: [r.position.x, r.position.y, r.position.z].map((v) => +v.toFixed(1)) } : null; })()` },
];
