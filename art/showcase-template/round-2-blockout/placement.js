// Round 2 content placement: packs, elite lairs, cover, chests, loot crates, quest targets, and the fit maths.
// Pure JS (no three) so `node placement.js` prints the census and the checks, and lab.js draws the same result.
import { HALF, STRIP, RING, AVENUE_HALF, ZONES, BANDS, VARIANTS, ELITES, ELITE_LAIR_R, GATE_ELITES, ELITE_AWARE, GRIND, QUESTS,
  REAL } from './layout.js';

export function inZone(zn, x, z, m = 0) {
  if (zn.shape === 'rect') return x >= zn.x0 - m && x <= zn.x1 + m && z >= zn.z0 - m && z <= zn.z1 + m;
  if (zn.shape === 'disc') return (x - zn.x) ** 2 + (z - zn.z) ** 2 <= (zn.r + m) ** 2;
  if (zn.shape === 'stadium') { const dx = Math.max(0, Math.abs(x - zn.x) - zn.halfLen); return dx * dx + (z - zn.z) ** 2 <= (zn.r + m) ** 2; }
  if (zn.shape === 'rects') return zn.list.some(([x0, x1, z0, z1]) => x >= x0 - m && x <= x1 + m && z >= z0 - m && z <= z1 + m);
  return false;
}
export function zoneArea(zn) {
  if (zn.shape === 'rect') return (zn.x1 - zn.x0) * (zn.z1 - zn.z0);
  if (zn.shape === 'disc') return Math.PI * zn.r ** 2;
  if (zn.shape === 'stadium') return 2 * zn.halfLen * 2 * zn.r + Math.PI * zn.r ** 2;
  return zn.list.reduce((a, [x0, x1, z0, z1]) => a + (x1 - x0) * (z1 - z0), 0);
}
export function isCirculation(x, z) {
  const ax = Math.abs(x), az = Math.abs(z), m = Math.max(ax, az), r = Math.hypot(x, z);
  if (m >= STRIP.inner) return true;
  if (r >= RING.inner && r <= RING.outer) return true;
  if ((ax <= AVENUE_HALF && r > RING.outer) || (az <= AVENUE_HALF && r > RING.outer)) return true;
  return false;
}
export function budget() {
  const out = { west: 0, cand: 0, set: 0, band: 0, circ: 0, free: 0, overlap: 0 };
  for (let x = -249.5; x < 250; x++) for (let z = -249.5; z < 250; z++) {
    const hits = ZONES.filter(zn => inZone(zn, x, z));
    if (hits.length > 1) out.overlap++;
    if (hits.length) out[hits[0].kind]++;
    else if (isCirculation(x, z)) out.circ++;
    else out.free++;
  }
  return out;
}

const bandZone = b => ZONES.find(z => z.kind === 'band' && z.band === b);
const rectsOf = zn => zn.shape === 'rects' ? zn.list : [[zn.x0, zn.x1, zn.z0, zn.z1]];
const YARD = ZONES.find(z => z.id === '07');
const SETS = ZONES.filter(z => z.kind === 'set');
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const spacingOf = B => B.walled ? B.leash + 3 : B.leash + B.aware + 3;
export const openSpacing = B => B.leash + B.aware + 3;

// Where a fight may stand: inside its band (6 m off the band edge, walls), off the walled road, clear of the hub, the
// seam and the edge strip, and outside every set piece (12 m clear: their own fights, intros and patrols), except
// band 5, whose packs are the stealth yard's patrols.
function packOk(B, x, z) {
  const zn = bandZone(B.band);
  if (!rectsOf(zn).some(([x0, x1, z0, z1]) => x >= x0 + 6 && x <= x1 - 6 && z >= z0 + 6 && z <= z1 - 6)) return false;
  if (Math.abs(z) < 16 || x < 16 || Math.hypot(x, z) < RING.outer + 14 || Math.max(Math.abs(x), Math.abs(z)) > STRIP.inner - 6) return false;
  for (const s of SETS) {
    if (B.yardSpacing && s === YARD) { if (!inZone(s, x, z, -6)) return false; continue; }
    if (inZone(s, x, z, 12)) return false;
  }
  if (B.yardSpacing && !inZone(YARD, x, z, -6)) return false;
  if (B.yardSpacing && x > 200 && z > 110) return false;   // the keycard shed corner
  return true;
}

