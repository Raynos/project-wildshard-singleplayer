import * as THREE from 'three';
import type { Animal } from '../entities/Animal';
import { heightAt } from '../world/Heightfield';
import { fxMaterial, annulus, FX, type FxMaterial } from '../world/nalati/KurganDungeon';
import { WeaponPickup } from '../player/WeaponPickup';
import type { Interactable } from '../world/Cabin';
import type { EliteBar } from '../ui/EliteBar';

/**
 * Elite — the engine's NAMED ELITE system (docs/design/nalati/elites-and-bosses.md §1; plan NALATI.md row B12). "Elites
 * live in the world, bosses own the screen." This is the generic half every shard reuses — each elite's own AI is an
 * `EliteScript` (Nalati's five: src/nalati/elites.ts).
 *
 *   const elites = new Elites(host, bar);            // bar = new EliteBar() (src/ui/EliteBar.ts)
 *   elites.add(script);                              // one per elite: its EliteDef + its brain
 *   game.onUpdate((dt, t) => elites.update(dt, t));
 *
 * What the system does for every elite:
 *   · PLACEMENT + SPAWN RULE — placed at its lair, only while its rule holds ('always' | 'dusk' | 'night' | 'storm',
 *     `host.condition(rule)`), one alive at a time; a dusk / night / storm elite leaves when its rule ends (unengaged).
 *   · AWARE → ENGAGED → LEASH — aware inside `awareR` (the named bar shows OVER ITS HEAD), engaged inside `engageR` or
 *     on a hit (the bar PINS top-centre — the user's rule), and past `leashR` from the lair it disengages, walks home
 *     (`script.leash`) and regenerates to full.
 *   · PHASE 2 AT 50 % — a 1 s invulnerable beat, "ENRAGED" (or the def's caption) under the bar, `script.enterPhase2()`.
 *   · THE BANNER — "NAMED ELITE NEARBY · name · epithet", once per approach (first aware inside 80 m, or entering the
 *     lair); re-armed after 60 s beyond the leash.
 *   · DEATH → DROP + TIMER — the first kill drops the cosmetic skin in the purple orb (`WeaponPickup` tier 'rare') + the
 *     trophy; later kills the trophy only. The kill itself goes through the AnimalManager (kill feed, Progress →
 *     the achievement + joke title). The lair then sleeps `respawnMin` minutes of PLAY time (persisted, 'ws.elites.v1');
 *     a dusk / night elite comes back at the next dusk after that. A `once` elite (Argymaq) never comes back.
 *   · THE SKULL — a gold skull on the minimap at a discovered lair (you came within 60 m, or it saw you): pulsing while
 *     engaged, grey with a countdown ring while dead (`EliteBar.skulls`).
 *   · TELLS — `GroundTell`: a pooled, terrain-draped ring / lane decal (one FX program) for the signature move's tell.
 */

export type EliteRule = 'always' | 'dusk' | 'night' | 'storm';

export interface EliteDef {
  id: string;
  /** "Aqbars the Pale" / "Irbis of the Crags" */
  name: string;
  epithet: string;
  lair: { x: number; z: number; r: number };
  awareR: number; engageR: number; leashR: number;
  rule: EliteRule;
  /** minutes of play before the lair wakes again */
  respawnMin: number;
  /** a one-time elite (Argymaq: once tamed, the lair retires) */
  once?: boolean;
  /** the signature move's name — flashes under the bar the first time you see it */
  signature: string;
  /** the phase-2 caption ("ENRAGED") */
  phase2: string;
  /** the first-kill drop (cosmetic) and the trophy every kill leaves */
  drop: { skin: string; skinName: string; weapon: string; blurb: string; trophyName: string };
}

