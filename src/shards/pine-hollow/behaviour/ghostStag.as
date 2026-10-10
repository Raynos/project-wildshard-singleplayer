// SF27 the Ghost Stag's fight (data/eliteBrains.ts GHOST_STAG_BRAIN; compiled behind elitePrelude.as). It flees round its
// glade rather than fights, stops to stare back; hit it or walk up on it and it FADES (2 s unaimable) and comes back behind
// you; phase 2 fades twice as often, and on its own mid-run.
// Modes: 0 idle, 1 home, 2 faded, 3 stare, 4 flee. Slots: 0 cd, 1 lastHit, 2 fadeT, 3 autoT. Actions: 0 fade, 1 comeBack.
// Parameters: 0-1 the lair's x z, 2 the leash radius.
const FADED: f64 = 2, STARE: f64 = 3, FLEE: f64 = 4;
let cd: f64 = 0, lastHit: f64 = 0, fadeT: f64 = 0, autoT: f64 = 0;
function save(): void { field(1, cd); field(2, lastHit); field(3, fadeT); field(4, autoT); }
function fade(p2: bool): void { action(0); fadeT = 2; cd = p2 ? 2.4 : 4.5; setMode(FADED); signature(); }
// combat/combatMath fleeHeading: away from the player, bent round the lair so it never runs off its leash
function flee(sx: f64, sz: f64, px: f64, pz: f64, lairX: f64, lairZ: f64, leashR: f64): f64 {
  let ax = sx - px, az = sz - pz;
  let al = hypot(ax, az); if (al === 0) al = 1;
  ax /= al; az /= al;
  const lx = sx - lairX, lz = sz - lairZ, ld = hypot(lx, lz);
  if (ld > 1e-3) {
    const out = Math.min(1, ld / leashR);
    let tx = -lz / ld, tz = lx / ld;
    if (tx * ax + tz * az < 0) { tx = -tx; tz = -tz; }
    const k = out * out;
    ax = ax * (1 - k) + tx * k - (lx / ld) * k * 0.6;
    az = az * (1 - k) + tz * k - (lz / ld) * k * 0.6;
  }
  return atan2(ax, az);
}
export function on_tick(): void {
  begin(3);
  cd = input(21); lastHit = input(22); fadeT = input(23); autoT = input(24);
  const dt = input(1), mode = input(4), p2 = input(6) !== 0, d = input(7), yaw = input(8);
  let modeT = input(5);
  cd -= dt;
  const hit = input(14) > lastHit; if (hit) lastHit = input(14);
  if (mode === FADED) {
    fadeT -= dt;
    if (fadeT <= 0) action(1);
    save(); return;
  }
  if (cd <= 0 && (hit || d < 12)) { fade(p2); save(); return; }
  if (p2 && mode === FLEE) { autoT -= dt; if (autoT <= 0 && cd <= 0) { autoT = 3.5 + random() * 1.5; fade(p2); save(); return; } }
  if (mode === STARE) {
    steer(yaw, 0, 4); look(1, 0);
    if (modeT > (p2 ? 1.1 : 1.6) || hit) setMode(FLEE);
    save(); return;
  }
  if (mode !== FLEE) { setMode(FLEE); modeT = 0; }
  steer(flee(input(11), input(12), input(9), input(10), parameter(0), parameter(1), parameter(2) * 0.55), 7, 3.2);
  lookWeight(0);
  if (modeT > 2.6 + (input(13) % 1) * 1.4) setMode(STARE);
  save();
}