// Best hex lattice at the band's spacing (tries offsets and two rotations), minus anything too close to packs
// already placed in earlier bands. Returns every slot: the capacity.
function lattice(B, others) {
  const s = B.yardSpacing ?? spacingOf(B), zn = bandZone(B.band);
  const [bx0, bx1, bz0, bz1] = rectsOf(zn).reduce(([a, b, c, d], [x0, x1, z0, z1]) => [Math.min(a, x0), Math.max(b, x1), Math.min(c, z0), Math.max(d, z1)], [1e9, -1e9, 1e9, -1e9]);
  let best = [];
  for (const rot of [0, Math.PI / 6]) for (let ox = 0; ox < 1; ox += 1 / 8) for (let oz = 0; oz < 1; oz += 1 / 8) {
    const pts = [], c = Math.cos(rot), sn = Math.sin(rot), h = s * Math.sqrt(3) / 2;
    for (let j = -12; j <= 12; j++) for (let i = -12; i <= 12; i++) {
      const u = (i + ox + (j % 2 ? .5 : 0)) * s, v = (j + oz) * h;
      const x = (bx0 + bx1) / 2 + u * c - v * sn, z = (bz0 + bz1) / 2 + u * sn + v * c;
      if (!packOk(B, x, z)) continue;
      if (others.some(o => Math.hypot(o.x - x, o.z - z) < Math.max(s, o.spacing))) continue;
      pts.push({ x, z });
    }
    if (pts.length > best.length) best = pts;
  }
  return best;
}

