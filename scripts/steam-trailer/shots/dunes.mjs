// Shard V — Signal Dunes (`sunscar-dunes`, dusk PBR; TRAILERS TR1, E466). Rig keys: p [x, dy, z] metres above the sand
// (rel), l [x, y, z] absolute look-at, unless noted. Coordinates are data/layout.ts's: the spawn crest (0, 70) faces −Z
// over the dune rows to the signal tower (8, −75; its sand ~18 m, the deck +7), the caravan (−78, 28), the waymark
// braziers (58, −34) (−44, −22) (34, −102), the basin north of the tower. The afterglow is to the north-west.
// `window.__wildshard.shard.sunscar` is the plugin (stage, fire, matriarch, whip). Shots share one page in this order: the
// quest state a shot stages stays for the shots after it.
import { NO_VIEWMODEL, VIEWMODEL, at, js, tp } from './lib.mjs';

const D = 'chunk=sunscar-dunes';
/** in-page: the viewmodel back on (rig shots hide the camera's children: the whip hangs there) */
const HANDS = `${VIEWMODEL}for (const c of window.__wildshard.world.game.camera.children) c.visible = true;`;
/** in-page: the plugin's capture handle */
const SUN = 'window.__wildshard.shard.sunscar';
/** in-page: the quest run to its three lit waymarks (the dusk deepens with it) and the tower's signal fire lit, the
 *  Matriarch's summon unhooked (a calm shot: no boss) */
const LIT = `(() => { const s = ${SUN}; s.stage('waymarks-lit'); s.fire.onLight = null; if (!s.fire.lit) s.fire.light(); })();`;
export const shots = [
  // open: off the spawn crest, a rising push over the receding dune rows to the tower on its mound, the afterglow ahead
  { name: 'dn-vista', shard: 'dunes', url: D, secs: 4,
    setup: NO_VIEWMODEL,
    rig: { rel: true, ease: true, keys: [
      { t: 0, p: [-4, 1.4, 82], l: [6, 24, -75], fov: 48 },
      { t: 4, p: [1, 4.5, 64], l: [8, 26, -75], fov: 46 },
    ] } },
  // the tower: a low arc round its mound from the south-east, the frame dark against the afterglow, the ray on patrol
  { name: 'dn-tower', shard: 'dunes', url: D, secs: 4,
    setup: NO_VIEWMODEL,
    rig: { rel: true, keys: [
      { t: 0, p: [36, 1.4, -54], l: [8, 26, -75], fov: 50 },
      { t: 2, p: [32, 1.7, -48], l: [8, 26.5, -75], fov: 50 },
      { t: 4, p: [26, 2.0, -44], l: [8, 27, -75], fov: 50 },
    ] } },
  // the half-buried caravan: a slow push on its tailboard and lantern, the dunes rising behind into the afterglow
  { name: 'dn-caravan', shard: 'dunes', url: D, secs: 4,
    setup: NO_VIEWMODEL,
    rig: { rel: true, ease: true, keys: [
      { t: 0, p: [-60, 1.7, 43], l: [-78, 16.5, 28], fov: 50 },
      { t: 4, p: [-68, 1.4, 36], l: [-78, 17, 28], fov: 46 },
    ] } },
  // gameplay: the whip on a dune strider: two cracks and a heavy double crack as it comes on, the dusk behind it
  { name: 'dn-whip', shard: 'dunes', url: D, secs: 4,
    setup: HANDS,
    afterWarm: `(() => { const w = window.__wildshard?.world; const b = w.animals.animals.filter((a) => a.kind === 'duneStrider' && a.alive).sort((a, c) => a.position.distanceTo(w.player.position) - c.position.distanceTo(w.player.position))[0];
      if (!b) return; window.__prey = b; const px = b.position.x + 5.5, pz = b.position.z + 2.5;
      const p = w.player; p.position.set(px, window.__hf.heightAt(px, pz), pz); p.yaw = Math.atan2(-(b.position.x - px), -(b.position.z - pz)); p.pitch = -0.05; })();`,
    probe: `(() => { const e = window.__prey, p = window.__wildshard.world.player.position; return e ? { kind: e.kind, d: +e.position.distanceTo(p).toFixed(1) } : { kinds: [...new Set(window.__wildshard.world.animals.animals.map((a) => a.kind))] }; })()`,
    tick: (t, i, sb, step) => js(`(() => { const e = window.__prey, p = window.__wildshard.world.player; if (!e) return; const want = Math.atan2(-(e.position.x - p.position.x), -(e.position.z - p.position.z)); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * 0.15; })();`,
      ([0.3, 1.1].some((T) => at(t, T, step)) ? 'window.__wildshard.world.weapons.tryFire();' : ''),
      (at(t, 2.1, step) ? `${SUN}.whip?.swing(true);` : '')) },
  // the signal lit: a crane up past the east waymark's fire to the burning tower across the rows, deep dusk, stars
  { name: 'dn-signal', shard: 'dunes', url: D, secs: 4,
    setup: `${NO_VIEWMODEL}${LIT}`,
    rig: { rel: true, ease: true, keys: [
      { t: 0, p: [66, 1.2, -24], l: [50, 25, -45], fov: 52 },
      { t: 4, p: [68, 6, -20], l: [10, 26, -75], fov: 50 },
    ] } },
  // gameplay: the Dune Matriarch, summoned by the fire, wheels in over the basin rim; the whip cracks up at her
  { name: 'dn-matriarch', shard: 'dunes', url: D, secs: 4, warm: 360,
    setup: `${HANDS}(() => { const s = ${SUN}; s.stage('waymarks-lit'); if (s.matriarch?.state === 'dormant') s.matriarch.arm(); })();${tp(-10, -88, 0, 0.25)}`,
    tick: (t, i, sb, step) => js(`(() => { const b = ${SUN}.matriarch?.body?.(), p = window.__wildshard.world.player; if (!b) return; const want = Math.atan2(-(b.position.x - p.position.x), -(b.position.z - p.position.z)); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * 0.08; const dy = b.position.y - (p.position.y + 1.65), dh = Math.hypot(b.position.x - p.position.x, b.position.z - p.position.z); p.pitch += (Math.min(0.55, Math.max(0.08, Math.atan2(dy, dh))) - p.pitch) * 0.05; })();`,
      ([1.2, 2.7].some((T) => at(t, T, step)) ? 'window.__wildshard.world.weapons.tryFire();' : '')),
    probe: `(() => { const b = ${SUN}.matriarch?.body?.(); return b ? { at: [b.position.x, b.position.y, b.position.z].map((v) => +v.toFixed(1)), state: ${SUN}.matriarch.state } : { state: ${SUN}.matriarch?.state ?? null }; })()` },
];
