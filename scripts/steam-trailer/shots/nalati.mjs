// Shard II — Nalati Grasslands (painterly steppe). Rig keys: p [x, dy, z] above ground (rel), l absolute unless relLook.
import { NO_VIEWMODEL, VIEWMODEL, keyDown, lerp, ease, at, nearest, aimAt, PREY, js } from './lib.mjs';

const N = 'chunk=nalati-grasslands&time=golden&clock=0';
export const shots = [
  // gameplay: the bow drawn on Kökbori, the wolf elite, at golden hour (first in its group: he faces you at boot)
  { name: 'n-bow', shard: 'nalati', url: `${N}&elite=kokbori&from=24`, secs: 4, warm: 120,
    setup: VIEWMODEL,
    afterWarm: `window.__prey = ${nearest('/kokbori|wolf/', 70)};`, probe: PREY,
    tick: (t, i, sb, step) => js(aimAt('window.__prey', 0.12, 0.5),
      (at(t, 0.4, step) ? 'window.__world.weapons.altHeld = true;' : ''),
      (at(t, 2.2, step) ? 'window.__world.weapons.altHeld = false;' : '')) },
  // open: a crane off the escarpment over the sea of grass, the planet low on the horizon
  { name: 'n-open', shard: 'nalati', url: `${N}&elite=kokbori&from=24`, secs: 4,
    setup: NO_VIEWMODEL,
    rig: { rel: true, ease: true, keys: [
      { t: 0, p: [40, 48, 262], l: [0, 30, 40], fov: 50 },
      { t: 4, p: [22, 20, 196], l: [-10, 12, 40], fov: 55 },
    ] } },
  // the herd, stampeding past a low camera
  { name: 'n-herd', shard: 'nalati', url: `${N}&elite=kokbori&from=24`, secs: 4,
    setup: `${NO_VIEWMODEL}(() => { const w = window.__world, wl = w.wildlife; const h = wl.herds.find((x) => x.stallion) ?? wl.herds[0]; const s = h.stallion ?? { position: { x: h.cx ?? h.x, z: h.cz ?? h.z } };
      const cx = s.position.x, cz = s.position.z; window.__herdAt = [cx, cz];
      window.__tr.setRig({ rel: true, relLook: true, keys: [ { t: 0, p: [cx + 16, 1.3, cz - 10], l: [cx, 1.4, cz], fov: 48 }, { t: 4, p: [cx + 18, 1.2, cz + 2], l: [cx - 4, 1.6, cz + 8], fov: 46 } ] }); })();`,
    afterWarm: `(() => { const [x, z] = window.__herdAt; window.__world.wildlife.scare(x - 14, z - 12, 40); })();` },
  // the camp: yurts and smoke, a slow orbit
  { name: 'n-camp', shard: 'nalati', url: `${N}&elite=kokbori&from=24`, secs: 4,
    setup: NO_VIEWMODEL,
    rig: { rel: true, relLook: true, keys: [
      { t: 0, p: [66, 3.2, 190], l: [90, 2, 212] , fov: 50 },
      { t: 2, p: [72, 3.6, 186], l: [90, 2, 212], fov: 50 },
      { t: 4, p: [79, 4.0, 184], l: [90, 2, 212], fov: 50 },
    ] } },
  // gameplay: at the gallop down the north road
  { name: 'n-gallop', shard: 'nalati', url: `${N}&ride=gallop`, secs: 4, warm: 150,
    setup: VIEWMODEL,
    afterWarm: `${keyDown('KeyW')}${keyDown('ShiftLeft')}`,
    tick: (t) => `window.__world.player.pitch = ${lerp(-0.02, 0.03, ease(t / 4)).toFixed(4)};` },
  // gameplay: horse archery — draw and loose at the gallop, twice
  { name: 'n-archer', shard: 'nalati', url: `${N}&ride=gallop`, secs: 4, warm: 150,
    setup: VIEWMODEL,
    afterWarm: `${keyDown('KeyW')}${keyDown('ShiftLeft')}`,
    tick: (t, i, sb, step) => js(`window.__world.player.pitch = ${lerp(0.02, 0.08, ease(t / 4)).toFixed(4)}; window.__world.player.yaw += ${(Math.sin(t * 0.9) * 0.0012).toFixed(5)};`,
      (at(t, 0.5, step) || at(t, 2.3, step) ? 'window.__world.weapons.altHeld = true;' : ''),
      (at(t, 1.6, step) || at(t, 3.4, step) ? 'window.__world.weapons.altHeld = false;' : '')) },
  // the Storm Titan over the cairn, in the storm (phase 2: risen): a low push-in from horse-eye height, tilting up to his heart
  { name: 'n-titan', shard: 'nalati', url: 'chunk=nalati-grasslands&boss=storm-titan&bossGod=1&bossPhase=2', secs: 4, warm: 360, waitFor: 'Boolean(window.__titan?.fight?.body?.root)',
    // the arena's storm wall (two cloud cylinders) reads as a flat grey slab from inside it: out of the cinematic frames
    setup: `${NO_VIEWMODEL}window.__tr.hide = ['titan-storm-wall'];`,
    afterWarm: `(() => { const w = window.__world, T = window.__titan, p = w.player.position; const h = T.fight.body.heartWorld(w.game.camera.position.clone());
      const dx = h.x - p.x, dz = h.z - p.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
      window.__tr.setRig({ rel: true, ease: true, keys: [ { t: 0, p: [p.x - ux * 8 + uz * 3, 2.6, p.z - uz * 8 - ux * 3], l: [h.x, h.y - 6, h.z], fov: 60 }, { t: 4, p: [p.x - ux * 4.5 + uz * 2.6, 2.3, p.z - uz * 4.5 - ux * 2.6], l: [h.x, h.y + 2, h.z], fov: 55 } ] }); })();`,
    probe: `(() => { const w = window.__world, T = window.__titan; const h = T.fight.body.heartWorld(w.game.camera.position.clone()); return { heart: [h.x, h.y, h.z].map((v) => +v.toFixed(1)), player: [w.player.position.x, w.player.position.y, w.player.position.z].map((v) => +v.toFixed(1)) }; })()` },
  { name: 'n-titan-fp', shard: 'nalati', url: 'chunk=nalati-grasslands&boss=storm-titan&bossGod=1&bossPhase=2', secs: 4, waitFor: 'Boolean(window.__titan?.fight?.body?.root)',
    setup: `${VIEWMODEL}window.__tr.hide = ['titan-storm-wall'];`,
    // step 6 m out toward him, clear of the horse standing at your right shoulder
    afterWarm: `(() => { const w = window.__world, p = w.player.position, h = window.__titan.fight.body.heartWorld(w.game.camera.position.clone()); const dx = h.x - p.x, dz = h.z - p.z, l = Math.hypot(dx, dz) || 1; const x = p.x + dx / l * 6 - dz / l * 3, z = p.z + dz / l * 6 + dx / l * 3; p.set(x, window.__hf.heightAt(x, z), z); })();`,
    tick: (t, i, sb, step) => js(`(() => { const T = window.__titan, p = window.__world.player; const r = T.fight.body.heartWorld(window.__world.game.camera.position.clone()); const want = Math.atan2(-(r.x - p.position.x), -(r.z - p.position.z)); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * 0.1; const dy = r.y - (p.position.y + 2.4), dh = Math.hypot(r.x - p.position.x, r.z - p.position.z); p.pitch += (Math.atan2(dy, dh) * 0.8 - p.pitch) * 0.08; })();`,
      (at(t, 0.4, step) || at(t, 2.3, step) ? 'window.__world.weapons.altHeld = true;' : ''),
      (at(t, 1.5, step) || at(t, 3.4, step) ? 'window.__world.weapons.altHeld = false;' : '')) },
];