let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export function place() {
  seed = 11;
  const packs = [], lairs = [], fit = [];
  for (const B of BANDS) {
    const s = B.yardSpacing ?? spacingOf(B);
    const slots = lattice(B, packs.map(p => ({ x: p.x, z: p.z, spacing: p.spacing })));
    const need = B.packsPerTier * 3, hasLair = ELITES.some(e => e.band === B.band);
    const from = p => Math.hypot(p.x - B.entry[0], p.z - B.entry[1]);
    slots.sort((a, b) => from(a) - from(b));
    // the elite lair takes the slot farthest from the entry; its 16 m awareness clears the slots within 44 m
    let lair = null;
    if (slots.length && ELITES.some(e => e.band === B.band)) {
      lair = slots[slots.length - 1];
      const clear = ELITE_AWARE + B.leash + 3;  // the lair's neighbours
      for (let i = slots.length - 2; i >= 0; i--) if (dist(slots[i], lair) < clear && slots.length - 1 > need) slots.splice(i, 1);
      slots.pop();
    }
    // keep `need` packs spread evenly along the band (drop extras between them)
    const keep = slots.length <= need ? slots : Array.from({ length: need }, (_, k) => slots[Math.round(k * (slots.length - 1) / (need - 1))]);
    keep.forEach((p, k) => {
      const tier = Math.min(2, Math.floor(k * 3 / keep.length));
      packs.push({ band: B.band, x: p.x, z: p.z, tier, lv: B.lv[tier], size: B.packSize, spacing: s, enemy: B.enemy,
        night: false, rare: false, inYard: !!B.yardSpacing });
    });
    const mine = packs.filter(p => p.band === B.band);
    // night shift: the two top-tier packs swap to lamp-eyed variants after dark (rare variants are a roll, no points)
    mine.slice(-VARIANTS.nightPointsPerBand).forEach(p => { p.night = true; });
    if (lair) { const E = ELITES.find(e => e.band === B.band); lairs.push({ band: B.band, x: lair.x, z: lair.z, name: E.name, lv: E.lv }); }
    let minGap = Infinity;
    for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) minGap = Math.min(minGap, dist(mine[i], mine[j]));
    fit.push({ band: B.band, enemy: B.enemy, spacing: s, capacity: slots.length + (lair ? 1 : 0), need: need + (hasLair ? 1 : 0), placed: mine.length,
      lair: !!lair, minGap: Math.round(minGap), enemies: mine.reduce((a, p) => a + p.size, 0) });
  }

  // cover between packs: dart throw, 12 m apart, 8 m off pack centres (each fight keeps an open r 8 floor)
  const cover = [];
  // the fix's walls: a 3 m, 12 m long wall across the midline of every walled-band pack pair inside open spacing
  for (const B of BANDS.filter(b => b.walled || b.yardSpacing)) {
    const mine = packs.filter(p => p.band === B.band);
    for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) {
      const a = mine[i], b = mine[j], d = dist(a, b);
      if (d >= openSpacing(B)) continue;
      cover.push({ band: B.band, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, kind: 'sightwall', ry: -Math.atan2(b.z - a.z, b.x - a.x) + Math.PI / 2, h: 1 });
    }
  }
  for (const B of BANDS) {
    const zn = bandZone(B.band), mine = packs.filter(p => p.band === B.band), lair = lairs.find(l => l.band === B.band);
    for (let t = 0; t < 9000; t++) {
      const [x0, x1, z0, z1] = rectsOf(zn)[Math.floor(rnd() * rectsOf(zn).length)];
      const x = x0 + 4 + rnd() * (x1 - x0 - 8), z = z0 + 4 + rnd() * (z1 - z0 - 8);
      if (Math.abs(z) < 11 || x < 12 || Math.hypot(x, z) < RING.outer + 6) continue;
      if (SETS.some(s => s === YARD && B.yardSpacing ? false : inZone(s, x, z, 4))) continue;
      if (mine.some(p => Math.hypot(p.x - x, p.z - z) < 8) || (lair && Math.hypot(lair.x - x, lair.z - z) < ELITE_LAIR_R + 3)) continue;
      if (cover.some(c => Math.hypot(c.x - x, c.z - z) < (B.yardSpacing ? 9 : 12))) continue;
      const theme = rnd() < .72 ? B.cover : rnd() < .5 ? 'crates' : 'half';
      cover.push({ band: B.band, x, z, kind: theme, ry: Math.floor(rnd() * 4) * Math.PI / 2 + (rnd() - .5) * .3, h: rnd() });
    }
  }
  // per band: 2 loot chests (LW5) beside cover in the top two tiers; 6 breakable loot crates beside cover
  const chests = [], crates = [];
  for (const B of BANDS) {
    const mine = packs.filter(p => p.band === B.band);
    const cv = cover.filter(c => c.band === B.band);
    const near = p => cv.reduce((b, c) => (dist(c, p) < dist(b, p) ? c : b), cv[0]);
    for (const p of [mine[Math.floor(mine.length * .5)], mine[mine.length - 1]]) if (p && cv.length) { const c = near(p); chests.push({ band: B.band, x: c.x + 3, z: c.z + 3 }); }
    for (let k = 0; k < 6 && cv.length; k++) { const c = cv[Math.floor((k + .5) / 6 * cv.length)]; crates.push({ band: B.band, x: c.x - 3, z: c.z + 2.5 }); }
  }
  // quest targets: one per band tier (the tier's packs), plus the specials in layout.js
  const quests = [];
  for (const B of BANDS) for (let t = 0; t < 3; t++) {
    const tp = packs.filter(p => p.band === B.band && p.tier === t); if (!tp.length) continue;
    quests.push({ band: B.band, lock: B.lv[t], name: `${B.enemy} Mk ${'I'.repeat(t + 1)}`, x: tp.reduce((a, p) => a + p.x, 0) / tp.length, z: tp.reduce((a, p) => a + p.z, 0) / tp.length });
  }
  for (const q of QUESTS) quests.push(q);
  return { packs, lairs, cover, chests, crates, quests, fit };
}

