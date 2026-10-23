// G600 L5 / R10b: the wolf pack (engine/ai/stalker.ts, pattern 'pack') as one resumable group program on the
// ABI v2 group step. Signals: 'init' (the shared ai stream), 'tick' once per group at the original pack.tick slot,
// 'drive.N' / 'body.N' at member N's own drive slot (the context stream). A call runs in segments: a segment that needs
// a native answer (a sense, a ground normal, grass, a path yaw, the nearest foal, a token claim) emits the request and
// stores its resume point in the bank's pc; the original owner applies the segment's operations in order, then calls
// again with the answers on the result columns. pc 0 = the call is finished. Effects and requests are native rows.
import * as core from '../sdk/as/wsV2';
import * as bank from '../sdk/as/groupBankV2.pack';
import * as slots from '../sdk/as/groupStepV2.pack';

// ── bank: snapshotPack's scalar fields in the v2 encodings (the token pools stay GroupBrain's), then the resume point and\n// its scratch (0 at rest, never saved) ──
const B_INIT = 0, B_TIMESET = 1, B_TIME = 2, B_PHASE = 3, B_AWARE = 4, B_HOMEX = 5, B_HOMEZ = 6, B_PHASET = 7, B_ROAMX = 8,
  B_ROAMZ = 9, B_ROAMT = 10, B_NEXTTOKEN = 11, B_BOLD = 12, B_CALM = 13, B_HPSTART = 14, B_HALF = 15, B_DEADSEEN = 16,
  B_SHADOWDUR = 17, B_HOWLED = 18, B_BITES = 19, B_SCARED = 20, B_ALPHA = 21 /* member slot + 1, 0 none */, B_PREY = 22,
  B_PENDING = 23,
  B_PC = 24, B_RET = 25, B_TRY = 26, B_CANDX = 27, B_CANDZ = 28, B_HIT = 29, B_SPOTX = 30, B_SPOTZ = 31, B_CLAIM = 32;
const ROAM = 0, SHADOW = 1, ENCIRCLE = 2, REGROUP = 3, BREAK = 4;
const ROLE_ALPHA = 0, ROLE_FLANK = 1, ROLE_SCOUT = 2;
// resume points: tick 1-9, drive 20-21
const PC_DONE = 0, PC_KILLED = 1, PC_SENSED = 2, PC_ROAM_TAIL = 3, PC_CLAIMED = 4, PC_ROAM_CHECK = 5, PC_SENSES = 6,
  PC_DECIDE = 7, PC_END = 8, PC_FOUND = 9, PC_GRASS = 20, PC_PATH = 21;
/** the inBounds square's half size (the native group rows' bounds, ±250; test/nalati-pack-group checks it) */
const HALF: f64 = 250;

// ── member columns: 'cNN.<name>' so the sorted order is this index order ──
const C_ALIVE = 0, C_ATTACK = 1, C_BIT = 2, C_HITT = 3, C_HITTVALID = 4, C_HP = 5, C_LASTHIT = 6, C_LASTVALID = 7,
  C_LHIT = 8, C_LHITVALID = 9, C_LOW = 10, C_LT = 11, C_LUNGE = 12, C_MAXHP = 13, C_OX = 14, C_OZ = 15, C_RING = 16,
  C_ROLE = 17, C_SCALE = 18, C_SEED = 19, C_SNARL = 20, C_SPEED = 21, C_SPEEDMOD = 22, C_ST = 23, C_STUNNED = 24,
  C_SX = 25, C_SXSET = 26, C_SZ = 27, C_X = 28, C_YAW = 29, C_Z = 30, C_HOWL = 31, C_HIDDEN = 32, C_GRASS = 33,
  // the previous segment's answers (0 when none arrived)
  R_VIS = 34, R_HEAR = 35, R_DOWNWIND = 36, R_NORMAL = 37, R_GRASS0 = 38 /* ..42 */, R_PATH = 43, R_CLAIMED = 44, R_FOUND = 45,
  // context, the same on every member (read from slot 0)
  C_CTX = 46;
const X_PX = 0, X_PY = 1, X_PZ = 2, X_FWDX = 3, X_FWDZ = 4, X_MOUNTED = 5, X_HEALTH = 6, X_CALM = 7, X_PSPEED = 8,
  X_T = 9, X_DT = 10, X_PREYX = 11, X_PREYY = 12, X_PREYZ = 13, X_PREYYAW = 14, X_PREYALIVE = 15, X_PENDINGALIVE = 16;
function m(slot: i32, column: i32): f64 { return slots.member(slot, column); }
function ctx(i: i32): f64 { return m(0, C_CTX + i); }