export interface EliteScript {
  readonly def: EliteDef;
  /** the elite's animal while it is out (null otherwise) */
  readonly animal: Animal | null;
  /** place it at the lair (the rule holds and no timer runs) */
  spawn: () => void;
  /** take it out of the world (its rule ended, unengaged) */
  despawn: () => void;
  /** per frame while it is out: its AI glue. `engaged` = the fight is on; `leashing` = walking home */
  tick: (dt: number, t: number, engaged: boolean, leashing: boolean) => void;
  enterPhase2: () => void;
  /** the fight reset (leash): back to phase 1 */
  reset: () => void;
  /** the bar's fill 0..1 (default hp / maxHp) — Argymaq's reads 0 at BROKEN */
  barFrac?: () => number;
  /** beaten, not killed (Argymaq: BROKEN) — the system treats it as the end of the fight */
  broken?: () => boolean;
  /** the drop orb's display model */
  dropModel: () => THREE.Object3D;
  /** a trophy into the pack (every kill) */
  trophy: () => void;
  /** won for good (the once elite, tamed): the lair retires */
  retired?: () => boolean;
  /** an extra spawn condition on top of the rule (Qara Batyr: five ghost riders killed tonight) */
  canSpawn?: () => boolean;
}

export interface EliteHost {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer?: THREE.WebGLRenderer;
  player: { position: THREE.Vector3 };
  condition: (rule: EliteRule) => boolean;
  addInteractable: (it: Interactable) => void;
  removeInteractable: (it: Interactable) => void;
  toast: (text: string) => void;
  /** the "named elite nearby" sting / the phase roar / the kill (music + audio) */
  sting?: (event: 'banner' | 'phase2' | 'kill') => void;
  pickupHum?: (inside: boolean) => void;
  /** a first-kill skin was taken: own it (B15 wears it) */
  ownSkin?: (skin: string) => void;
  /** does the eye see the elite's head (no wall / rock / ground between)? The name over its head hides while it does not
   *  (a cabin wall between you and it); absent = always seen */
  canSee?: (from: THREE.Vector3, to: THREE.Vector3) => boolean;
}

type State = 'absent' | 'idle' | 'aware' | 'engaged' | 'leash' | 'dead' | 'broken' | 'retired';
interface Entry {
  script: EliteScript; state: State;
  /** seconds of play left before it may spawn again */
  timer: number;
  /** a dusk / night elite waits for the NEXT dusk after its timer */
  waitDusk: boolean;
  discovered: boolean; bannerArmed: boolean; farT: number;
  phase2: boolean; beatT: number; lockHp: number;
  seenSig: boolean; leashT: number; lastHit: number;
  drop: WeaponPickup | null;
  /** dev-spawned (`?elite=`): out whatever its rule */
  forced: boolean;
}
interface Saved { timer: number; discovered: boolean; skinTaken: boolean; kills: number; retired: boolean }
const STORE = 'ws.elites.v1';
function loadAll(): Record<string, Saved> { try { return (JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, Saved> | null) ?? {}; } catch { return {}; } }

const BANNER_R = 80, DISCOVER_R = 60, REARM_T = 60, LEASH_HOME_T = 12, SIGHT_EVERY = 0.2;
const _h = new THREE.Vector3();

export class Elites {
  readonly entries: Entry[] = [];
  private saved = loadAll();
  private saveT = 0;
  private lastDusk = false;
  /** the elite whose bar is up (nearest aware / engaged) */
  focus: Entry | null = null;
  /** the focus's head in line of sight (re-cast every SIGHT_EVERY s while its bar floats over its head) */
  private seen = true; private sightT = 0;

  constructor(private readonly host: EliteHost, private readonly bar: EliteBar) {}

  add(script: EliteScript): void {
    const s = this.saved[script.def.id] ?? { timer: 0, discovered: false, skinTaken: false, kills: 0, retired: false };
    this.saved[script.def.id] = s;
    this.entries.push({
      script, state: s.retired ? 'retired' : 'absent', timer: s.timer, waitDusk: false, discovered: s.discovered, bannerArmed: true, farT: 0,
      phase2: false, beatT: 0, lockHp: 0, seenSig: false, leashT: 0, lastHit: -Infinity, drop: null, forced: false,
    });
  }

  entry(id: string): Entry | undefined { return this.entries.find((e) => e.script.def.id === id); }
  owned(id: string): boolean { return this.saved[id]?.skinTaken ?? false; }

  /** dev: spawn it now next to (x, z) whatever its rule (`?elite=`) */
  devSpawn(id: string): Animal | null {
    const e = this.entry(id);
    if (!e || e.state === 'retired') return null;
    if (e.script.animal === null || !e.script.animal.alive) { e.timer = 0; e.script.spawn(); }
    e.state = 'idle'; e.discovered = true; e.forced = true;
    return e.script.animal;
  }

