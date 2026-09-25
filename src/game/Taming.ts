import * as THREE from 'three';
import type { Player } from '../player/Player';
import type { Mount } from '../player/Mount';
import type { Animal } from '../entities/Animal';
import type { AnimalManager } from '../entities/AnimalManager';
import type { HorseHerd } from '../entities/Herd';
import type { Interactable } from '../world/Cabin';
import type { RideHUD, TamingView } from '../ui/RideHUD';
import { wildEnv } from '../entities/wildEnv';
import { heightAt } from '../world/Heightfield';

/**
 * Taming — winning a wild stallion (Nalati row B8; docs/design/nalati/wolves-horses-taming.md "Taming — step by step";
 * mockups taming-1-approach / taming-2-bucking / taming-3-bonded). One horse ever (plan decision): TULPAR.
 *
 *   const taming = new Taming({ player, mount, animals, hud, herds: () => wildlife.herds, rest, hurt, toast });
 *   interactables.push(taming.interactable)     // MOUNT on the stallion once he lets you (or once he is beaten)
 *   game.onUpdate((dt) => taming.update(dt))     // after the mount's update; `hud.update(taming.view)` draws it
 *   taming.noteShot(x, z)                        // an arrow / javelin landed (−30 TRUST within 40 m, ALERT full)
 *
 * 1 · APPROACH inside 40 m of a herd's stallion: the TRUST arc (herd.trust 0..100) and his ALERT ear (herd.alert; the
 *   taming owns it while you are near — `herd.alertOwned`). Per second: crouched, ≤ 2.4 m/s, inside 25 m +2; holding
 *   OFFER (G / the OFFER disc) inside 12 m while ALERT is grey +8; both ×1.5 downwind of him; upright inside 30 m ALERT
 *   +10 (no trust); running / riding past 5 m/s or staring at his head > 3 s TRUST −5, ALERT +25; nothing −1 TRUST, ALERT
 *   −15. ALERT red → he rears (the herd's `display`); maxed → he charges (TRUST < 20, the herd's stallion logic) or leads
 *   the herd away (−30). Wolves driven off his herd today: +30 once ('pack-driven-off' / 'pack-break' near it).
 * 2 · BREAK HIM: TRUST 100 inside 3 m — or him BEATEN (herd.onBeaten, < 25 % hp) — puts a MOUNT prompt on him. Five
 *   rounds (3.5 s each) of bucking: a balance marker −1..1 pushed by BUCKS (a shove to one side), SPINS (a steady drift)
 *   and REARS (a swing that reverses), each telegraphed 0.3 s early by the horse; LEAN L / LEAN R (A / D, the discs)
 *   push back. Each round 20 % harder. A red end (|b| > 0.72) for 0.4 s, or the edge, throws you: 10 damage, TRUST −40,
 *   he leads the herd away. The camera tilts with the balance (≤ 25°) and shakes on each buck.
 * 3 · BONDED: he is TULPAR — saddled and bridled (the `tulpar` variant), yours: mountable, whistled (X / HORSE),
 *   can't die, rests at the hitching rail. Remembered across sessions (localStorage 'ws.nalati.tulpar').
 * ONE HORSE (plan decision): once bonded, the wild stallions are left alone — except ARGYMAQ (the elite, kind
 *   'argymaq', src/nalati/elites.ts). Break him and he REPLACES Tulpar: the old horse leaves the rail for good, the new
 *   one is saddled at Argymaq's ×1.3 in his blue-black coat, named ARGYMAQ (stored as 'argymaq').
 */

export interface TamingOpts {
  player: Player;
  mount: Mount;
  animals: AnimalManager;
  hud: RideHUD;
  herds: () => HorseHerd[];
  /** where Tulpar waits / rests (a hitch spot at the camp's rail) */
  rest: { x: number; z: number; face: { x: number; z: number } };
  hurt: (damage: number) => void;
  toast?: (text: string) => void;
}

interface Move { kind: 'buck' | 'spin' | 'rear'; dir: number; at: number; power: number }

