// Shard I — Driftwood Isle (toon). Rig keys: t (s), p [x, dy, z] above ground/sea (rel), l [x, y, z] absolute look-at.
import { NO_VIEWMODEL, VIEWMODEL, keyDown, at, aimAt, PREY, js } from './lib.mjs';

const D = 'chunk=driftwood-isle';
export const shots = [
  // open: over the sea, pushing in on the island, the gas giant high to the right
  { name: 'd-open', shard: 'driftwood', url: D, secs: 4,
    setup: NO_VIEWMODEL,
    rig: { rel: true, ease: true, keys: [
      { t: 0, p: [-60, 34, -400], l: [30, 60, -60], fov: 52 },
      { t: 4, p: [-24, 16, -300], l: [20, 30, -80], fov: 56 },
    ] } },
  // the pier: a low tracking dolly along the planks, towards the island
  { name: 'd-pier', shard: 'driftwood', url: D, secs: 4,
    setup: NO_VIEWMODEL,
    rig: { rel: true, keys: [
      { t: 0, p: [2.2, 2.2, -246], l: [0, 3, -150], fov: 62 },
      { t: 4, p: [1.6, 2.4, -228], l: [0, 4, -120], fov: 62 },
    ] } },
  // the ring shrine: a slow low orbit, the planet through the ring
  { name: 'd-shrine', shard: 'driftwood', url: D, secs: 4,
    setup: NO_VIEWMODEL,
    rig: { rel: true, keys: [
      { t: 0, p: [-85, 2.6, 91], l: [-98, 5, 108], fov: 55 },
      { t: 2, p: [-83.5, 3.0, 95], l: [-98, 5.5, 108], fov: 54 },
      { t: 4, p: [-82.5, 3.4, 99], l: [-98, 6, 108], fov: 53 },
    ] } },
  // the lookout: crane up from the headland to the whole island
  { name: 'd-lookout', shard: 'driftwood', url: D, secs: 4,
    setup: NO_VIEWMODEL,
    rig: { rel: true, ease: true, keys: [
      { t: 0, p: [102, 7, 113], l: [30, -2, -20], fov: 60 },
      { t: 4, p: [104, 18, 118], l: [0, -4, -120], fov: 60 },
    ] } },
  // the rope bridge over the tidal creek, walked in first person
  { name: 'd-bridge', shard: 'driftwood', url: `${D}&x=13&z=11&yaw=${Math.atan2(-(32 - 13), -(30 - 11)).toFixed(4)}&pitch=-0.05`, secs: 4, warm: 90,
    setup: VIEWMODEL, afterWarm: keyDown('KeyW'),
    tick: (t) => `window.__world.player.pitch = ${(-0.04 + Math.sin(t * 1.3) * 0.02).toFixed(4)};` },
  // the wreck in its cove
  { name: 'd-wreck', shard: 'driftwood', url: D, secs: 4,
    setup: NO_VIEWMODEL,
    rig: { rel: true, ease: true, keys: [
      { t: 0, p: [128, 6, -20], l: [153, 3, 2], fov: 55 },
      { t: 4, p: [134, 3, -10], l: [153, 3, 2], fov: 50 },
    ] } },
  // gameplay: the iron sword's combo and a charged heavy on a boar, from the sea side (the island behind him)
  { name: 'd-combo', shard: 'driftwood', url: `${D}&x=45&z=-160&yaw=3.1416&weapon=iron`, secs: 4,
    setup: VIEWMODEL,
    afterWarm: `(() => { const w = window.__world; const b = w.animals.animals.filter((a) => a.kind === 'boar' && a.alive).sort((a, c) => a.position.distanceTo(w.player.position) - c.position.distanceTo(w.player.position))[0];
      if (!b) return; window.__prey = b; const l = Math.hypot(b.position.x, b.position.z) || 1, px = b.position.x + b.position.x / l * 2.6, pz = b.position.z + b.position.z / l * 2.6;
      const p = w.player; p.position.set(px, window.__hf.heightAt(px, pz), pz); p.yaw = Math.atan2(-(b.position.x - px), -(b.position.z - pz)); p.pitch = -0.12; })();`,
    probe: PREY,
    tick: (t, i, sb, step) => js(aimAt('window.__prey', 0.25, 0.4),
      ([0.25, 0.65, 1.05].some((T) => at(t, T, step)) ? 'window.__world.weapons.tryFire();' : ''),
      (at(t, 1.4, step) ? 'window.__world.weapons.adsHeld = true;' : ''),
      (at(t, 2.1, step) ? 'window.__world.weapons.adsHeld = false;' : '')) },
  // gameplay: off the pier's end into the lagoon — swim out, dive to the coral (the lagoon is 1.5–3 m deep here)
  { name: 'd-reef', shard: 'driftwood', url: `${D}&x=4&z=-247&yaw=0.35&pitch=-0.35`, secs: 4, warm: 60,
    setup: VIEWMODEL, afterWarm: `${keyDown('KeyW')}${keyDown('Space')}`,
    tick: (t) => `window.__world.player.pitch = ${(-0.35 - 0.2 * Math.min(1, t / 2)).toFixed(4)}; window.__world.player.yaw = ${(0.35 + t * 0.06).toFixed(4)};` },
];