// ── actions: declared native rows (profile-local ids) ──
const A_MEM = 1; // ids 1..16: memory per key K_* (words 2 [slot, value]; the hit stamps 3 [slot, value, valid])
const A_MOTION = 17, A_STEER = 18, A_STATE = 19, A_LOOK_AT = 20, A_LOOK_WEIGHT = 21, A_PATH = 22, A_GRASS = 23 /* ..27 */,
  A_NORMAL = 28, A_VIS = 29, A_HEAR = 30, A_DOWNWIND = 31, A_CLAIM = 32, A_STAGGER = 33, A_DAMAGE = 34,
  A_CANCEL = 35, A_ATTACK = 36, A_SOUND = 37 /* [slot, cue]: the wolf's call context */, A_BITE = 38 /* contact [slot, radius] */, A_EVENT = 39, A_NEAREST = 40;
const K_ROLE = 0, K_OX = 1, K_OZ = 2, K_RING = 3, K_HITT = 4, K_LUNGE = 5, K_LT = 6, K_BIT = 7, K_LHIT = 8, K_ST = 9,
  K_SX = 10, K_SZ = 11, K_LOW = 12, K_SNARL = 13, K_HOWL = 14, K_HIDDEN = 15;
const CUE_YIP = 0, CUE_HOWL = 1, CUE_SNARL = 2, CUE_BITE = 3;
const EV_PREY_KILLED = 0, EV_HOWL = 1, EV_RIDER_BITTEN = 2, EV_PACK_BREAK = 3;
const ST_WANDER = 0, ST_GRAZE = 1, ST_STALK = 2, ST_ATTACK = 3, ST_CHARGE = 4, ST_FLEE = 5, ST_ALERT = 6;
function op(id: i32, a: f64 = 0, b: f64 = 0, c: f64 = 0, d: f64 = 0): void { core.pageOutput(id, a, b, c, d); }
function mem(slot: i32, key: i32, value: f64): void { op(A_MEM + key, f64(slot), value); }
/** a hit stamp: the native memory keeps -Infinity for 'never' (valid 0) */
function stamp(slot: i32, key: i32, value: f64, valid: bool): void { op(A_MEM + key, f64(slot), valid ? value : 0, valid ? 1 : 0); }
/** the original's `lastHitT > (mem[key] ?? -Infinity)`: a valid hit newer than a valid stamp, or any valid hit over none */
function newerHit(w: i32, stampColumn: i32, validColumn: i32): bool {
  return m(w, C_LASTVALID) == 1 && (m(w, validColumn) != 1 || m(w, C_LASTHIT) > m(w, stampColumn));
}

// ── spec: Nalati's wolf pack row (data/brains.json pack: trot, run, shadow min/max, ring min/max, bite, sight, cone, smell,
// telegraph, dash, breakoff, attack; test/nalati-pack-group checks they agree) ──
const SPEC: StaticArray<f64> = [4, 9.5, 30, 40, 12, 16, 1.4, 35, 1.2217304763960306, 60, 0.4, 1.8, 1.1, 0.42];
function spec(i: i32): f64 { return SPEC[i]; }
const S_TROT = 0, S_RUN = 1, S_SHADOWMIN = 2, S_SHADOWMAX = 3, S_RINGMIN = 4, S_RINGMAX = 5, S_BITE = 6, S_SIGHT = 7,
  S_CONE = 8, S_SMELL = 9, S_TELEGRAPH = 10, S_DASH = 11, S_BREAKOFF = 12, S_ATTACKS = 13;