  private save(): void {
    for (const e of this.entries) { const s = this.saved[e.script.def.id]; if (s) { s.timer = e.timer; s.discovered = e.discovered; } }
    try { localStorage.setItem(STORE, JSON.stringify(this.saved)); } catch { /* not persisted this session */ }
  }

  /** the script says this elite moved its signature move now: flash its name the first time */
  signature(id: string): void {
    const e = this.entry(id);
    if (!e || e.seenSig) return;
    e.seenSig = true;
    if (this.focus === e) this.bar.caption(e.script.def.signature);
  }

  update(dt: number, t: number): void {
    const p = this.host.player.position;
    const dusk = this.host.condition('dusk');
    const duskEdge = dusk && !this.lastDusk; this.lastDusk = dusk;
    let best: Entry | null = null, bestD = Infinity;
    for (const e of this.entries) {
      const def = e.script.def;
      const dl = Math.hypot(p.x - def.lair.x, p.z - def.lair.z);
      if (!e.discovered && dl < DISCOVER_R) { e.discovered = true; this.save(); }
      if (e.state === 'retired') continue;
      if (e.script.retired?.() === true) { this.retire(e); continue; }
      // ── timers and the spawn rule ──
      if (e.state === 'dead' || e.state === 'absent') {
        if (e.timer > 0) { e.timer = Math.max(0, e.timer - dt); if (e.timer === 0 && (def.rule === 'dusk' || def.rule === 'night')) e.waitDusk = true; }
        if (e.waitDusk && duskEdge) e.waitDusk = false;
        if (e.timer <= 0 && !e.waitDusk && this.host.condition(def.rule) && e.script.canSpawn?.() !== false) {
          e.script.spawn(); e.state = 'idle'; e.phase2 = false; e.seenSig = false; e.drop = null;
        } else continue;
      }
      const a = e.script.animal;
      if (a === null) { e.state = 'absent'; continue; }
      // ── the end of the fight: dead — or BROKEN (beaten, not killed: the taming takes over; thrown, he fights on) ──
      if (!a.alive) { this.fell(e); continue; }
      const broken = e.script.broken?.() === true;
      if (broken) {
        if (e.state !== 'broken') { e.state = 'broken'; this.focus = e; this.bar.show(e.script.def.name, e.script.def.epithet); this.bar.caption('BROKEN'); }
        a.headWorld(_h); _h.y += 0.55 * a.scale;
        this.bar.set(0, 'pinned', _h, this.host.camera, false, true);
        continue;
      }
      if (e.state === 'broken') e.state = 'engaged';
      // ── the rule ended: it leaves (never mid-fight) ──
      if (e.state === 'idle' && !e.forced && !this.host.condition(def.rule)) { e.script.despawn(); e.state = 'absent'; continue; }
      const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
      const hit = a.lastHitT > e.lastHit; if (hit) e.lastHit = a.lastHitT;
      // ── aware / engaged / leash ──
      if (e.state === 'idle' && (d < def.awareR || hit)) { e.state = 'aware'; e.discovered = true; }
      if ((e.state === 'aware' || e.state === 'idle') && (d < def.engageR || hit)) e.state = 'engaged';
      if (e.state === 'aware' && d > def.awareR * 1.3) e.state = 'idle';
      if ((e.state === 'engaged' || e.state === 'aware') && dl > def.leashR) { e.state = 'leash'; e.leashT = 0; e.script.reset(); e.phase2 = false; }
      if (e.state === 'leash') {
        e.leashT += dt;
        a.hp = Math.min(a.maxHp, a.hp + a.maxHp * dt / LEASH_HOME_T);
        if (e.leashT > LEASH_HOME_T || (Math.hypot(a.position.x - def.lair.x, a.position.z - def.lair.z) < def.lair.r * 0.5 && a.hp >= a.maxHp)) { a.hp = a.maxHp; e.state = 'idle'; }
      }
      // ── the banner, once per approach ──
      if (e.bannerArmed && (e.state === 'aware' || e.state === 'engaged' || dl < def.lair.r) && d < BANNER_R) {
        e.bannerArmed = false; this.bar.banner(def.name, def.epithet); this.host.sting?.('banner');
      }
      if (!e.bannerArmed) { if (dl > def.leashR) { e.farT += dt; if (e.farT > REARM_T) { e.bannerArmed = true; e.farT = 0; } } else e.farT = 0; }
      // ── phase 2 at 50 % ──
      if (!e.phase2 && e.state === 'engaged' && a.hp <= a.maxHp * 0.5) {
        e.phase2 = true; e.beatT = 1; e.lockHp = a.hp;
        e.script.enterPhase2();
        if (this.focus === e) this.bar.caption(def.phase2);
        this.host.sting?.('phase2');
      }
      if (e.beatT > 0) { e.beatT -= dt; if (a.hp < e.lockHp) a.hp = e.lockHp; }
      e.script.tick(dt, t, e.state === 'engaged', e.state === 'leash');
      if ((e.state === 'aware' || e.state === 'engaged') && d < bestD) { best = e; bestD = d; }
    }
    // ── the bar: the nearest aware / engaged elite ──
    if (best !== this.focus) {
      this.focus = best; this.sightT = 0;
      if (best) this.bar.show(best.script.def.name, best.script.def.epithet); else this.bar.hide();
    }
    if (this.focus) {
      const e = this.focus, a = e.script.animal;
      if (a) {
        a.headWorld(_h); _h.y += 0.55 * a.scale;
        const pinned = e.state === 'engaged';
        // the floating name is world-anchored: behind a wall it hides (a pinned bar is the fight's and stays)
        if (pinned || !this.host.canSee) { this.seen = true; this.sightT = 0; }
        else if ((this.sightT -= dt) <= 0) { this.sightT = SIGHT_EVERY; this.seen = this.host.canSee(this.host.camera.position, _h); }
        this.bar.set(e.script.barFrac?.() ?? a.hp / a.maxHp, pinned ? 'pinned' : 'head', _h, this.host.camera, e.beatT > 0, false, !this.seen);
      }
    }
    this.bar.skulls(this.entries.map((e) => ({
      x: e.script.def.lair.x, z: e.script.def.lair.z, shown: e.discovered && e.state !== 'retired',
      dead: e.state === 'dead', engaged: e.state === 'engaged', countdown: e.state === 'dead' ? e.timer / (e.script.def.respawnMin * 60) : 0,
    })), p);
    for (const e of this.entries) if (e.drop) { e.drop.update(dt, t, this.host.renderer, this.host.camera); if (e.drop.group.parent === null) e.drop = null; }
    this.bar.update(dt);
    this.saveT += dt;
    if (this.saveT > 10) { this.saveT = 0; this.save(); }
  }