const RANGE = 40, ROUNDS = 5, ROUND_T = 3.5, TELEGRAPH = 0.3;
const LEAN_ACC = 6.2, DAMP = 2.4, RED = 0.72, THROW_T = 0.4;
const STORE = 'ws.nalati.tulpar';
/** the elite stallion's kind (src/nalati/elites.ts ARGYMAQ) — the one horse that may replace a bonded Tulpar */
const ARGYMAQ_KIND = 'argymaq';
const _v = new THREE.Vector3(), _f = new THREE.Vector3();

export class Taming {
  phase: 'wild' | 'breaking' | 'bonded' = 'wild';
  /** your bonded horse */
  tulpar: Animal | null = null;
  /** the bonded horse is Argymaq (the elite) — the best horse; nothing replaces him */
  isArgymaq = false;
  /** the MOUNT prompt on the stallion (radius 0 until he lets you) */
  readonly interactable: Interactable = { position: new THREE.Vector3(0, -1e4, 0), radius: 0, label: 'Mount the stallion', onInteract: () => { this.startBreaking(); } };
  /** what RideHUD draws */
  readonly view: TamingView = { trust: null, alert: 0, ear: null, round: null, balance: 0, danger: false, offer: false };
  onBonded?: ((horse: Animal) => void) | undefined;
  /** the bucking rounds start / end — holster the weapon (both hands in the mane), bring it back */
  onBreaking?: ((on: boolean) => void) | undefined;

  private herd: HorseHerd | null = null;
  private stallion: Animal | null = null;
  private beaten = new WeakSet<Animal>();
  private drove = new WeakSet<HorseHerd>();
  private readonly ear = new THREE.Vector3();
  private lookT = 0;
  private readonly prev = new THREE.Vector3(); private speed = 0; private init = false;
  // breaking
  private round = 0; private roundT = 0; private b = 0; private bv = 0; private redT = 0;
  private moves: Move[] = [];
  private spinF = 0; private spinT = 0;
  private offerKey = false;

