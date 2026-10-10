// Frozen shipping Taming.ts at c7c6ddd9b; only rendering/service ports are substituted.
import * as THREE from 'three';
import type { TamingHorse, TamingHerd, TamingObservation, NalatiTamingPorts } from '../../../src/shards/nalati-grasslands/runtime/tamingLaw';
interface Move { kind: 'buck' | 'spin' | 'rear'; dir: number; at: number; power: number }

const RANGE = 40, ROUNDS = 5, ROUND_T = 3.5, TELEGRAPH = 0.3;
const LEAN_ACC = 6.2, DAMP = 2.4, RED = 0.72, THROW_T = 0.4;
/** the elite stallion's kind (src/shards/nalati-grasslands/elites.ts ARGYMAQ) — the one horse that may replace a bonded Tulpar */
const ARGYMAQ_KIND = 'argymaq';
const _v = new THREE.Vector3(), _f = new THREE.Vector3();

/** The shipping approach, five bucking rounds and one-horse bond law, shared by Nalati's page and native host. */
export class ShippingTamingOracle<A extends TamingHorse, H extends TamingHerd<A>> {
  phase: 'wild' | 'breaking' | 'bonded' = 'wild';
  /** your bonded horse */
  tulpar: A | null = null;
  /** the bonded horse is Argymaq (the elite) — the best horse; nothing replaces him */
  isArgymaq = false;
  /** the MOUNT prompt on the stallion (radius 0 until he lets you) */
  readonly interactable: { readonly position: THREE.Vector3; radius: number; label: string; readonly onInteract: () => void } = { position: new THREE.Vector3(0, -1e4, 0), radius: 0, label: 'Mount the stallion', onInteract: () => { this.startBreaking(); } };
  /** what RideHUD draws */
  readonly view: TamingObservation = { trust: null, alert: 0, ear: null, round: null, balance: 0, danger: false, offer: false };
  onBonded?: ((horse: A) => void) | undefined;
  /** the bucking rounds start / end — holster the weapon (both hands in the mane), bring it back */
  onBreaking?: ((on: boolean) => void) | undefined;

  private herd: H | null = null;
  private stallion: A | null = null;
  private beaten = new Set<A>();
  private drove = new Set<H>();
  private readonly ear = new THREE.Vector3();
  private lookT = 0;
  private readonly prev = new THREE.Vector3(); private speed = 0; private init = false;
  // breaking
  private round = 0; private roundT = 0; private b = 0; private bv = 0; private redT = 0;
  private moves: Move[] = [];
  private spinF = 0; private spinT = 0;
  input: { readonly held: (action: 'ride.offer' | 'lean.right' | 'lean.left') => boolean } | null = null;

  constructor(private readonly opts: NalatiTamingPorts<A, H>) {
    let saved: string | null = null;
    try { saved = opts.bond.read(); } catch { /* no storage: not remembered */ }
    if (saved === '1' || saved === ARGYMAQ_KIND) this.spawnTulpar(this.opts.rest.x + 2.6, this.opts.rest.z + 3.5, Math.atan2(this.opts.rest.face.x, this.opts.rest.face.z), saved === ARGYMAQ_KIND);
  }

  /** Wolves driven off nearby earn trust once per herd, through the scoped creature signal. */
  noteEvent(name: string, x: number, z: number): void {
    if (name !== 'pack-driven-off' && name !== 'pack-break') return;
    for (const h of this.opts.herds()) if (!this.drove.has(h) && Math.hypot(h.cx - x, h.cz - z) < 40 && this.opts.player.position.distanceTo(_v.set(h.cx, this.opts.player.position.y, h.cz)) < 60) {
      this.drove.add(h); h.addTrust(30); this.opts.toast?.('The herd saw you drive the wolves off · TRUST +30');
    }
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
    let herd: H | null = null, st: A | null = null, bd = Infinity;
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
    const w = this.opts.wind();
    const tx = p.position.x - st.position.x, tz = p.position.z - st.position.z, tl = Math.hypot(tx, tz) || 1;
    const downwind = w.strength > 0.05 && (tx * w.x + tz * w.z) / tl > 0.82;
    // staring at his head (the reticle within ~4°) for more than 3 s is a challenge
    st.headWorld(this.ear);
    p.camera.getWorldDirection(_f);
    _v.copy(this.ear).sub(p.camera.position).normalize();
    this.lookT = _f.dot(_v) > 0.9975 ? this.lookT + dt : Math.max(0, this.lookT - dt * 2);
    const offering = (this.input?.held('ride.offer') ?? this.opts.hud.offer) && !this.opts.mount.mounted && bd < 12 && herd.alert < 33;
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
  canTame(s: A): boolean { return this.tulpar === null || (s.kind === ARGYMAQ_KIND && !this.isArgymaq); }

  // ── 2 · breaking him ─────────────────────────────────────────────────────────────────────────────────────────────

  /** Answer the live MOUNT prompt; ordinary callers must first select its visible radius. */
  startBreaking(): void {
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
      const r = this.opts.random();
      const kind: Move['kind'] = r < 0.5 ? 'buck' : r < 0.78 ? 'spin' : 'rear';
      this.moves.push({ kind, dir: this.opts.random() < 0.5 ? -1 : 1, at: t, power: k });
      t += (kind === 'spin' ? 1.25 : 0.95) * (1.08 - 0.07 * this.round) + this.opts.random() * 0.3;
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
    const lean = THREE.MathUtils.clamp((this.input ? (this.input.held('lean.right') ? 1 : 0) - (this.input.held('lean.left') ? 1 : 0) : (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + this.opts.hud.lean), -1, 1);
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
    this.opts.hideStallion(st);
    // the one-horse rule: Argymaq replaces the Tulpar you had — he leaves the rail for good
    const old = this.tulpar;
    if (old !== null) {
      m.removeMountable(old);
      this.opts.retireBonded(old);
      this.tulpar = null;
    }
    const t = this.spawnTulpar(x, z, yaw, argymaq);
    m.mount(t);
    this.opts.bond.write(argymaq ? ARGYMAQ_KIND : '1');
    this.opts.toast?.(argymaq
      ? 'ARGYMAQ is yours — he takes Tulpar\'s place at the camp\'s rail · whistle (X / HORSE) to call him'
      : 'TULPAR is yours · he waits at the camp\'s hitching rail · whistle (X / HORSE) to call him');
    this.onBonded?.(t);
  }

  private spawnTulpar(x: number, z: number, yaw: number, argymaq = false): A {
    const t = this.opts.spawnBonded(x, z, yaw, argymaq);
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