  private fell(e: Entry): void {
    const def = e.script.def, s = this.saved[def.id], a = e.script.animal;
    if (!s) return;
    s.kills++;
    e.script.trophy();
    this.host.sting?.('kill');
    if (!s.skinTaken && a) this.dropSkin(e, a.position);
    e.state = 'dead'; e.forced = false;
    e.timer = def.respawnMin * 60; e.waitDusk = false;
    if (this.focus === e) { this.bar.set(0, 'pinned', null, this.host.camera, false); this.focus = null; setTimeout(() => { if (this.focus === null) this.bar.hide(); }, 1600); }
    this.save();
  }

  /** a once elite won for good (Argymaq tamed): the trophy + the "skin" (the horse is the reward), the lair retires */
  won(id: string): void {
    const e = this.entry(id), s = this.saved[id];
    if (!e || !s || e.state === 'retired') return;
    s.kills++; e.script.trophy();
    if (!s.skinTaken) { s.skinTaken = true; this.host.ownSkin?.(e.script.def.drop.skin); }
    this.retire(e);
  }

  private retire(e: Entry): void {
    e.state = 'retired';
    const s = this.saved[e.script.def.id]; if (s) s.retired = true;
    if (this.focus === e) { this.focus = null; this.bar.hide(); }
    this.save();
  }