// Cover reach: for floor in the bands (off the road and set pieces), metres to the nearest cover or pack crate.
export function coverReach(P, withCover = true) {
  const pts = [];
  for (const c of withCover ? P.cover : []) pts.push(c);
  for (const p of P.packs) pts.push({ x: p.x + 6, z: p.z - 5 });   // round 1's rule: 3 crates beside each pack
  const ds = [];
  for (const B of BANDS) for (const [x0, x1, z0, z1] of rectsOf(bandZone(B.band))) for (let x = x0 + 1; x < x1; x += 2) for (let z = z0 + 1; z < z1; z += 2) {
    if (Math.abs(z) < 9 || SETS.some(s => inZone(s, x, z))) continue;
    let m = Infinity; for (const q of pts) { const d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < m) m = d; }
    ds.push(Math.sqrt(m));
  }
  ds.sort((a, b) => a - b);
  return { p50: Math.round(ds[Math.floor(ds.length * .5)]), p95: Math.round(ds[Math.floor(ds.length * .95)]), max: Math.round(ds[ds.length - 1]) };
}

// The grind, per band: kills for the band's three levels, and the loop back. A pack respawns ~90 s after you leave
// it; clearing a tier's n packs and walking back to the first must take >= 90 s, or you wait. Grey (6 below) pays 0.
export function grind(P) {
  return BANDS.map(B => {
    const kills = B.lv.reduce((a, l) => a + (GRIND.killsPerLevel[l - 1] ?? 0), 0);
    const mine = P.packs.filter(p => p.band === B.band);
    const tiers = [0, 1, 2].map(t => mine.filter(p => p.tier === t));
    const loops = tiers.map(tp => {
      if (!tp.length) return 0;
      const packS = B.packSize / GRIND.killsPerMin * 60;
      let walk = 0; for (let i = 1; i < tp.length; i++) walk += dist(tp[i], tp[i - 1]);
      walk += dist(tp[tp.length - 1], tp[0]);
      return (tp.length - 1) * packS + walk / REAL.walk;     // from leaving pack 1 until you are back at it
    });
    const loopS = Math.round(Math.min(...loops));
    const pool = Math.min(...tiers.map(tp => tp.reduce((a, p) => a + p.size, 0)));
    const perLevel = B.lv.map(l => GRIND.killsPerLevel[l - 1] ?? 0);
    return { band: B.band, kills, minutes: Math.round(kills / GRIND.killsPerMin), pool, loopBackS: loopS,
      waits: loopS < GRIND.respawnS, loopsPerLevel: (Math.max(...perLevel) / pool).toFixed(1) };
  });
}

// Phone budget: from every pack, the most enemies in a portrait view (33 deg wide, to 100 m) and awake within 80 m.
export function onScreen(P) {
  const all = [];
  for (const p of P.packs) for (let k = 0; k < p.size; k++) all.push({ x: p.x + Math.cos(k * 2.4) * 3, z: p.z + Math.sin(k * 2.4) * 3 });
  let view = 0, awake = 0, near150 = 0, awake60 = 0;
  for (const p of P.packs) {
    awake = Math.max(awake, all.filter(e => Math.hypot(e.x - p.x, e.z - p.z) <= 80).length);
    awake60 = Math.max(awake60, all.filter(e => Math.hypot(e.x - p.x, e.z - p.z) <= 60).length);
    near150 = Math.max(near150, all.filter(e => Math.hypot(e.x - p.x, e.z - p.z) <= REAL.nearRadius).length);
    for (let a = 0; a < 72; a++) {
      const h = a / 72 * Math.PI * 2, cx = p.x + Math.cos(h) * 20, cz = p.z + Math.sin(h) * 20;   // 20 m back from a pack, facing it
      const f = h + Math.PI;
      const n = all.filter(e => { const dx = e.x - cx, dz = e.z - cz, d = Math.hypot(dx, dz); if (d > 100 || d < 1) return false; let da = Math.atan2(dz, dx) - f; da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.abs(da) < (33 / 2) * Math.PI / 180; }).length;
      view = Math.max(view, n);
    }
  }
  return { total: all.length, view, awake, awake60, near150 };
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('placement.js')) {
  const P = place();
  console.table(P.fit);
  console.table(grind(P));
  console.log('cover pieces', P.cover.length, 'chests', P.chests.length, 'crates', P.crates.length, 'quests', P.quests.length, 'lairs', P.lairs.length);
  console.log('reach with cover', coverReach(P), 'round-1 rule', coverReach(P, false));
  console.log('on screen', onScreen(P));
  console.log('budget', budget());
}
