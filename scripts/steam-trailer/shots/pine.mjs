// Shard III — Pine Hollow (photoreal PBR). Rig keys: p/l [x, dy, z] above ground (rel + relLook) unless noted.
import { NO_VIEWMODEL, VIEWMODEL, at, nearest, aimAt, PREY, js } from './lib.mjs';

const P = 'chunk=pine-hollow&clock=1e6';
const GOLD = `${P}&tod=golden&weather=clear&elite=ghost-stag&from=22`;
export const shots = [
  // gameplay: the ghost stag (elite) under the crossbow at golden hour — first in its group, he faces you at boot
  { name: 'p-elite', shard: 'pine', url: GOLD, secs: 4, warm: 120,
    setup: VIEWMODEL,
    afterWarm: `window.__prey = ${nearest('/ghost|stag|elk|deer/', 60)};`, probe: PREY,
    tick: (t, i, sb, step) => js(aimAt('window.__prey'), at(t, 1.6, step) ? 'window.__world.weapons.adsHeld = true;' : '', at(t, 2.4, step) ? 'window.__world.weapons.tryFire();' : '', at(t, 3.2, step) ? 'window.__world.weapons.adsHeld = false;' : '') },
  // old growth: the standing stones in low sun, a slow push between trunks
  { name: 'p-stones', shard: 'pine', url: GOLD, secs: 4,
    setup: NO_VIEWMODEL,
    rig: { rel: true, relLook: true, ease: true, keys: [
      { t: 0, p: [124, 1.6, -20], l: [178, 7, -34], fov: 52 },
      { t: 4, p: [131, 2.0, -23], l: [178, 7, -34], fov: 50 },
    ] } },
  // the last shot: a pull back and up off the ridge over the whole hollow (the end card lands on it)
  { name: 'p-final', shard: 'pine', url: GOLD, secs: 5,
    setup: NO_VIEWMODEL,
    rig: { rel: true, relLook: true, ease: true, keys: [
      { t: 0, p: [24, 5, 196], l: [-10, 8, 60], fov: 55 },
      { t: 5, p: [27, 11, 204], l: [-14, 6, 56], fov: 57 },
    ] } },
  // dawn in the hollow: fog through the pines onto the first cabin
  { name: 'p-dawn', shard: 'pine', url: `${P}&tod=dawn&weather=fog`, secs: 4,
    setup: NO_VIEWMODEL,
    rig: { rel: true, relLook: true, ease: true, keys: [
      { t: 0, p: [8, 1.4, -64], l: [-14, 3.5, -34], fov: 50 },
      { t: 4, p: [2, 2.4, -54], l: [-14, 3.5, -34], fov: 48 },
    ] } },
  // the pond and the waterfall at sunset
  { name: 'p-pond', shard: 'pine', url: `${P}&tod=sunset&weather=clear`, secs: 4,
    setup: NO_VIEWMODEL,
    rig: { rel: true, relLook: true, keys: [
      { t: 0, p: [-56, 1.7, 92], l: [-88, 12, 152], fov: 52 },
      { t: 4, p: [-64, 1.5, 100], l: [-88, 12, 152], fov: 52 },
    ] } },
  // the Antler King at night, phase 2, a low push in
  { name: 'p-king', shard: 'pine', url: `${P}&boss=antler-king&bossGod=1&bossPhase=2&from=18`, secs: 4, warm: 400, waitFor: 'Boolean(window.__antlerKing?.fight?.king)',
    setup: `${NO_VIEWMODEL}(() => { const K = window.__antlerKing; const k = K.fight.king.position; window.__tr.setRig({ rel: true, ease: true, keys: [ { t: 0, p: [158, 1.6, -8], l: [k.x, k.y + 3.5, k.z], fov: 58 }, { t: 4, p: [155, 1.1, -14], l: [k.x, k.y + 4.2, k.z], fov: 50 } ] }); })();` },
  { name: 'p-king-fp', shard: 'pine', url: `${P}&boss=antler-king&bossGod=1&bossPhase=2&from=18`, secs: 4, waitFor: 'Boolean(window.__antlerKing?.fight?.king)',
    setup: VIEWMODEL,
    tick: (t, i, sb, step) => js(`(() => { const K = window.__antlerKing; const k = K.fight.king.position; const p = window.__world.player; const want = Math.atan2(-(k.x - p.position.x), -(k.z - p.position.z)); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * 0.1; const dy = k.y + 3.6 - (p.position.y + 1.65), dh = Math.hypot(k.x - p.position.x, k.z - p.position.z); p.pitch += (Math.atan2(dy, dh) - p.pitch) * 0.08; })();`,
      (at(t, 1.0, step) || at(t, 2.6, step) ? 'window.__world.weapons.tryFire();' : '')) },
];