  private dropSkin(e: Entry, at: THREE.Vector3): void {
    const def = e.script.def, s = this.saved[def.id];
    const drop = new WeaponPickup({ scene: this.host.scene, item: e.script.dropModel(), position: new THREE.Vector3(at.x, heightAt(at.x, at.z), at.z), tier: 'rare', prompt: `Take the ${def.drop.skinName} ${def.drop.weapon} skin`, scale: 1.4 });
    e.drop = drop;
    this.host.addInteractable(drop.interactable);
    drop.onNear = (inside) => this.host.pickupHum?.(inside);
    drop.onPickup = () => {
      if (s) s.skinTaken = true;
      this.save();
      this.host.ownSkin?.(def.drop.skin);
      this.host.removeInteractable(drop.interactable);
      this.host.pickupHum?.(false);
      this.host.toast(`${def.drop.skinName} ${def.drop.weapon} skin — ${def.drop.blurb}`);
    };
  }
}

// ─────────────────────────────── the telegraph decals ───────────────────────────────

/**
 * GroundTell — a terrain-draped telegraph decal (a ring at your feet, a lane across the grass), drawn over the grass
 * (depth test off: a tell must never hide) with the shared FX program. `ring(x, z, r, alpha)` / `lane(x0, z0, x1, z1,
 * width, alpha)` re-drape it (≤ 130 heightAt calls — only when it moves); `hide()`.
 */
export class GroundTell {
  readonly mesh: THREE.Mesh;
  private readonly mat: FxMaterial;
  private readonly base: Float32Array;
  private readonly pos: THREE.BufferAttribute;
  constructor(scene: THREE.Scene, kind: 'ring' | 'lane', color: THREE.ColorRepresentation) {
    let g: THREE.BufferGeometry;
    if (kind === 'ring') g = annulus(0.86, 1, 64);
    else {
      // a unit lane: x across (−0.5..0.5), z along (0..1); uv.x along, uv.y across (the ring look: a bright band)
      const seg = 24, P: number[] = [], U: number[] = [], N: number[] = [], I: number[] = [];
      for (let i = 0; i <= seg; i++) { const z = i / seg; P.push(-0.5, 0, z, 0.5, 0, z); U.push(z, 0, z, 1); N.push(0, 1, 0, 0, 1, 0); if (i < seg) { const k = i * 2; I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
      g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I);
    }
    this.pos = g.getAttribute('position') as THREE.BufferAttribute;
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.base = new Float32Array(this.pos.array);
    this.mat = fxMaterial(FX.ring, color, 0);
    this.mat.uniforms.uP.value.x = kind === 'ring' ? 0.8 : 0.6;
    // a ring reads over everything (a pounce landing zone); a lane runs through the grass towards you — depth-tested, so the
    // blades between you and it stand in front of it instead of a flat wash over the whole lower screen
    this.mat.depthTest = kind !== 'ring';
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 30;
    scene.add(this.mesh);
  }
  setTime(t: number): void { this.mat.uniforms.uTime.value = t; }
  hide(): void { this.mesh.visible = false; }
  ring(x: number, z: number, r: number, alpha: number, lift = 0.35): void {
    const b = this.base, P = this.pos;
    for (let i = 0; i < P.count; i++) { const lx = (b[i * 3] ?? 0) * r, lz = (b[i * 3 + 2] ?? 0) * r; P.setXYZ(i, x + lx, heightAt(x + lx, z + lz) + lift, z + lz); }
    P.needsUpdate = true; this.show(alpha);
  }
  lane(x0: number, z0: number, x1: number, z1: number, width: number, alpha: number, lift = 0.35): void {
    const b = this.base, P = this.pos, dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1, ax = -dz / L, az = dx / L;
    for (let i = 0; i < P.count; i++) {
      const across = (b[i * 3] ?? 0) * width, along = b[i * 3 + 2] ?? 0;
      const x = x0 + dx * along + ax * across, z = z0 + dz * along + az * across;
      P.setXYZ(i, x, heightAt(x, z) + lift, z);
    }
    P.needsUpdate = true; this.show(alpha);
  }
  private show(alpha: number): void { this.mat.uniforms.uAlpha.value = alpha; this.mesh.visible = alpha > 0.01; }
}
