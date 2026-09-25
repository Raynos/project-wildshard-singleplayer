/**
 * Pine Hollow's ambient life without wolves (PINE-HOLLOW-REMASTER PH-M5) and the harvest's skinning beat (PH-F2), in one
 * call from main.ts (`installPineLife`, before the boot's precompile: the one draw below is parked in the scene then).
 *
 *   ravens       2–3 come to every fresh deer / boar / elk / bear kill 18–52 s after it (never past the minute): they
 *                sail in high, circle it, drop down beside it and feed (pecking bouts, a look round, a hop); walk up
 *                and they lift off and wait overhead, landing again once you have backed away; after a minute or so
 *                of feeding they leave for good. They croak as they come in, now and then over the kill, and lift off
 *                with a clatter of wings. A harvested carcass stays (dimmed: the hide is off) until they have
 *                been and gone, then it sinks away (`carcassMayGo`).
 *   the owl      after dark, a great grey owl on a snag top near you (a branch of a big pine when no snag is near),
 *                its head swivelling after you, eye-shine in the dark, hooting every 14–28 s; walk under it and it glides
 *                off (silently) — toward the nearest place your journal has not seen, when there is one.
 *   woodpecker   by day, a pileated woodpecker on a snag / pine trunk, drumming in bursts, calling now and then,
 *                hitching up the trunk; flushes (calling) to another trunk when you come close.
 *   breadcrumbs  every ~1.5–2.5 min by day, when no fight is on, 2–3 ravens overtake you low under the crowns and fly on
 *                toward the nearest place the journal has not seen (Driftwood's `gulls.breadcrumb` idea, `nearestUnvisited`;
 *                the Hollow's ravens show the way — folklore; a small songbird was a speck on the phone), croaking as
 *                they pass so you look up.
 *   hares        5 snowshoe hares on open ground around you: they graze, hop, sit up alert when you are near and
 *                bolt in zig-zags when you come closer; the ones left far behind are quietly re-seated around you.
 *
 * Every animal here is ONE instance of `WildlifeMesh` (one draw, one program, no shadow cast); the birds are generated
 * models (birdModels.ts: perched + flying each, one atlas; `?birds=proc` = the procedural ones). Not shootable: the herd
 * (AnimalManager) is the hunt; these are the forest's life. `?life=0` turns it off; `window.__pineLife` has the pieces
 * (captures: `crumbs()`, `owlNow()`, `ravensTo(x, z)`, `beat()`).
 *
 * The voices are PineHollowSfx one-shots (`h.sfx`, ForestAmbience's set: raven_caw / raven_pair / raven_flap, owl_hoot,
 * woodpecker_drum / woodpecker_call, skinCut-a / -b), placed in the world; each logs to `window.__audioLog`. Without the
 * set (Settings ▸ Sound effects = Synth, or not decoded yet) the woodpecker keeps its synth roll and the knife Audio's
 * blade-in-flesh; the birds are quiet.
 *
 * The skinning beat (`harvest(carcass, give)`): ~1.5 s — the weapon lowered, the view kneels and pitches down to the
 * carcass, a gloved hand brings the skinning knife up (skinKnife.ts: the Blender model on the viewmodels' program), two
 * knife strokes (the Pine Hollow set's two skinning strokes, a small kick each), then the drops land (`give`: the pack + the toast), the
 * knife drops away and the view comes back up.
 */
import * as THREE from 'three';
import type { Game } from '../../core/Game';
import type { Sky } from '../../world/Sky';
import type { Player } from '../../player/Player';
import type { Weapons } from '../../player/Weapons';
import type { Audio } from '../../audio/Audio';
import type { PhShot, PineHollowSfx } from '../../audio/PineHollowSfx';
import type { AnimalManager } from '../../entities/AnimalManager';
import type { Animal } from '../../entities/Animal';
import type { TreeInstance } from '../../world/placement';
import { cabinMask, heightAt, inChunk, normalAt, pondMask, streamAt, waterLevel } from '../../world/Heightfield';
import { Rng } from '../../core/rng';
import { CameraFX } from '../../player/CameraFX';
import { TrunkProbe } from './trunks';
import { SkinKnife } from './skinKnife';
import { loadBirdModels } from './birdModels';
import { KIND, WildlifeMesh, newPose, type WildKind, type WildPose } from './wildlifeMesh';
import { BEAT, RAVEN_CARCASS, beatEnvelope, carcassMayGo, nearestUnvisited, ravenCount, ravenDelay, type PlaceSpot, type RavenVisit } from './lifeMath';

export interface PineLifeHost {
  game: Game; sky: Sky; player: Player; animals: AnimalManager; weapons: Weapons; audio: Audio;
  trees: readonly TreeInstance[];
  /** the tree variants' bark geometry (Forest's factory): where a trunk really is (`TrunkProbe`) */
  trunks: readonly { trunk: THREE.BufferGeometry }[];
  /** the journal's places (id, spot, radius) and whether one is visited (seen) — null = no journal on this build */
  places: (() => PlaceSpot[]) | null;
  visited: (id: string) => boolean;
  /** a fight is on (no breadcrumbs then) */
  inCombat: () => boolean;
  params: URLSearchParams;
  /** Pine Hollow's generated one-shots (ForestAmbience's `sfx`): the birds' voices, the knife's strokes; null = none */
  sfx?: PineHollowSfx | null;
}
export interface PineLife {
  mesh: THREE.InstancedMesh;
  /** the skinning beat over `carcass`; `give` hands out the drops at its end. The carcass then waits for the ravens. */
  harvest: (carcass: Animal, give: () => void) => void;
  /** the beat is running */
  readonly busy: boolean;
}

const N_RAVEN = 4, N_GUIDE = 3, N_HARE = 5;
const SLOT = { raven: 0, owl: N_RAVEN, wood: N_RAVEN + 1, guide: N_RAVEN + 2, hare: N_RAVEN + 2 + N_GUIDE } as const;
const CAPACITY = SLOT.hare + N_HARE;
/** the ravens lift off when you come this close to them (sprinting: further) */
const RAVEN_FLUSH = 8, RAVEN_FLUSH_RUN = 12, RAVEN_RELAND = 16;
/** a carcass's body half-length by kind: the ravens stand just off it */
const BODY: Readonly<Record<string, number>> = { deer: 0.75, boar: 0.6, elk: 1.1, bear: 0.95 };
/** body centre over the feet: a raven standing (legs 0.12 m from a hip 0.06 m under the centre, ×1.1), an upright owl */
const RAVEN_STAND = 0.2, OWL_STAND = 0.16;