  constructor(private readonly opts: TamingOpts) {
    document.addEventListener('keydown', (e) => { if (e.code === 'KeyG') this.offerKey = true; });
    document.addEventListener('keyup', (e) => { if (e.code === 'KeyG') this.offerKey = false; });
    // wolves driven off a herd: +30 TRUST once per herd (the pack broke / was driven off within 40 m of it)
    const prevEvent = wildEnv.onEvent;
    wildEnv.onEvent = (name, x, z) => {
      prevEvent?.(name, x, z);
      if (name !== 'pack-driven-off' && name !== 'pack-break') return;
      for (const h of this.opts.herds()) if (!this.drove.has(h) && Math.hypot(h.cx - x, h.cz - z) < 40 && this.opts.player.position.distanceTo(_v.set(h.cx, this.opts.player.position.y, h.cz)) < 60) { this.drove.add(h); h.addTrust(30); this.opts.toast?.('The herd saw you drive the wolves off · TRUST +30'); }
    };
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORE); } catch { /* no storage: not remembered */ }
    if (saved === '1' || saved === ARGYMAQ_KIND) this.spawnTulpar(this.opts.rest.x + 2.6, this.opts.rest.z + 3.5, Math.atan2(this.opts.rest.face.x, this.opts.rest.face.z), saved === ARGYMAQ_KIND);
  }

  /** an arrow / javelin landed at (x, z): −30 TRUST and ALERT full if a stallion is within 40 m */
  noteShot(x: number, z: number): void {
    for (const h of this.opts.herds()) {
      const s = h.stallion;
      if (s === null || Math.hypot(s.position.x - x, s.position.z - z) > RANGE) continue;
      h.addTrust(-30); h.alert = 100;
    }
  }

  update(dt: number): void {
    const p = this.opts.player;
    if (!this.init) { this.prev.copy(p.position); this.init = true; }
    if (dt > 0) this.speed += (Math.hypot(p.position.x - this.prev.x, p.position.z - this.prev.z) / dt - this.speed) * Math.min(1, dt * 6);
    this.prev.copy(p.position);
    if (this.phase === 'breaking') { this.updateBreaking(dt); return; }
    this.view.round = null; this.view.danger = false;
    // the nearest herd with a stallion
    let herd: HorseHerd | null = null, st: Animal | null = null, bd = Infinity;
    for (const h of this.opts.herds()) {
      const s = h.stallion;
      if (s === null || !s.alive || !this.canTame(s)) continue;
      const d = s.position.distanceTo(p.position);
      if (d < bd) { bd = d; herd = h; st = s; }
    }
    if (this.herd !== null && this.herd !== herd) this.herd.alertOwned = false;
    this.herd = herd; this.stallion = st;
    this.interactable.radius = 0;
    if (herd === null || st === null || bd > RANGE) {
      if (herd !== null) { herd.alertOwned = false; herd.addTrust(-1 * dt); }
      this.view.trust = null; this.view.ear = null; this.view.offer = false;
      return;
    }
    herd.alertOwned = true;
    const beaten = herd.stallionState === 'beaten';
    if (beaten) this.beaten.add(st);
    // ── the approach ──
    const crouched = p.crouching, spd = this.opts.mount.mounted ? Math.max(this.speed, 6) : this.speed;
    const w = wildEnv.wind;
    const tx = p.position.x - st.position.x, tz = p.position.z - st.position.z, tl = Math.hypot(tx, tz) || 1;
    const downwind = w.strength > 0.05 && (tx * w.x + tz * w.z) / tl > 0.82;
    // staring at his head (the reticle within ~4°) for more than 3 s is a challenge
    st.headWorld(this.ear);
    p.camera.getWorldDirection(_f);
    _v.copy(this.ear).sub(p.camera.position).normalize();
    this.lookT = _f.dot(_v) > 0.9975 ? this.lookT + dt : Math.max(0, this.lookT - dt * 2);
    const offering = (this.offerKey || this.opts.hud.offer) && bd < 12;
    let trustRate = -1, alertRate = -15;
    if (crouched && spd <= 2.4 && bd < 25) trustRate = 2;
    if (offering && herd.alert < 33) trustRate = Math.max(trustRate, 0) + 8;
    if (trustRate > 0 && downwind) trustRate *= 1.5;
    if (!crouched && !beaten && bd < 30) { alertRate = 10; trustRate = Math.min(trustRate, 0); }
    if (spd > 5 || this.lookT > 3) { trustRate = -5; alertRate = 25; }
    if (beaten) { trustRate = Math.max(trustRate, 0); alertRate = -30; }
    herd.addTrust(trustRate * dt);
    herd.alert = THREE.MathUtils.clamp(herd.alert + alertRate * dt, 0, 100);
    // ALERT maxed with some trust: he takes the herd away (the charge at low trust is the herd's own stallion logic)
    if (herd.alert >= 100 && herd.trust >= 20 && herd.mode !== 'flee' && !beaten) herd.leadAway(p.position.x, p.position.z);
    // ── the MOUNT prompt: trust 100 inside 3 m, or beaten ──
    const ready = !this.opts.mount.mounted && (beaten || (herd.trust >= 100 && bd < 3.4));
    this.interactable.position.copy(st.position);
    this.interactable.radius = ready ? 3.6 : 0;
    this.interactable.label = beaten ? 'Break the stallion' : 'Mount the stallion';
    this.ear.y += 0.45 * st.scale;
    this.view.trust = herd.trust; this.view.alert = herd.alert; this.view.ear = this.ear;
    this.view.offer = bd < 12 && herd.alert < 33;
  }

  /** one horse: before a bond any stallion; after it only Argymaq (once) */
  canTame(s: Animal): boolean { return this.tulpar === null || (s.kind === ARGYMAQ_KIND && !this.isArgymaq); }

  // ── 2 · breaking him ─────────────────────────────────────────────────────────────────────────────────────────────

  private startBreaking(): void {
    const st = this.stallion, herd = this.herd;
    if (st === null || herd === null || this.phase === 'breaking' || !this.canTame(st)) return;
    if (!this.opts.mount.mount(st, true)) return;
    this.phase = 'breaking';
    this.interactable.radius = 0;   // no MOUNT prompt while you ride him out
    herd.alertOwned = true;
    this.opts.player.yaw = st.yaw - Math.PI; this.opts.player.pitch = -0.1;   // down his neck
    this.onBreaking?.(true);
    this.round = 1; this.roundT = 0; this.b = 0; this.bv = 0; this.redT = 0;
    this.planRound();
    this.opts.toast?.('HOLD ON — lean against him (A / D, LEAN L / LEAN R)');
  }

  private planRound(): void {
    const k = 1.2 ** (this.round - 1);
    this.moves = [];
    let t = 0.55;
    while (t < ROUND_T - 0.4) {
      const r = Math.random();
      const kind: Move['kind'] = r < 0.5 ? 'buck' : r < 0.78 ? 'spin' : 'rear';
      this.moves.push({ kind, dir: Math.random() < 0.5 ? -1 : 1, at: t, power: k });
      t += (kind === 'spin' ? 1.25 : 0.95) * (1.08 - 0.07 * this.round) + Math.random() * 0.3;
    }
  }

  private updateBreaking(dt: number): void {
    const m = this.opts.mount, st = this.stallion, p = this.opts.player;
    if (st === null || m.horse !== st) { this.endBreaking(false); return; }
    this.roundT += dt;
    // telegraph (0.3 s ahead) and fire the moves
    let force = 0;
    for (const mv of this.moves) {
      const lead = mv.at - this.roundT;
      if (lead > 0 && lead < TELEGRAPH) {
        // the horse shows it first: the head drops / comes up, a sideways lurch of the camera
        if (mv.kind === 'buck') { st.mem['buck'] = 1; st.mem['buckDir'] = mv.dir; }
        if (mv.kind === 'rear') st.mem['rear'] = 0.6;
        if (mv.kind === 'spin') st.mem['toss'] = 1;
        m.breakShake = Math.max(m.breakShake, 0.35);
      }
      if (lead <= 0 && lead > -dt) {
        if (mv.kind === 'buck') { this.bv += mv.dir * 2.1 * mv.power; m.breakShake = 1; st.mem['kick'] = 1; }
        if (mv.kind === 'rear') { this.bv += mv.dir * 1.9 * mv.power; st.mem['rear'] = 1; }
        if (mv.kind === 'spin') { this.spinF = mv.dir * 1.25 * mv.power; this.spinT = 1.0; }
      }
      // the rear's swing back 0.35 s later
      if (mv.kind === 'rear' && lead <= -0.35 && lead > -0.35 - dt) { this.bv -= mv.dir * 3.2 * mv.power; st.mem['rear'] = 0; m.breakShake = 0.8; }
    }
    if (this.spinT > 0) { this.spinT -= dt; force += this.spinF; st.setMotion(st.yaw + Math.sign(this.spinF) * 2, 0, 3.2); st.yaw += Math.sign(this.spinF) * dt * 2.6; }
    // your lean
    const k = p.keys;
    const lean = THREE.MathUtils.clamp((k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + this.opts.hud.lean, -1, 1);
    this.bv += (force - lean * LEAN_ACC) * dt;
    this.bv *= Math.exp(-DAMP * dt);
    this.b = THREE.MathUtils.clamp(this.b + this.bv * dt, -1.2, 1.2);
    const red = Math.abs(this.b) > RED;
    this.redT = red ? this.redT + dt : Math.max(0, this.redT - dt * 2);
    m.breakShake = Math.max(0, m.breakShake - dt * 2.5);
    m.breakRoll = -this.b * THREE.MathUtils.degToRad(25);
    st.mem['buck'] = Math.max(0, (st.mem['buck'] ?? 0) - dt * 1.4);
    this.view.round = this.round; this.view.balance = this.b; this.view.danger = red; this.view.trust = null; this.view.ear = null;
    if (this.redT > THROW_T || Math.abs(this.b) >= 1.15) { this.endBreaking(false); return; }
    if (this.roundT >= ROUND_T) {
      this.round++;
      if (this.round > ROUNDS) { this.endBreaking(true); return; }
      this.roundT = 0; this.planRound();
    }
  }

  private endBreaking(won: boolean): void {
    const m = this.opts.mount, st = this.stallion, herd = this.herd;
    this.phase = this.tulpar !== null ? 'bonded' : 'wild';
    this.view.round = null; this.view.danger = false;
    m.breakRoll = 0; m.breakShake = 0;
    this.onBreaking?.(false);
    if (st === null || herd === null) { if (m.mounted) m.dismount(true); return; }
    st.mem['buck'] = 0; st.mem['rear'] = 0;
    if (!won) {
      m.dismount(true);
      this.opts.hurt(10);
      herd.addTrust(-40);
      herd.leadAway(this.opts.player.position.x, this.opts.player.position.z);
      this.opts.toast?.('Thrown! TRUST −40 — find him again when the herd settles');
      return;
    }
    // ── 3 · bonded: the stallion leaves the herd and comes back saddled as TULPAR (you stay on him) ──
    const x = st.position.x, z = st.position.z, yaw = st.yaw, argymaq = st.kind === ARGYMAQ_KIND;
    m.dismount();
    herd.releaseStallion();
    st.hidden = true; st.mesh.visible = false; st.position.y = -1e4;
    // the one-horse rule: Argymaq replaces the Tulpar you had — he leaves the rail for good
    const old = this.tulpar;
    if (old !== null) {
      m.removeMountable(old);
      old.hidden = true; old.mesh.visible = false; old.alive = false; old.position.y = -1e4;
      const i = this.opts.animals.animals.indexOf(old); if (i !== -1) this.opts.animals.animals.splice(i, 1);
      old.mesh.removeFromParent();
      this.tulpar = null;
    }
    const t = this.spawnTulpar(x, z, yaw, argymaq);
    m.mount(t);
    try { localStorage.setItem(STORE, argymaq ? ARGYMAQ_KIND : '1'); } catch { /* not remembered */ }
    this.opts.toast?.(argymaq
      ? 'ARGYMAQ is yours — he takes Tulpar\'s place at the camp\'s rail · whistle (X / HORSE) to call him'
      : 'TULPAR is yours · he waits at the camp\'s hitching rail · whistle (X / HORSE) to call him');
    this.onBonded?.(t);
  }

  private spawnTulpar(x: number, z: number, yaw: number, argymaq = false): Animal {
    const t = this.opts.animals.spawn('horse', x, z, yaw, 'tulpar');
    t.place(x, z, yaw); t.position.y = heightAt(x, z);
    t.mem['whistle'] = 1;
    if (argymaq) {
      // Argymaq's size and his blue-black coat under Tulpar's saddle (elites.ts spawns him ×1.3, coat 0.62 / 0.64 / 0.72)
      t.scale = 1.3; t.mesh.scale.setScalar(1.3);
      const mats = Array.isArray(t.mesh.material) ? t.mesh.material : [t.mesh.material];
      for (const mt of mats) if (mt instanceof THREE.MeshLambertMaterial) mt.color.setRGB(0.62, 0.64, 0.72);
    }
    this.opts.mount.addMountable(t, argymaq ? 'Argymaq' : 'Tulpar');
    this.tulpar = t; this.isArgymaq = argymaq;
    this.phase = 'bonded';
    return t;
  }

  /** debugging / the harness: jump straight to the bucking rounds on the nearest stallion */
  forceBreak(): void {
    const h = this.herd, st = this.stallion;
    if (h === null || st === null) return;
    h.addTrust(100);
    this.startBreaking();
  }
}