function angDiff(a: f64, b: f64): f64 { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
function ease(cur: f64, to: f64, k: f64): f64 { return cur + (to - cur) * Math.min(1, k); }
function inBounds(x: f64, z: f64, margin: f64): bool { return Math.abs(x) <= HALF - margin && Math.abs(z) <= HALF - margin; }
function b(i: i32): f64 { return bank.value(i); }
function put(i: i32, v: f64): void { bank.write(i, v); }
function n(): i32 { return slots.memberCount(); }
function alive(w: i32): bool { return m(w, C_ALIVE) == 1; }
function hasPrey(): bool { return b(B_PREY) != 0; }
function targetX(): f64 { return hasPrey() ? ctx(X_PREYX) : ctx(X_PX); }
function targetY(): f64 { return hasPrey() ? ctx(X_PREYY) : ctx(X_PY); }
function targetZ(): f64 { return hasPrey() ? ctx(X_PREYZ) : ctx(X_PZ); }
function targetFacing(): f64 { return hasPrey() ? ctx(X_PREYYAW) : Math.atan2(ctx(X_FWDX), ctx(X_FWDZ)); }
function centre(axis: i32): f64 {
  let s: f64 = 0, k = 0;
  for (let w = 0; w < n(); w++) if (alive(w)) { s += m(w, axis); k++; }
  return k > 0 ? s / f64(k) : b(axis == C_X ? B_HOMEX : B_HOMEZ);
}
function suspend(pc: i32): void { put(B_PC, f64(pc)); }

/** initialize(): the shipping setup draws, once, from the borrowed SHARED ai stream */
export function init(): void {
  assert(b(B_INIT) != 1);
  const alpha = i32(b(B_ALPHA)) - 1;
  let small = -1;
  for (let w = 0; w < n(); w++) if (small < 0 || m(w, C_SCALE) < m(small, C_SCALE)) small = w;
  for (let w = 0; w < n(); w++) {
    mem(w, K_ROLE, w == alpha ? ROLE_ALPHA : n() >= 4 && w == small ? ROLE_SCOUT : ROLE_FLANK);
    mem(w, K_OX, (core.random(1) - 0.5) * 8); mem(w, K_OZ, (core.random(1) - 0.5) * 8);
    stamp(w, K_HITT, m(w, C_LASTHIT), m(w, C_LASTVALID) == 1);
    mem(w, K_RING, spec(S_RINGMIN) + core.random(1) * (spec(S_RINGMAX) - spec(S_RINGMIN)));
  }
  put(B_INIT, 1); put(B_PC, PC_DONE);
}

// ── pickRoam: up to 16 tries, one ground normal a segment; B_RET is where the tick resumes after it ──
/** start picking; false when it suspended on a normal request */
function pickRoamStart(ret: i32): bool { put(B_RET, f64(ret)); put(B_TRY, 0); return pickRoamTry(); }
function pickRoamTry(): bool {
  while (b(B_TRY) < 16) {
    const ang = core.random(1) * Math.PI * 2, r = 40 + core.random(1) * 50;
    const x = b(B_HOMEX) + Math.cos(ang) * r, z = b(B_HOMEZ) + Math.sin(ang) * r;
    if (!inBounds(x, z, 30)) { put(B_TRY, b(B_TRY) + 1); continue; }
    put(B_CANDX, x); put(B_CANDZ, z); op(A_NORMAL, x, z); suspend(PC_ROAM_CHECK); return false;
  }
  put(B_ROAMT, 60 + core.random(1) * 60); return true;
}
/** the normal arrived: keep the candidate, or try the next */
function pickRoamCheck(): bool {
  if (m(0, R_NORMAL) >= 0.8) { put(B_ROAMX, b(B_CANDX)); put(B_ROAMZ, b(B_CANDZ)); put(B_ROAMT, 60 + core.random(1) * 60); return true; }
  put(B_TRY, b(B_TRY) + 1); return pickRoamTry();
}

/** setPhase; false when ROAM's pickRoam suspended (the tick resumes at `ret`) */
function setPhase(p: f64, ret: i32): bool {
  if (p == b(B_PHASE)) return true;
  put(B_PHASE, p); put(B_PHASET, 0);
  if (p == SHADOW) {
    put(B_SHADOWDUR, 9 + core.random(1) * 7);
    for (let w = 0; w < n(); w++) if (alive(w) && m(w, C_ROLE) == ROLE_SCOUT) { op(A_SOUND, f64(w), CUE_YIP); break; }
  }
  if (p == REGROUP) put(B_HOWLED, 0);
  if (p == BREAK) { for (let w = 0; w < n(); w++) { mem(w, K_LUNGE, 0); op(A_CANCEL, f64(w)); } op(A_EVENT, EV_PACK_BREAK, centre(C_X), centre(C_Z)); }
  if (p == ROAM) { put(B_PREY, 0); return pickRoamStart(ret); }
  return true;
}

/** the pack-level tick: senses, phase changes, the attack token (draws: the context stream) */
export function tick(): void {
  let pc = i32(b(B_PC));
  // each case either suspends (return with B_PC set) or moves on within this segment
  while (true) {
    if (pc == PC_DONE) {
      const dt = ctx(X_DT), t = ctx(X_T);
      if (b(B_TIMESET) == 1 && Math.abs(t - b(B_TIME)) < 1e-8) return;
      put(B_TIMESET, 1); put(B_TIME, t);
      if (dt <= 0) return;
      put(B_PHASET, b(B_PHASET) + dt); put(B_BOLD, Math.max(0, b(B_BOLD) - dt)); put(B_CALM, Math.max(0, b(B_CALM) - dt));
      let living = 0;
      for (let w = 0; w < n(); w++) if (alive(w)) living++;
      if (living == 0) return;
      put(B_HIT, 0);
      if (hasPrey() && ctx(X_PREYALIVE) != 1) {
        op(A_EVENT, EV_PREY_KILLED, ctx(X_PREYX), ctx(X_PREYZ)); put(B_PREY, 0);
        if (!setPhase(ROAM, PC_KILLED)) return;
        pc = PC_KILLED; continue;
      }
      pc = PC_SENSES; continue;
    }
    if (pc == PC_KILLED) { put(B_CALM, 40); pc = PC_SENSES; continue; }
    if (pc == PC_SENSES) {
      // hit stamps, then the senses the original asks (not while calmed), in its member order
      let any = false;
      const calm = ctx(X_CALM) == 1 || b(B_CALM) > 0;
      for (let w = 0; w < n(); w++) {
        if (!alive(w)) continue;
        if (newerHit(w, C_HITT, C_HITTVALID)) { stamp(w, K_HITT, m(w, C_LASTHIT), true); put(B_HIT, 1); }
        if (calm) continue;
        const d = Math.hypot(ctx(X_PX) - m(w, C_X), ctx(X_PZ) - m(w, C_Z));
        op(A_VIS, f64(w)); op(A_HEAR, f64(w)); if (d < spec(S_SMELL)) op(A_DOWNWIND, f64(w));
        any = true;
      }
      if (any) { suspend(PC_SENSED); return; }
      pc = PC_DECIDE; continue;
    }
    if (pc == PC_SENSED || pc == PC_DECIDE) {
      const dt = ctx(X_DT), t = ctx(X_T);
      let rate: f64 = 0, living = 0, dead = 0, hp: f64 = 0;
      for (let w = 0; w < n(); w++) { if (alive(w)) { living++; hp += m(w, C_HP); } else dead++; }
      if (pc == PC_SENSED) for (let w = 0; w < n(); w++) {
        if (!alive(w)) continue;
        const dx = ctx(X_PX) - m(w, C_X), dz = ctx(X_PZ) - m(w, C_Z), d = Math.hypot(dx, dz);
        const sight = spec(S_SIGHT) * m(w, R_VIS);
        if (d < sight && Math.abs(angDiff(Math.atan2(dx, dz), m(w, C_YAW))) < spec(S_CONE)) rate = Math.max(rate, 0.5 * (2 - d / sight));
        const hear = m(w, R_HEAR);
        if (d < hear) rate = Math.max(rate, 0.6 * (2 - d / hear));
        if (d < spec(S_SMELL) && m(w, R_DOWNWIND) == 1) rate = Math.max(rate, 0.35 * (2 - d / spec(S_SMELL)));
      }
      const hit = b(B_HIT) == 1;
      if (hit && b(B_CALM) <= 0) { put(B_AWARE, 1); put(B_PREY, 0); }
      put(B_AWARE, rate > 0 ? Math.min(1, b(B_AWARE) + rate * dt) : Math.max(0, b(B_AWARE) - 0.1 * dt));
      const alpha = i32(b(B_ALPHA)) - 1;
      const alphaDead = alpha >= 0 && !alive(alpha), lastOne = n() > 1 && living <= 1;
      if (b(B_PHASE) != BREAK && (alphaDead || lastOne || b(B_SCARED) == 1)) { put(B_SCARED, 0); setPhase(BREAK, PC_END); }
      put(B_SCARED, 0);
      const tx = targetX(), tz = targetZ();
      const dAlpha = alpha >= 0 && alive(alpha) ? Math.hypot(m(alpha, C_X) - tx, m(alpha, C_Z) - tz) : Math.hypot(centre(C_X) - tx, centre(C_Z) - tz);
      const phase = b(B_PHASE);
      if (phase == ROAM) {
        if (b(B_PENDING) != 0) {
          const pending = b(B_PENDING); put(B_PENDING, 0);
          if (ctx(X_PENDINGALIVE) == 1) { put(B_PREY, pending); put(B_AWARE, 0); put(B_CALM, 0); setPhase(SHADOW, PC_END); pc = PC_END; continue; }
        }
        put(B_ROAMT, b(B_ROAMT) - dt);
        if (b(B_ROAMT) <= 0 || (Math.hypot(centre(C_X) - b(B_ROAMX), centre(C_Z) - b(B_ROAMZ)) < 6 && core.random(1) < 0.05)) {
          if (!pickRoamStart(PC_ROAM_TAIL)) return;
        }
        pc = PC_ROAM_TAIL; continue;
      } else if (phase == SHADOW) {
        if (hit) setPhase(ENCIRCLE, PC_END);
        else if (!hasPrey() && b(B_AWARE) < 0.15) { if (!setPhase(ROAM, PC_END)) return; }
        else if (dAlpha < 22 || b(B_PHASET) > b(B_SHADOWDUR) || (hasPrey() && b(B_PHASET) > 6)) setPhase(ENCIRCLE, PC_END);
      } else if (phase == ENCIRCLE) {
        let done = false;
        if (f64(dead) > b(B_DEADSEEN) || (b(B_HALF) != 1 && hp < b(B_HPSTART) * 0.5)) {
          if (hp < b(B_HPSTART) * 0.5) put(B_HALF, 1);
          put(B_DEADSEEN, f64(dead));
          if (alpha >= 0 && alive(alpha)) { setPhase(REGROUP, PC_END); done = true; }
        }
        if (!done && !hasPrey() && b(B_AWARE) < 0.08 && dAlpha > 50) { if (!setPhase(ROAM, PC_END)) return; done = true; }
        if (!done && assignToken(t)) return;
      } else if (phase == REGROUP) {
        if (b(B_HOWLED) != 1 && alpha >= 0) { put(B_HOWLED, 1); op(A_SOUND, f64(alpha), CUE_HOWL); op(A_EVENT, EV_HOWL, m(alpha, C_X), m(alpha, C_Z)); }
        if (b(B_PHASET) > 3.6) { put(B_BOLD, 10); put(B_NEXTTOKEN, t + 0.6); setPhase(ENCIRCLE, PC_END); }
      } else if (phase == BREAK) {
        let far = true;
        for (let w = 0; w < n(); w++) if (alive(w) && Math.hypot(m(w, C_X) - ctx(X_PX), m(w, C_Z) - ctx(X_PZ)) < 70) far = false;
        if (far || b(B_PHASET) > 14) { put(B_CALM, 120); put(B_AWARE, 0); if (!setPhase(ROAM, PC_END)) return; }
      }
      pc = PC_END; continue;
    }
    if (pc == PC_ROAM_CHECK) { if (!pickRoamCheck()) return; pc = i32(b(B_RET)); continue; }
    if (pc == PC_ROAM_TAIL) {
      if (b(B_AWARE) >= 0.35) { if (!setPhase(b(B_HIT) == 1 ? ENCIRCLE : SHADOW, PC_END)) return; pc = PC_END; continue; }
      // findPrey: the roll, then the nearest living foal of the other herds within 70 m of the pack's centre
      if (b(B_CALM) <= 0 && b(B_AWARE) < 0.1 && core.random(1) < 0.01) { op(A_NEAREST, centre(C_X), centre(C_Z), 70); suspend(PC_FOUND); return; }
      pc = PC_END; continue;
    }
    if (pc == PC_FOUND) {
      if (m(0, R_FOUND) != 0) { put(B_PREY, m(0, R_FOUND)); setPhase(SHADOW, PC_END); }
      pc = PC_END; continue;
    }
    if (pc == PC_CLAIMED) {
      const w = i32(b(B_CLAIM));
      if (m(w, R_CLAIMED) == 1) {
        stamp(w, K_LHIT, m(w, C_LASTHIT), m(w, C_LASTVALID) == 1);
        mem(w, K_LUNGE, 1); mem(w, K_LT, spec(S_TELEGRAPH)); mem(w, K_BIT, 0); op(A_SOUND, f64(w), CUE_SNARL);
        put(B_NEXTTOKEN, ctx(X_T) + (b(B_BOLD) > 0 ? 1.2 + core.random(1) * 0.8 : 2.5 + core.random(1) * 1.5));
      }
      pc = PC_END; continue;
    }
    // PC_END: finished; scratch back to rest
    put(B_PC, PC_DONE); put(B_RET, 0); put(B_TRY, 0); put(B_CANDX, 0); put(B_CANDZ, 0); put(B_HIT, 0); put(B_CLAIM, 0);
    return;
  }
}

/** the attack token to the wolf best placed behind the target; true when it suspended on the claim */
function assignToken(t: f64): bool {
  const tx = targetX(), tz = targetZ();
  let lungers = 0, living = 0;
  for (let w = 0; w < n(); w++) if (alive(w)) { living++; const l = m(w, C_LUNGE); if (l == 1 || l == 2) lungers++; }
  const tokens = (ctx(X_MOUNTED) == 1 && !hasPrey() ? 2 : 1) + (b(B_BOLD) > 0 ? 1 : 0);
  if (lungers >= tokens || t < b(B_NEXTTOKEN)) return false;
  const facing = targetFacing();
  let best = -1, bestScore: f64 = -1e9;
  for (let w = 0; w < n(); w++) {
    if (!alive(w) || m(w, C_STUNNED) == 1 || m(w, C_LUNGE) != 0) continue;
    const d = Math.hypot(m(w, C_X) - tx, m(w, C_Z) - tz);
    if (d > 24) continue;
    const role = m(w, C_ROLE);
    if (role == ROLE_ALPHA && living > 1 && ctx(X_HEALTH) >= 0.6 && b(B_BITES) < 3) continue;
    const behind = Math.abs(angDiff(Math.atan2(m(w, C_X) - tx, m(w, C_Z) - tz), facing));
    const score = behind - d * 0.03 + (role == ROLE_SCOUT && b(B_BITES) == 0 ? 1.5 : 0);
    if (score > bestScore) { bestScore = score; best = w; }
  }
  if (best < 0) return false;
  // register with the group's director (its cap: `tokens`), then the host's claim; its answer starts the lunge
  // the original sweeps the cap's director and takes the members already attacking (alive, lunge 1 or 2): their mask
  let mask = 0;
  for (let w = 0; w < n(); w++) if (alive(w) && (m(w, C_LUNGE) == 1 || m(w, C_LUNGE) == 2)) mask |= 1 << w;
  op(A_CLAIM, f64(best), f64(tokens), f64(mask)); put(B_CLAIM, f64(best)); suspend(PC_CLAIMED); return true;
}

/** the ring angle (bearing from the target) member `a` holds: slots spread round the back, out of the view cone */
function slotFor(a: i32): f64 {
  const tx = targetX(), tz = targetZ(), behind = targetFacing() + Math.PI;
  let count = 0, k = 0;
  const ra = angDiff(Math.atan2(m(a, C_X) - tx, m(a, C_Z) - tz), behind);
  for (let w = 0; w < n(); w++) {
    if (!alive(w) || m(w, C_LUNGE) != 0) continue;
    count++;
    if (w == a) continue;
    const rw = angDiff(Math.atan2(m(w, C_X) - tx, m(w, C_Z) - tz), behind);
    if (rw < ra || (rw == ra && w < a)) k++;
  }
  if (count <= 1) return behind;
  const spacing = Math.min((Math.PI * 2) / f64(count), (Math.PI * 1.5) / f64(count - 1));
  return behind + (f64(k) - f64(count - 1) / 2) * spacing;
}
/** steerSep: the yaw with a little separation from living pack-mates within 2.2 m */
function separated(a: i32, yaw: f64): f64 {
  let vx = Math.sin(yaw), vz = Math.cos(yaw);
  for (let w = 0; w < n(); w++) {
    if (w == a || !alive(w)) continue;
    const ox = m(a, C_X) - m(w, C_X), oz = m(a, C_Z) - m(w, C_Z), d = Math.hypot(ox, oz);
    if (d < 2.2 && d > 1e-3) { const f = (1 - d / 2.2) * 1.2; vx += (ox / d) * f; vz += (oz / d) * f; }
  }
  return Math.atan2(vx, vz);
}

// a drive's movement, decided before any effect: 0 none, 1 motion, 2 steer, 3 path then separated steer, 4 separated steer
let moveKind = 0, moveYaw: f64 = 0, moveSpeed: f64 = 0, moveTurn: f64 = 0, goalX: f64 = 0, goalZ: f64 = 0, goalEvery: f64 = 0;
function move(kind: i32, yaw: f64, speed: f64, turn: f64): void { moveKind = kind; moveYaw = yaw; moveSpeed = speed; moveTurn = turn; }
function goal(x: f64, z: f64, every: f64, speed: f64, turn: f64): void { moveKind = 3; goalX = x; goalZ = z; goalEvery = every; moveSpeed = speed; moveTurn = turn; }

/** steer one wolf for this tick (after tick); body: the body-step call (only a committed lunge drives then).
 *  Segments: (a shadow spot due) the five ring points' grass, its choice kept in the bank; (a path) its yaw; then every
 *  effect, in the original order, from the same unchanged inputs. No draws. */
export function drive(a: i32, body: bool): void {
  const pc = i32(b(B_PC)), phase = b(B_PHASE), lunge0 = m(a, C_LUNGE);
  const committed = phase == ENCIRCLE && lunge0 != 0;
  if (body != committed) { put(B_PC, PC_DONE); return; }
  const dt = ctx(X_DT), tx = targetX(), tz = targetZ();
  const dx = tx - m(a, C_X), dz = tz - m(a, C_Z), d = Math.hypot(dx, dz), toTgt = Math.atan2(dx, dz);
  const role = m(a, C_ROLE), seed = m(a, C_SEED), speedMod = m(a, C_SPEEDMOD);
  let lunge = lunge0, lt = m(a, C_LT);
  // a hit mid-lunge staggers it and breaks the lunge off
  const broke = (lunge == 1 || lunge == 2) && newerHit(a, C_LHIT, C_LHITVALID);
  if (broke) { lunge = 3; lt = spec(S_BREAKOFF) + 0.5; }
  // the shadow spot: due when its 1.5 s clock ran out or there is none yet
  let st = m(a, C_ST), sx = m(a, C_SX), sz = m(a, C_SZ), spotDue = false;
  if (phase == SHADOW) { st -= dt; spotDue = st <= 0 || m(a, C_SXSET) != 1; }
  if (phase == SHADOW && spotDue) {
    const bearing = Math.atan2(m(a, C_X) - tx, m(a, C_Z) - tz);
    const r = spec(S_SHADOWMIN) + (seed % 1) * (spec(S_SHADOWMAX) - spec(S_SHADOWMIN));
    if (pc == PC_DONE) {
      // the grass at the five ring points (out-of-bounds ones are skipped, as in the original)
      for (let k = -2; k <= 2; k++) {
        const ang = bearing + f64(k) * 0.3, x = tx + Math.sin(ang) * r, z = tz + Math.cos(ang) * r;
        if (inBounds(x, z, 24)) op(A_GRASS + k + 2, x, z);
      }
      suspend(PC_GRASS); return;
    }
    if (pc == PC_GRASS) {
      let bestG: f64 = -1, bx = m(a, C_X), bz = m(a, C_Z);
      for (let k = -2; k <= 2; k++) {
        const ang = bearing + f64(k) * 0.3, x = tx + Math.sin(ang) * r, z = tz + Math.cos(ang) * r;
        if (!inBounds(x, z, 24)) continue;
        const g = m(0, R_GRASS0 + k + 2) - Math.abs(f64(k)) * 0.05;
        if (g > bestG) { bestG = g; bx = x; bz = z; }
      }
      put(B_SPOTX, bx); put(B_SPOTZ, bz);
    }
    sx = b(B_SPOTX); sz = b(B_SPOTZ); st = 1.5;
  }
  // decide (no effect yet)
  let low: f64 = 0, snarl: f64 = 0, howl: f64 = 0, state = -1, attack = false, cancel = false, bite = false, damage = false;
  let lookWeight: f64 = phase == ROAM ? 0 : 0.8;
  moveKind = 0;
  if (phase == ROAM) {
    const gx = b(B_ROAMX) + m(a, C_OX), gz = b(B_ROAMZ) + m(a, C_OZ), td = Math.hypot(gx - m(a, C_X), gz - m(a, C_Z));
    if (td > 3) { goal(gx, gz, 2, td > 25 ? spec(S_TROT) : 1.6, 2.5); state = ST_WANDER; }
    else { move(1, m(a, C_YAW), 0, 1.5); state = ST_GRAZE; }
  } else if (phase == SHADOW) {
    state = ST_STALK; low = 1;
    const sd = Math.hypot(sx - m(a, C_X), sz - m(a, C_Z));
    const speed = d > 55 ? spec(S_RUN) * 0.8 : sd > 4 ? spec(S_TROT) : sd > 1.5 ? 1.4 : 0;
    if (speed > 0) goal(sx, sz, 1.5, speed, 3); else move(1, toTgt, 0, 2);
  } else if (phase == ENCIRCLE) {
    state = ST_STALK;
    if (lunge == 1) {
      state = ST_ATTACK; low = 1; snarl = 1; move(1, toTgt, 0, 6);
      lt -= dt; if (lt <= 0) { lunge = 2; lt = spec(S_DASH); }
    } else if (lunge == 2) {
      state = ST_CHARGE; snarl = 1; move(2, toTgt, spec(S_RUN) * speedMod, 7);
      attack = d < 2.6 && m(a, C_ATTACK) < 0;
      lt -= dt;
      const reach = spec(S_BITE) * Math.max(1, m(a, C_SCALE)) + 0.25;
      if (d < reach && m(a, C_BIT) == 0) { bite = !hasPrey(); damage = hasPrey(); lunge = 3; lt = spec(S_BREAKOFF); }
      else if (lt <= 0) { lunge = 3; lt = spec(S_BREAKOFF) * 0.6; }
    } else if (lunge == 3) {
      state = ST_FLEE; lt -= dt;
      move(2, Math.atan2(-dx, -dz) + ((seed * 10) % 2 < 1 ? 0.6 : -0.6), 8, 5);
      if (lt <= 0) { lunge = 0; cancel = true; }
    } else {
      const slot = slotFor(a), R = m(a, C_RING) + (role == ROLE_ALPHA ? 5 : 0);
      const bearing = Math.atan2(m(a, C_X) - tx, m(a, C_Z) - tz);
      const step = Math.max(-0.7, Math.min(0.7, angDiff(slot, bearing))), ang = bearing + step;
      const px = tx + Math.sin(ang) * R, pz = tz + Math.cos(ang) * R, pd = Math.hypot(px - m(a, C_X), pz - m(a, C_Z));
      low = 0.25;
      if (pd > 1.2) {
        const speed = pd > 10 ? spec(S_RUN) * 0.85 : pd > 3 ? spec(S_TROT) * 1.2 : 2.2;
        if (pd > 6) goal(px, pz, 0.8, speed, 4); else move(4, Math.atan2(px - m(a, C_X), pz - m(a, C_Z)), speed, 4);
      } else move(1, toTgt, 0, 3);
    }
  } else if (phase == REGROUP) {
    state = ST_ALERT;
    const alpha = i32(b(B_ALPHA)) - 1, pt = b(B_PHASET);
    if (a == alpha) { move(1, toTgt, 0, 2); howl = pt < 2.6 ? 1 : 0; lookWeight = 0; }
    else if (d < 29) move(4, Math.atan2(-dx, -dz), spec(S_RUN) * 0.8, 4);
    else { move(1, toTgt, 0, 2); howl = pt > 0.8 && pt < 2.8 && (seed * 7) % 1 > 0.35 ? 1 : 0; }
    lunge = 0;
  } else if (phase == BREAK) {
    state = ST_FLEE; move(4, Math.atan2(-dx, -dz), spec(S_RUN) * speedMod, 3.5);
  }
  // a path wants its yaw first
  if (moveKind == 3 && pc != PC_PATH) { op(A_PATH, f64(a), goalX, goalZ, goalEvery); suspend(PC_PATH); return; }
  // every effect, in the original's order
  op(A_LOOK_AT, f64(a), tx, targetY(), tz); op(A_LOOK_WEIGHT, f64(a), lookWeight);
  if (broke) { const l = Math.hypot(dx, dz) || 1; op(A_STAGGER, f64(a + 1), -dx / l, -dz / l, 0.7); op(A_CANCEL, f64(a)); }
  stamp(a, K_LHIT, m(a, C_LASTHIT), m(a, C_LASTVALID) == 1);
  if (phase == SHADOW && spotDue) { mem(a, K_SX, sx); mem(a, K_SZ, sz); }
  if (phase == SHADOW) mem(a, K_ST, st);
  if (state >= 0 && phase != ROAM) op(A_STATE, f64(a), f64(state));
  if (moveKind == 1) op(A_MOTION, f64(a), moveYaw, moveSpeed, moveTurn);
  else if (moveKind == 2) op(A_STEER, f64(a), moveYaw, moveSpeed, moveTurn);
  else if (moveKind == 3) op(A_STEER, f64(a), separated(a, m(a, R_PATH)), moveSpeed, moveTurn);
  else if (moveKind == 4) op(A_STEER, f64(a), separated(a, moveYaw), moveSpeed, moveTurn);
  if (phase == ROAM) op(A_STATE, f64(a), f64(state));
  if (attack) op(A_ATTACK, f64(a), spec(S_ATTACKS));
  if (bite || damage) {
    mem(a, K_BIT, 1); put(B_BITES, b(B_BITES) + 1); op(A_SOUND, f64(a), CUE_BITE);
    if (damage) { const l = Math.hypot(dx, dz) || 1; op(A_DAMAGE, b(B_PREY), role == ROLE_ALPHA ? 22 : 15, dx / l, dz / l); }
    else { op(A_BITE, f64(a), spec(S_BITE) * Math.max(1, m(a, C_SCALE)) + 0.25); if (ctx(X_MOUNTED) == 1) op(A_EVENT, EV_RIDER_BITTEN, m(a, C_X), m(a, C_Z)); }
  }
  if (cancel) op(A_CANCEL, f64(a));
  if (lunge != lunge0) mem(a, K_LUNGE, lunge);
  if (lt != m(a, C_LT)) mem(a, K_LT, lt);
  mem(a, K_LOW, ease(m(a, C_LOW), low, dt * 5));
  mem(a, K_SNARL, ease(m(a, C_SNARL), snarl, dt * 8));
  mem(a, K_HOWL, ease(m(a, C_HOWL), howl, dt * 4));
  mem(a, K_HIDDEN, m(a, C_SPEED) < 0.5 && d > 10 && m(a, C_GRASS) >= 0.8 ? 1 : 0);
  put(B_PC, PC_DONE); put(B_SPOTX, 0); put(B_SPOTZ, 0);
}

/** the pack profile's signals (generators/packGroup.ts): init, tick, drive.0-15, body.0-15 */
export function packGroupStep(): void {
  const signal = i32(core.parameter(0));
  if (signal == 1) init(); else if (signal == 2) tick(); else if (signal <= 18) drive(signal - 3, false); else drive(signal - 19, true);
}