type Mode = 'off' | 'fly' | 'circle' | 'ground' | 'perch';
interface Bird {
  slot: number; pose: WildPose; mode: Mode;
  /** flight: a quadratic bezier a → b → c over dur seconds */
  ax: number; ay: number; az: number; bx: number; by: number; bz: number; cx: number; cy: number; cz: number; t: number; dur: number;
  after: (() => void) | null;
  /** the wingbeat machine */
  flapT: number; burst: number; glide: number;
  /** circling: centre, radius, altitude, angular speed, phase */
  ox: number; oz: number; orad: number; oalt: number; ow: number; oph: number;
  /** a free timer per mode, the peck / look machine */
  timer: number; peck: number; peckT: number; headTo: number; headPitchTo: number;
  /** where it stands / perches (ground or branch height) */
  gy: number;
}
interface Hare {
  slot: number; pose: WildPose;
  mode: 'graze' | 'alert' | 'flee';
  x: number; z: number; yaw: number;
  /** a hop: from → to over dur, height h */
  fx: number; fz: number; tx: number; tz: number; t: number; dur: number; h: number;
  timer: number; fleeLeft: number; zig: number; retry: number;
  headPitch: number; ears: number; sit: number;
}
interface Carcass { a: Animal; killT: number; comeT: number; harvestT: number; visit: RavenVisit; ravens: Bird[]; feedLeft: number; leaveT: number; dimmed: boolean }

const TAU = Math.PI * 2;
/** still out (a step may have sent it off) */
const flying = (b: { mode: string }): boolean => b.mode !== 'off';
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (x: number): number => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };

export function installPineLife(h: PineLifeHost): PineLife | null {
  if (h.params.get('life') === '0') return null;
  const { game, sky, player, animals } = h;
  const rng = new Rng(0x71fe);
  const wild = new WildlifeMesh(sky, CAPACITY);
  game.scene.add(wild.mesh);
  // the modelled birds (birdModels.ts; `?birds=proc` keeps these procedural ones): fetched once booted (off the load's
  // requests and bytes, like the painted horizon), swapped in when they land — same draw, same program
  const swapBirds = async (): Promise<void> => { const set = await loadBirdModels(); if (set) wild.useBirds(set, game.renderer); };
  document.addEventListener('ws:ready', () => { setTimeout(() => { void swapBirds(); }, 400); }, { once: true });
  const cam = game.camera;
  const trunks = new TrunkProbe(h.trunks);

  // ── the trees, by 16 m cell: trunks the hares keep off, snags / pines the birds perch on ──
  const CELL = 16, cells = new Map<number, TreeInstance[]>();
  const key = (cx: number, cz: number): number => (cx + 512) * 1024 + (cz + 512);
  for (const t of h.trees) {
    const k = key(Math.floor(t.x / CELL), Math.floor(t.z / CELL));
    const list = cells.get(k);
    if (list) list.push(t); else cells.set(k, [t]);
  }
  const treesNear = (x: number, z: number, r: number, out: TreeInstance[]): TreeInstance[] => {
    out.length = 0;
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL), z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) for (const t of cells.get(key(cx, cz)) ?? []) if ((t.x - x) ** 2 + (t.z - z) ** 2 < r * r) out.push(t);
    return out;
  };
  const scratch: TreeInstance[] = [];
  /** open, dry, gentle ground a hare can sit on (not a trunk, a cabin pad, the pond or the creek) */
  const groundOk = (x: number, z: number): boolean => {
    if (!inChunk(x, z, 20)) return false;
    const y = heightAt(x, z);
    if (y < waterLevel() + 0.35 || pondMask(x, z) > 0.02 || cabinMask(x, z) > 0.05 || streamAt(x, z) !== null) return false;
    if (normalAt(x, z)[1] < 0.86) return false;
    for (const t of treesNear(x, z, 3, scratch)) if (Math.hypot(t.x - x, t.z - z) < t.r + 0.45) return false;
    return true;
  };
  /** a perch tree near (x, z) between rMin and rMax metres: `pick` scores a candidate (higher is better; ≤ 0 = no) */
  const perchTree = (x: number, z: number, rMin: number, rMax: number, pick: (t: TreeInstance, d: number) => number): TreeInstance | null => {
    let best: TreeInstance | null = null, bs = 0;
    for (const t of treesNear(x, z, rMax, scratch)) {
      const d = Math.hypot(t.x - x, t.z - z);
      if (d < rMin) continue;
      const s = pick(t, d) * (0.6 + rng.next() * 0.8);
      if (s > bs) { bs = s; best = t; }
    }
    return best;
  };
  /** the eye's forward on the ground plane, and whether a point is inside the view (roughly) */
  const fwd = new THREE.Vector3();
  const inView = (x: number, z: number, cos = 0.45): boolean => {
    const dx = x - cam.position.x, dz = z - cam.position.z, d = Math.hypot(dx, dz) || 1;
    return (dx * fwd.x + dz * fwd.z) / d > cos;
  };

  // ── the birds ──
  const bird = (slot: number, kind: WildKind): Bird => ({
    slot, pose: newPose(kind), mode: 'off', ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, cx: 0, cy: 0, cz: 0, t: 0, dur: 1, after: null,
    flapT: 0, burst: 0, glide: 0, ox: 0, oz: 0, orad: 8, oalt: 12, ow: 0.5, oph: 0, timer: 0, peck: 0, peckT: 0, headTo: 0, headPitchTo: 0, gy: 0,
  });
  const ravens = Array.from({ length: N_RAVEN }, (_, i) => bird(SLOT.raven + i, KIND.raven));
  const owl = bird(SLOT.owl, KIND.owl);
  const wood = bird(SLOT.wood, KIND.woodpecker);
  const guides = Array.from({ length: N_GUIDE }, (_, i) => bird(SLOT.guide + i, KIND.raven));
  for (const b of [...ravens, owl, wood, ...guides]) b.pose.scale = b.pose.kind === KIND.raven ? 1.1 : 1.05;

  const place = (b: Bird, x: number, y: number, z: number): void => { b.pose.x = x; b.pose.y = y; b.pose.z = z; };
  /** fly from where it is to (x, y, z) at `speed` m/s, the path bowing along its heading (and up by `lift`) */
  const flyTo = (b: Bird, x: number, y: number, z: number, speed: number, lift: number, after: (() => void) | null): void => {
    const p = b.pose, d = Math.hypot(x - p.x, y - p.y, z - p.z);
    b.ax = p.x; b.ay = p.y; b.az = p.z;
    const hx = Math.sin(p.yaw), hz = Math.cos(p.yaw), lead = b.mode === 'fly' || b.mode === 'circle' ? d * 0.35 : d * 0.12;
    b.bx = (p.x + x) / 2 * 0.5 + (p.x + hx * lead) * 0.5; b.bz = (p.z + z) / 2 * 0.5 + (p.z + hz * lead) * 0.5; b.by = Math.max(p.y, y) + lift;
    b.cx = x; b.cy = y; b.cz = z; b.t = 0; b.dur = Math.max(0.8, d / speed); b.after = after;
    b.mode = 'fly';
  };
  /** a bird appears at (x, y, z) already flying, heading toward (tx, tz) */
  const spawnAt = (b: Bird, x: number, y: number, z: number, tx: number, tz: number): void => {
    place(b, x, y, z); b.pose.yaw = Math.atan2(tx - x, tz - z); b.pose.pitch = 0; b.pose.roll = 0;
    b.pose.a1 = 0; b.pose.b1 = 1; b.pose.b2 = 0; b.pose.a2 = 0; b.pose.a3 = 0; b.mode = 'fly'; b.burst = 4; b.flapT = 0;
  };
  const off = (b: Bird): void => { b.mode = 'off'; b.after = null; };
  // ── the voices (PineHollowSfx one-shots, placed at the bird) ──
  const voice = (family: PhShot, at: { x: number; y: number; z: number } | undefined, gain = 1): boolean => h.sfx?.shot(family, { at, gain }) ?? false;
  let ravenVoiceT = 0, flapT = 0;
  /** a raven's croak from `r` (two ravens trading croaks when `pair`): one at a time across the flock, a few seconds apart */
  const caw = (r: Bird, pair = false): void => {
    const t = performance.now() / 1000;
    if (t < ravenVoiceT) return;
    ravenVoiceT = t + rng.range(3, 6);
    voice(pair ? 'raven_pair' : 'raven_caw', r.pose, 0.9);
  };
  /** a raven's wings as it lifts off (one clatter for a flock going up together) */
  const flap = (r: Bird): void => {
    const t = performance.now() / 1000;
    if (t < flapT) return;
    flapT = t + 0.6;
    voice('raven_flap', r.pose, 0.8);
  };
  /** the wingbeat: bursts of beats, then a glide; the woodpecker bounds (beats, then wings shut) */
  const wings = (b: Bird, dt: number): void => {
    const k = b.pose.kind, bounding = k === KIND.woodpecker;
    const hz = k === KIND.owl ? 2.4 : k === KIND.raven ? 3.6 : 11, amp = k === KIND.owl ? 0.75 : k === KIND.raven ? 0.68 : 0.8;
    if (b.burst > 0) {
      b.flapT += dt * hz * TAU;
      b.pose.a0 = Math.sin(b.flapT) * amp; b.pose.a1 = Math.max(0, -Math.sin(b.flapT - 0.6)) * 0.25;
      if (b.flapT >= TAU) { b.flapT -= TAU; b.burst--; if (b.burst === 0) b.glide = bounding ? 0.3 : k === KIND.owl ? rng.range(1.2, 2.6) : rng.range(0.8, 2.4); }
    } else {
      const shut = bounding ? 0.95 : 0.05;
      b.pose.a0 += ((bounding ? -0.05 : 0.12) - b.pose.a0) * Math.min(1, dt * 8);
      b.pose.a1 += (shut - b.pose.a1) * Math.min(1, dt * 10);
      b.glide -= dt;
      if (b.glide <= 0) { b.burst = bounding ? 3 : k === KIND.owl ? rng.int(2, 3) : rng.int(2, 5); b.flapT = 0; }
    }
  };
  /** turn to face a motion (dx, dy, dz): heading, pitch into it, bank into the turn */
  const face = (b: Bird, dx: number, dy: number, dz: number, dt: number): void => {
    const dh = Math.hypot(dx, dz);
    if (dh < 1e-5) return;
    const yaw = Math.atan2(dx, dz), dyaw = wrap(yaw - b.pose.yaw);
    b.pose.yaw += dyaw;
    b.pose.pitch += (Math.atan2(dy, dh) * 0.6 - b.pose.pitch) * Math.min(1, dt * 4);
    const roll = THREE.MathUtils.clamp((dyaw / Math.max(dt, 1e-3)) * -0.5, -0.7, 0.7);
    b.pose.roll += (roll - b.pose.roll) * Math.min(1, dt * 3);
  };
  const _p = new THREE.Vector3();
  const bez = (b: Bird, u: number, out: THREE.Vector3): THREE.Vector3 => {
    const v = 1 - u, w0 = v * v, w1 = 2 * v * u, w2 = u * u;
    return out.set(b.ax * w0 + b.bx * w1 + b.cx * w2, b.ay * w0 + b.by * w1 + b.cy * w2, b.az * w0 + b.bz * w1 + b.cz * w2);
  };
  /** a head that looks about: a new yaw every so often, eased there */
  const lookAbout = (b: Bird, dt: number, range: number, rate: number): void => {
    if (rng.next() < dt * rate) b.headTo = rng.range(-range, range);
    b.pose.a2 += (b.headTo - b.pose.a2) * Math.min(1, dt * 7);
  };

  /** fly-state step: along the bezier; at its end the `after` hook (or off) */
  const stepFly = (b: Bird, dt: number): void => {
    b.t += dt;
    const u = Math.min(1, b.t / b.dur), e = u * u * (3 - 2 * u) * 0.3 + u * 0.7;
    bez(b, e, _p);
    const p = b.pose;
    // the bounding flight: a little sag in each glide
    if (p.kind === KIND.woodpecker && b.burst === 0) _p.y -= 0.25 * Math.sin(Math.min(1, 1 - b.glide / 0.3) * Math.PI);
    face(b, _p.x - p.x, _p.y - p.y, _p.z - p.z, dt);
    place(b, _p.x, _p.y, _p.z);
    p.b1 += (1 - p.b1) * Math.min(1, dt * 3);
    wings(b, dt);
    if (u >= 1) { const after = b.after; b.after = null; if (after) after(); else off(b); }
  };

  // ── the ravens at a carcass ──
  const carcasses: Carcass[] = [];
  const now = (): number => performance.now() / 1000;
  const prevKill = animals.onKill;
  animals.onKill = (a) => {
    prevKill?.(a);
    if (!RAVEN_CARCASS.has(a.kind)) return;
    const t = now();
    carcasses.push({ a, killT: t, comeT: t + ravenDelay(rng.next()), harvestT: -1, visit: 'waiting', ravens: [], feedLeft: rng.range(45, 80), leaveT: 0, dimmed: false });
  };
  const freeRavens = (): Bird[] => ravens.filter((r) => r.mode === 'off');
  const groundSpot = (c: Carcass, i: number, n: number): [number, number] => {
    const a = c.a.position, ang = (i / n) * TAU + rng.range(-0.5, 0.5), r = (BODY[c.a.kind] ?? 0.8) + rng.range(0.25, 0.7);
    return [a.x + Math.cos(ang) * r, a.z + Math.sin(ang) * r];
  };
  const circleOver = (r: Bird, c: Carcass, high: boolean): void => {
    r.mode = 'circle';
    r.ox = c.a.position.x; r.oz = c.a.position.z; r.orad = rng.range(7, 11); r.oalt = heightAt(r.ox, r.oz) + (high ? rng.range(17, 24) : rng.range(10, 15));
    r.ow = rng.range(0.45, 0.6) * (rng.next() < 0.5 ? -1 : 1); r.oph = Math.atan2(r.pose.z - r.oz, r.pose.x - r.ox);
    r.timer = rng.range(5, 9);
  };
  const landBy = (r: Bird, c: Carcass, i: number): void => {
    const [x, z] = groundSpot(c, i, Math.max(1, c.ravens.length));
    const y = heightAt(x, z);
    r.gy = y;
    flyTo(r, x, y + RAVEN_STAND, z, 7, 1.5, () => { r.mode = 'ground'; r.timer = rng.range(1.5, 4); r.peck = 0; r.pose.pitch = 0.12; r.pose.roll = 0; r.pose.b1 = 0; });
  };
  const flyOff = (r: Bird): void => {
    const p = player.position, dx = r.pose.x - p.x, dz = r.pose.z - p.z, d = Math.hypot(dx, dz) || 1;
    const ang = Math.atan2(dz / d, dx / d) + rng.range(-0.6, 0.6);
    if (r.mode === 'ground') { r.pose.b1 = 0; r.burst = 6; flap(r); }
    flyTo(r, r.pose.x + Math.cos(ang) * 140, r.pose.y + rng.range(35, 50), r.pose.z + Math.sin(ang) * 140, 11, 4, null);
  };
  const dim = (c: Carcass): void => {
    // the hide is off: the body dims a little (its own fur material only; a shared one is never touched)
    if (c.dimmed) return;
    c.dimmed = true;
    const mats = Array.isArray(c.a.mesh.material) ? c.a.mesh.material : [c.a.mesh.material];
    const fur = mats[0];
    if (!(fur instanceof THREE.MeshStandardMaterial)) return;
    const shared = animals.animals.some((o) => o !== c.a && (Array.isArray(o.mesh.material) ? o.mesh.material.includes(fur) : o.mesh.material === fur));
    if (!shared) fur.color.multiplyScalar(0.62);
  };

  const updateCarcasses = (t: number, dt: number): void => {
    const pp = player.position;
    for (let i = carcasses.length - 1; i >= 0; i--) {
      const c = carcasses[i];
      if (c === undefined) continue;
      const a = c.a;
      const gone = a.hidden || !animals.animals.includes(a);
      if (gone) { for (const r of c.ravens) if (r.mode !== 'off') flyOff(r); c.ravens.length = 0; carcasses.splice(i, 1); continue; }
      const dist = Math.hypot(a.position.x - pp.x, a.position.z - pp.z);
      if (c.visit === 'waiting' && t >= c.comeT) {
        const free = freeRavens(), n = Math.min(ravenCount(a.kind), free.length);
        if (n === 0 || dist > 170) { c.visit = 'gone'; } // the flock is at another kill / you are far off: they came and went unseen
        else {
          c.visit = 'overhead'; c.leaveT = t + 150;
          for (let k = 0; k < n; k++) {
            const r = free[k];
            if (r === undefined) continue;
            c.ravens.push(r);
            const ang = rng.range(0, TAU), far = rng.range(80, 110);
            spawnAt(r, a.position.x + Math.cos(ang) * far, heightAt(a.position.x, a.position.z) + rng.range(30, 40), a.position.z + Math.sin(ang) * far, a.position.x, a.position.z);
            flyTo(r, a.position.x + Math.cos(ang) * 9, heightAt(a.position.x, a.position.z) + 14, a.position.z + Math.sin(ang) * 9, 10, 2, () => { circleOver(r, c, false); });
          }
          const lead = c.ravens[0];
          if (lead) caw(lead, c.ravens.length > 1); // they announce themselves coming in
        }
      }
      if (c.visit === 'overhead' || c.visit === 'feeding') {
        const near = Math.min(...c.ravens.map((r) => Math.hypot(r.pose.x - pp.x, r.pose.z - pp.z)));
        const flushAt = player.sprinting ? RAVEN_FLUSH_RUN : RAVEN_FLUSH;
        let feeding = false;
        for (let k = 0; k < c.ravens.length; k++) {
          const r = c.ravens[k];
          if (r === undefined) continue;
          if (r.mode === 'ground') {
            feeding = true;
            if (near < flushAt) { r.pose.b1 = 0; r.burst = 7; flyTo(r, r.pose.x + rng.range(-4, 4), r.pose.y + rng.range(9, 13), r.pose.z + rng.range(-4, 4), 6, 3, () => { circleOver(r, c, true); }); flap(r); caw(r); }
          } else if (r.mode === 'circle' && dist > RAVEN_RELAND && r.timer <= 0 && t < c.leaveT) landBy(r, c, k);
        }
        c.visit = feeding ? 'feeding' : 'overhead';
        if (feeding) c.feedLeft -= dt;
        if (c.feedLeft <= 0 || t > c.leaveT) { for (const r of c.ravens) flyOff(r); c.ravens.length = 0; c.visit = 'gone'; }
      }
      if (c.harvestT >= 0) {
        dim(c);
        if (carcassMayGo(c.visit, t - c.harvestT)) { a.fadeOut(); carcasses.splice(i, 1); }
      } else if (c.visit === 'gone' && t - c.killT > 900) carcasses.splice(i, 1); // an old unharvested kill: nothing more to track
    }
  };

  const updateRaven = (r: Bird, dt: number): void => {
    const p = r.pose;
    switch (r.mode) {
      case 'fly': stepFly(r, dt); break;
      case 'circle': {
        r.oph += r.ow * dt; r.timer -= dt;
        const x = r.ox + Math.cos(r.oph) * r.orad, z = r.oz + Math.sin(r.oph) * r.orad, y = r.oalt + Math.sin(r.oph * 0.7) * 1.2;
        face(r, x - p.x, y - p.y, z - p.z, dt);
        place(r, x, y, z);
        p.b1 = 1;
        // soaring: mostly held wings, the odd few beats
        if (r.burst > 0 || rng.next() < dt * 0.25) wings(r, dt); else { p.a0 += (0.1 - p.a0) * Math.min(1, dt * 4); p.a1 += (0 - p.a1) * Math.min(1, dt * 4); }
        if (rng.next() < dt * 0.1) caw(r, rng.next() < 0.35); // a croak from overhead now and then
        break;
      }
      case 'ground': {
        // feeding: bouts of pecks at the carcass, a look round between, now and then a hop to a new spot
        const c = carcasses.find((k) => k.ravens.includes(r));
        const tx = c ? c.a.position.x : p.x, tz = c ? c.a.position.z : p.z;
        const want = Math.atan2(tx - p.x, tz - p.z);
        p.yaw += wrap(want - p.yaw) * Math.min(1, dt * 3);
        p.a0 += (-0.08 - p.a0) * Math.min(1, dt * 6); p.a1 += (1 - p.a1) * Math.min(1, dt * 6);
        p.b1 += (0 - p.b1) * Math.min(1, dt * 8);
        r.timer -= dt;
        if (r.peck > 0) {
          r.peckT += dt * 5.5;
          p.a3 = 0.35 + 0.75 * Math.max(0, Math.sin(r.peckT * Math.PI));
          p.a2 += (0 - p.a2) * Math.min(1, dt * 6);
          if (r.peckT >= 1) { r.peckT = 0; r.peck--; }
        } else {
          p.a3 += (-0.15 - p.a3) * Math.min(1, dt * 5);
          lookAbout(r, dt, 1.1, 1.4);
          if (r.timer <= 0) {
            r.timer = rng.range(1.2, 3.5);
            if (rng.next() < 0.12) caw(r, true); // squabbling over the kill
            if (rng.next() < 0.22 && c) { // a hop (a flick of the wings)
              const [x, z] = groundSpot(c, rng.int(0, 5), 6); r.gy = heightAt(x, z); r.ax = p.x; r.az = p.z; r.cx = x; r.cz = z; r.t = 0; r.dur = 0.35; r.burst = 1;
            } else { r.peck = rng.int(2, 5); r.peckT = 0; }
          }
        }
        if (r.t < r.dur && r.dur <= 0.4) { // the hop in progress
          r.t += dt;
          const u = Math.min(1, r.t / r.dur);
          place(r, r.ax + (r.cx - r.ax) * u, r.gy + RAVEN_STAND + Math.sin(u * Math.PI) * 0.18, r.az + (r.cz - r.az) * u);
          if (r.burst > 0) { p.a1 = 0.3; p.a0 = Math.sin(u * TAU) * 0.6; }
          if (u >= 1) { r.burst = 0; r.dur = 1; r.t = 1; }
        } else place(r, p.x, heightAt(p.x, p.z) + RAVEN_STAND, p.z);
        break;
      }
      case 'off': case 'perch': break;
      default: break;
    }
  };

  /** the nearest place the journal has not seen (the breadcrumbs' and the owl's heading) */
  const crumbTarget = (): PlaceSpot | null => (h.places ? nearestUnvisited(h.places(), h.visited, player.position.x, player.position.z) : null);

  // ── the owl (night) ──
  let owlNextT = 0, owlHootT = 0;
  const owlPerch = (near: THREE.Vector3, rMin: number, rMax: number, toward: PlaceSpot | null): { x: number; y: number; z: number } | null => {
    // a snag's broken top (the bark's own top, not the placement's height), the nearer / the more toward `toward` the better
    const tree = perchTree(near.x, near.z, rMin, rMax, (t, d) => {
      if (t.species !== 'snag') return 0;
      return toward ? Math.max(0.1, ((t.x - near.x) * (toward.x - near.x) + (t.z - near.z) * (toward.z - near.z)) / (d * Math.hypot(toward.x - near.x, toward.z - near.z) || 1) + 1) : 1;
    });
    return tree ? trunks.top(tree) : null;
  };
  const owlSettle = (spot: { x: number; y: number; z: number }): void => {
    owl.gy = spot.y;
    flyTo(owl, spot.x, spot.y + OWL_STAND, spot.z, 7.5, 2.5, () => { owl.mode = 'perch'; owl.pose.pitch = 1.1; owl.pose.roll = 0; owl.pose.b1 = 0; owl.pose.b2 = 1.1; owl.timer = rng.range(2, 5); owlHootT = now() + rng.range(1.5, 4); });
  };
  const updateOwl = (dt: number, night: number): void => {
    const p = owl.pose, pp = player.position;
    wild.glow.value = smooth((night - 0.45) / 0.3);
    if (owl.mode === 'off') {
      if (night < 0.6 || now() < owlNextT) return;
      const spot = owlPerch(pp, 28, 70, null);
      owlNextT = now() + 20;
      if (!spot) return;
      // it arrives unseen: from behind you, low through the trees
      const bx = pp.x - fwd.x * 60, bz = pp.z - fwd.z * 60;
      spawnAt(owl, bx, heightAt(bx, bz) + 12, bz, spot.x, spot.z);
      owlSettle(spot);
      return;
    }
    if (owl.mode === 'fly') { stepFly(owl, dt); return; }
    if (owl.mode !== 'perch') return;
    const d = Math.hypot(p.x - pp.x, p.z - pp.z);
    // the stare: the head follows you (owls turn it most of the way round), the body faces off
    const toYou = Math.atan2(pp.x - p.x, pp.z - p.z), rel = THREE.MathUtils.clamp(wrap(toYou - p.yaw), -2.3, 2.3);
    owl.headTo = d < 45 ? rel : owl.headTo;
    if (d >= 45) lookAbout(owl, dt, 1.6, 0.35); else p.a2 += (owl.headTo - p.a2) * Math.min(1, dt * 2.5);
    p.a3 = 1.1 + Math.sin(now() * 0.7) * 0.05; p.a0 += (-0.05 - p.a0) * Math.min(1, dt * 5); p.a1 += (1 - p.a1) * Math.min(1, dt * 5);
    place(owl, p.x, owl.gy + OWL_STAND, p.z);
    if (now() >= owlHootT) { owlHootT = now() + rng.range(14, 28); if (d < 150) voice('owl_hoot', p, 0.9); }
    if (night < 0.4) { p.b2 = 0; p.pitch = 0; owl.burst = 4; flyOff(owl); return; } // dawn: it leaves
    if (d < 14 || d > 120) {
      // flushed (or left far behind): a silent glide on — toward the nearest place the journal has not seen, if any
      p.b2 = 0; p.pitch = 0; owl.burst = 3; p.b1 = 0;
      const target = crumbTarget();
      const spot = d > 120 ? null : owlPerch(new THREE.Vector3(p.x, 0, p.z), 30, 65, target);
      if (spot) owlSettle(spot); else { flyOff(owl); owlNextT = now() + 25; }
    }
  };

  // ── the woodpecker (day) ──
  let woodNextT = 0, drumT = 0, drumOn = 0, drumVoiced = false;
  const trunkSpot = (near: { x: number; z: number }, rMin: number, rMax: number): { x: number; y: number; z: number; yaw: number } | null => {
    const tree = perchTree(near.x, near.z, rMin, rMax, (t) => (t.species === 'snag' ? 3 : t.species === 'birch' ? 1.5 : t.species === 'pine' ? 1 : 0));
    if (!tree) return null;
    const y = tree.y + rng.range(3.2, 5.5), sec = trunks.section(tree, y);
    if (!sec) return null;
    // on the bark (the model's own trunk section at that height), on the side toward you, give or take
    const pp = player.position, ang = Math.atan2(pp.z - sec.z, pp.x - sec.x) + rng.range(-1.1, 1.1), rad = sec.r + 0.05;
    return { x: sec.x + Math.cos(ang) * rad, y, z: sec.z + Math.sin(ang) * rad, yaw: Math.atan2(-Math.cos(ang), -Math.sin(ang)) };
  };
  const woodSettle = (s: { x: number; y: number; z: number; yaw: number }): void => {
    wood.gy = s.y;
    flyTo(wood, s.x - Math.sin(s.yaw) * 0.6, s.y - 0.4, s.z - Math.cos(s.yaw) * 0.6, 8, 1.2, () => {
      wood.mode = 'perch'; place(wood, s.x, s.y, s.z); wood.pose.yaw = s.yaw; wood.pose.pitch = 1.3; wood.pose.roll = 0; wood.pose.b1 = 0.3; wood.pose.b2 = 1.3;
      wood.timer = rng.range(1, 3); drumOn = 0;
    });
  };
  let noiseBuf: AudioBuffer | null = null;
  /** one knock of the drum roll: a short bandpassed noise tick, placed by distance / side */
  const knock = (gain: number, pan: number): void => {
    const au = h.audio;
    if (!au.ready) return;
    const c = au.ctx;
    if (noiseBuf === null) { noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.03), c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3; }
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 850 + Math.random() * 120; bp.Q.value = 2.2;
    const g = c.createGain(); g.gain.value = gain;
    let node: AudioNode = s.connect(bp).connect(g);
    if ('createStereoPanner' in c) { const pn = c.createStereoPanner(); pn.pan.value = pan; node = node.connect(pn); }
    node.connect(au.sfx);
    s.start();
  };
  const updateWood = (dt: number, night: number): void => {
    const p = wood.pose, pp = player.position;
    if (wood.mode === 'off') {
      if (night > 0.35 || now() < woodNextT) return;
      woodNextT = now() + 15;
      const s = trunkSpot(pp, 20, 55);
      if (!s) return;
      const bx = s.x + (s.x - pp.x) * 0.8, bz = s.z + (s.z - pp.z) * 0.8;
      spawnAt(wood, bx, s.y + 4, bz, s.x, s.z);
      woodSettle(s);
      return;
    }
    if (wood.mode === 'fly') { stepFly(wood, dt); return; }
    if (wood.mode !== 'perch') return;
    const d = Math.hypot(p.x - pp.x, p.z - pp.z);
    p.a0 += (-0.05 - p.a0) * Math.min(1, dt * 6); p.a1 += (1 - p.a1) * Math.min(1, dt * 6);
    wood.timer -= dt;
    if (drumOn > 0) {
      // the drum roll: ~16 knocks a second for ~1.2 s, the head a blur against the trunk
      drumOn -= dt; drumT += dt * 16;
      p.a3 = 0.75 + 0.35 * Math.abs(Math.sin(drumT * Math.PI));
      if (drumT >= 1) { drumT -= 1; const g = 0.5 / (1 + d / 12) ** 1.3 * Math.min(1, drumOn + 0.3); if (d < 60 && !drumVoiced) knock(g, THREE.MathUtils.clamp(((p.x - pp.x) * Math.cos(player.yaw) - (p.z - pp.z) * Math.sin(player.yaw)) / (d || 1), -1, 1) * 0.8); }
    } else {
      p.a3 += (0.35 - p.a3) * Math.min(1, dt * 6);
      lookAbout(wood, dt, 0.7, 0.8);
      if (wood.timer <= 0) {
        wood.timer = rng.range(3.5, 8);
        const r = rng.next();
        if (r < 0.3) { place(wood, p.x, p.y + 0.18, p.z); } // hitches up the trunk
        else if (r < 0.42 && d < 110) voice('woodpecker_call', p, 0.8);
        // the drum: the set's burst (the synth roll when the set is not there)
        else { drumOn = rng.range(0.9, 1.4); drumT = 0; drumVoiced = d < 60 && voice('woodpecker_drum', p, 0.8); if (drumVoiced) drumOn = 1.9; } // the set's bursts run ~2 s
      }
    }
    if (night > 0.45 || d > 110) { p.b2 = 0; p.pitch = 0; wood.burst = 3; flyOff(wood); woodNextT = now() + 30; return; }
    if (d < 9) {
      p.b2 = 0; p.pitch = 0; wood.burst = 3; p.b1 = 1;
      voice('woodpecker_call', p, 0.8); // flushed: it calls as it goes
      const s = trunkSpot({ x: p.x, z: p.z }, 22, 45);
      if (s) woodSettle(s); else flyOff(wood);
    }
  };

  // ── the breadcrumbs: ravens toward the nearest unvisited place ──
  let crumbNextT = now() + 25;
  const crumbs = (force = false): PlaceSpot | null => {
    const target = crumbTarget();
    if (!target || (!force && guides.some((j) => j.mode !== 'off'))) return null;
    const pp = player.position, dx = target.x - pp.x, dz = target.z - pp.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    // up from just behind you, low over your head (under the crowns), out ahead toward the place, rising away over the
    // trees: they overtake you, so whichever way you face you see them go — "follow the birds"
    const side = rng.next() < 0.5 ? -1 : 1, sx = -uz * side, sz = ux * side;
    const n = rng.int(2, N_GUIDE);
    guides.forEach((j, i) => {
      if (i >= n) { off(j); return; }
      const jit = (): number => rng.range(-1.5, 1.5);
      const x0 = pp.x - ux * 5 + sx * 4 + jit(), z0 = pp.z - uz * 5 + sz * 4 + jit();
      spawnAt(j, x0, heightAt(x0, z0) + rng.range(3.2, 4.2), z0, pp.x + ux * 20, pp.z + uz * 20);
      j.flapT = rng.range(0, TAU); j.burst = rng.int(1, 3);
      const mx = pp.x + ux * 28 + jit() * 2, mz = pp.z + uz * 28 + jit() * 2;
      flyTo(j, mx, heightAt(mx, mz) + rng.range(4, 5.5), mz, 9.5 + rng.range(-0.8, 0.8), 0.5, () => {
        const ex = pp.x + ux * 170 + jit() * 4, ez = pp.z + uz * 170 + jit() * 4;
        flyTo(j, ex, heightAt(ex, ez) + 22, ez, 10.5, 2, null);
      });
      j.t = -i * 0.14; // a loose, staggered flock
    });
    const lead = guides[0];
    if (lead && n > 0) { ravenVoiceT = 0; caw(lead, n > 1); } // croaking as they pass over: look up
    return target;
  };
  const updateCrumbs = (dt: number, night: number): void => {
    if (now() >= crumbNextT) {
      crumbNextT = now() + rng.range(90, 150);
      if (night < 0.5 && !h.inCombat()) crumbs();
    }
    for (const j of guides) if (j.mode === 'fly') stepFly(j, dt);
  };

  // ── the hares ──
  const hares: Hare[] = Array.from({ length: N_HARE }, (_, i) => ({
    slot: SLOT.hare + i, pose: newPose(KIND.hare), mode: 'graze', x: 0, z: 0, yaw: 0, fx: 0, fz: 0, tx: 0, tz: 0, t: 1, dur: 1, h: 0,
    timer: 0, fleeLeft: 0, zig: 0, retry: 0, headPitch: 0.5, ears: 0.2, sit: 0,
  }));
  for (const hr of hares) hr.pose.scale = 1.12;
  const seatHare = (hr: Hare, rMin: number, rMax: number, hidden: boolean): boolean => {
    const pp = player.position;
    for (let k = 0; k < 24; k++) {
      const ang = rng.range(0, TAU), r = rng.range(rMin, rMax), x = pp.x + Math.cos(ang) * r, z = pp.z + Math.sin(ang) * r;
      if (hidden && inView(x, z, 0.2) && r < 90) continue;
      if (!groundOk(x, z)) continue;
      hr.x = x; hr.z = z; hr.yaw = rng.range(0, TAU); hr.mode = 'graze'; hr.timer = rng.range(1, 4); hr.t = 1; hr.dur = 1; hr.sit = 0;
      return true;
    }
    return false;
  };
  hares.forEach((hr) => { if (!seatHare(hr, 25, 80, false)) { hr.x = 1e5; hr.z = 1e5; } });
  const hop = (hr: Hare, len: number, dur: number, height: number): void => {
    let tx = hr.x + Math.sin(hr.yaw) * len, tz = hr.z + Math.cos(hr.yaw) * len;
    if (!groundOk(tx, tz)) {
      // blocked: turn and try the other ways round
      for (const turn of [0.9, -0.9, 1.8, -1.8, Math.PI]) {
        const y = hr.yaw + turn, x2 = hr.x + Math.sin(y) * len, z2 = hr.z + Math.cos(y) * len;
        if (groundOk(x2, z2)) { hr.yaw = y; tx = x2; tz = z2; break; }
      }
      if (!groundOk(tx, tz)) { hr.mode = 'alert'; hr.timer = 1; return; }
    }
    hr.fx = hr.x; hr.fz = hr.z; hr.tx = tx; hr.tz = tz; hr.t = 0; hr.dur = dur; hr.h = height;
  };
  const updateHare = (hr: Hare, dt: number): void => {
    const pp = player.position, p = hr.pose;
    const d = Math.hypot(hr.x - pp.x, hr.z - pp.z);
    if (d > 130 || (d > 95 && !inView(hr.x, hr.z, 0.3))) {
      hr.retry -= dt;
      if (hr.retry > 0) return;
      if (!seatHare(hr, 45, 85, true)) { hr.retry = 2; hr.x = 1e5; hr.z = 1e5; return; }
    }
    const scare = player.sprinting ? 20 : player.crouching ? 7 : 12;
    if (hr.mode !== 'flee' && d < scare) { hr.mode = 'flee'; hr.fleeLeft = rng.range(28, 45); hr.zig = 0; hr.yaw = Math.atan2(hr.x - pp.x, hr.z - pp.z); hr.t = hr.dur; }
    else if (hr.mode === 'graze' && d < scare + 10) { hr.mode = 'alert'; hr.timer = rng.range(2, 5); }
    const hopping = hr.t < hr.dur;
    if (hopping) {
      hr.t += dt;
      const u = Math.min(1, hr.t / hr.dur);
      hr.x = hr.fx + (hr.tx - hr.fx) * u; hr.z = hr.fz + (hr.tz - hr.fz) * u;
      const arc = Math.sin(u * Math.PI);
      p.y = heightAt(hr.x, hr.z) + arc * hr.h;
      // the bound: hind legs drive back off the ground, fore legs reach, then land fore-first
      p.a0 = u < 0.35 ? Math.sin((u / 0.35) * Math.PI * 0.5) : 1 - (u - 0.35) / 0.65 * 1.5;
      p.a1 = u < 0.5 ? -0.7 * Math.sin(u * TAU) : 0.5 * Math.sin((u - 0.5) * TAU);
      p.pitch = (0.5 - u) * (hr.mode === 'flee' ? 0.5 : 0.3);
    } else {
      p.y = heightAt(hr.x, hr.z);
      p.a0 += (0 - p.a0) * Math.min(1, dt * 10); p.a1 += (0 - p.a1) * Math.min(1, dt * 10);
      p.pitch += (hr.sit * 0.22 - 0.04 - p.pitch) * Math.min(1, dt * 6);
    }
    hr.timer -= dt;
    switch (hr.mode) {
      case 'graze':
        hr.sit += (0 - hr.sit) * Math.min(1, dt * 3);
        hr.headPitch += (0.55 - hr.headPitch) * Math.min(1, dt * 3); hr.ears += (0.35 - hr.ears) * Math.min(1, dt * 2);
        if (!hopping && hr.timer <= 0) { hr.timer = rng.range(1.5, 5); hr.yaw += rng.range(-1.2, 1.2); if (rng.next() < 0.7) hop(hr, rng.range(0.3, 0.7), 0.32, 0.08); }
        break;
      case 'alert':
        hr.sit += (1 - hr.sit) * Math.min(1, dt * 5);
        hr.headPitch += (-0.3 - hr.headPitch) * Math.min(1, dt * 6); hr.ears += (-0.15 - hr.ears) * Math.min(1, dt * 6);
        if (hr.timer <= 0 && d > scare + 6) { hr.mode = 'graze'; hr.timer = rng.range(1, 3); }
        break;
      case 'flee':
        hr.sit = 0;
        hr.headPitch += (-0.1 - hr.headPitch) * Math.min(1, dt * 8); hr.ears += (0.9 - hr.ears) * Math.min(1, dt * 8);
        if (!hopping) {
          if (hr.fleeLeft <= 0) { hr.mode = 'alert'; hr.timer = rng.range(3, 6); break; }
          hr.zig -= 1;
          const away = Math.atan2(hr.x - pp.x, hr.z - pp.z);
          if (hr.zig <= 0) { hr.zig = rng.int(2, 4); hr.yaw = away + rng.range(-0.7, 0.7); } else hr.yaw += wrap(away - hr.yaw) * 0.2;
          hop(hr, 2.4, 0.27, 0.42); hr.fleeLeft -= 2.4;
        }
        break;
      default: break;
    }
    p.x = hr.x; p.z = hr.z; p.yaw = hr.yaw; p.roll = 0;
    p.a2 = hr.headPitch - hr.sit * 0.2; p.a3 = hr.ears; p.b1 = hr.mode === 'alert' ? Math.sin(now() * 1.3 + hr.slot) * 0.5 : 0;
    wild.add(p);
  };

  // ── the skinning beat (F2) ──
  let beatT = -1, beatCarcass: Animal | null = null, beatGive: (() => void) | null = null, cutsDone = 0;
  let addPitch = 0, addY = 0, lastRx = Number.NaN, lastPy = Number.NaN;
  const fx = CameraFX.for(game);
  // the gloved hand and the skinning knife the strokes are made with (the weapon is holstered for the beat)
  const knife = new SkinKnife(game, sky);
  const harvest = (carcass: Animal, give: () => void): void => {
    if (beatT >= 0) { beatGive?.(); } // a second harvest mid-beat (never, the prompt hides): the first one's drops land now
    beatT = 0; beatCarcass = carcass; beatGive = give; cutsDone = 0;
    h.weapons.setEnabled(false); h.weapons.visible = false;
    h.audio.footstep(false, 'litter'); // kneeling in the needles
    const c = carcasses.find((k) => k.a === carcass);
    if (c) c.harvestT = now();
    else carcasses.push({ a: carcass, killT: now() - 60, comeT: now() + ravenDelay(rng.next()) * 0.5, harvestT: now(), visit: 'waiting', ravens: [], feedLeft: rng.range(40, 70), leaveT: 0, dimmed: false });
  };
  const updateBeat = (dt: number): void => {
    // take last frame's offset back when nothing rewrote the camera since (Player.update rewrites it every frame)
    if (cam.rotation.x === lastRx && cam.position.y === lastPy) { cam.rotation.x -= addPitch; cam.position.y -= addY; }
    addPitch = 0; addY = 0;
    if (beatT < 0) { lastRx = Number.NaN; lastPy = Number.NaN; knife.update(-1); return; }
    beatT += dt;
    knife.update(beatT);
    const env = beatEnvelope(beatT);
    // kneel: down 0.55 m and the view tipped toward the carcass (at most ~35°, never past it)
    let tip = 0.35;
    if (beatCarcass) {
      const a = beatCarcass.position, dx = a.x - cam.position.x, dz = a.z - cam.position.z, dy = a.y + 0.3 - (cam.position.y - 0.55);
      const want = Math.atan2(dy, Math.hypot(dx, dz)); // negative = below
      tip = THREE.MathUtils.clamp(-(want - cam.rotation.x), 0, 0.6);
    }
    addPitch = -tip * env; addY = -0.55 * env;
    const cut = BEAT.cuts[cutsDone];
    if (cut !== undefined && beatT >= cut) {
      cutsDone++;
      if (!voice(cutsDone % 2 === 1 ? 'skinCut-a' : 'skinCut-b', undefined, 0.85)) h.audio.swordHit('flesh', (Math.random() - 0.5) * 0.3, 0.42);
      fx.kick(-1.1, cutsDone % 2 === 0 ? 0.8 : -0.8);
    }
    if (beatT >= BEAT.len) {
      beatT = -1; beatCarcass = null;
      const give = beatGive; beatGive = null; give?.();
      if (!player.swimming) { h.weapons.setEnabled(true); h.weapons.visible = true; }
    }
    cam.rotation.x += addPitch; cam.position.y += addY;
    lastRx = cam.rotation.x; lastPy = cam.position.y;
  };

  // ── the frame ──
  let perfMs = 0;
  game.onUpdate((dt) => {
    const t0 = performance.now();
    wild.begin();
    updateBeat(dt);
    cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const night = sky.pine?.night ?? 0, t = now();
    updateCarcasses(t, dt);
    for (const r of ravens) { if (r.mode === 'off') continue; updateRaven(r, dt); if (flying(r)) wild.add(r.pose); }
    updateOwl(dt, night); if (owl.mode !== 'off') wild.add(owl.pose);
    updateWood(dt, night); if (wood.mode !== 'off') wild.add(wood.pose);
    updateCrumbs(dt, night); for (const j of guides) if (j.mode !== 'off') wild.add(j.pose);
    for (const hr of hares) updateHare(hr, dt);
    wild.commit();
    perfMs = perfMs * 0.95 + (performance.now() - t0) * 0.05;
  });

  const life: PineLife = { mesh: wild.mesh, harvest, get busy() { return beatT >= 0; } };
  Object.assign(window, { __pineLife: {
    wild, ravens, owl, wood, guides, hares, carcasses, get ms() { return perfMs; },
    /** a breadcrumb flock now (captures); the place it heads for */
    crumbs: () => crumbs(true),
    /** the owl onto a perch near you now (captures; set the clock to night first) — or onto the snag nearest (x, z) */
    owlNow: (x?: number, z?: number) => {
      if (x === undefined || z === undefined) { off(owl); owlNextT = 0; return true; }
      const spot = owlPerch(new THREE.Vector3(x, 0, z), 0, 20, null);
      if (!spot) return false;
      const pp = player.position;
      spawnAt(owl, pp.x - fwd.x * 40, spot.y + 6, pp.z - fwd.z * 40, spot.x, spot.z); owlSettle(spot);
      return true;
    },
    /** the woodpecker onto a trunk near you now */
    woodNow: () => { wood.mode = 'off'; woodNextT = 0; },
    /** ravens to the nearest carcass now (or the one at x, z) */
    ravensTo: (x?: number, z?: number) => {
      const pp = player.position, qx = x ?? pp.x, qz = z ?? pp.z;
      let best: Carcass | undefined, bd = Infinity;
      for (const c of carcasses) { const d = Math.hypot(c.a.position.x - qx, c.a.position.z - qz); if (d < bd) { bd = d; best = c; } }
      if (best?.visit === 'waiting') best.comeT = now();
      return best !== undefined;
    },
    /** the skinning beat's clock (−1 idle) */
    beat: () => beatT,
  } });
  return life;
}
