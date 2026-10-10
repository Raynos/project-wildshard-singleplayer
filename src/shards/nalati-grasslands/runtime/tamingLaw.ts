import * as THREE from 'three';
import * as v from 'valibot';

/** A live horse identity; rendering and native collision ownership stay with the caller. */
export interface TamingHorse {
  readonly entityId: string; kind: string; scale: number; alive: boolean; yaw: number;
  readonly position: THREE.Vector3; readonly mem: Record<string, number>;
  readonly headWorld: (out: THREE.Vector3) => THREE.Vector3; readonly setMotion: (yaw: number, speed: number, rate: number) => void;
}
/** The actual shipping herd's trust, alert, stallion and driven-away laws. */
export interface TamingHerd<A extends TamingHorse> {
  readonly stallion: A | null; stallionState: string; cx: number; cz: number; trust: number; alert: number; alertOwned: boolean; mode: string;
  readonly addTrust: (value: number) => void; readonly leadAway: (x: number, z: number) => void; readonly releaseStallion: () => void;
}
/** The shipping taming HUD values are observations of the law, never decisions. */
export interface TamingObservation { trust: number | null; alert: number; ear: THREE.Vector3 | null; round: number | null; balance: number; danger: boolean; offer: boolean }
/** Only Nalati's own page/native adapters supply the horse, rider, camera observations and random draws. */
export interface NalatiTamingPorts<A extends TamingHorse, H extends TamingHerd<A>> {
  readonly bond: { readonly read: () => string | null; readonly write: (value: string) => void };
  readonly player: { readonly position: THREE.Vector3; crouching: boolean; yaw: number; pitch: number; readonly keys: ReadonlySet<string>;
    readonly camera: { readonly position: THREE.Vector3; readonly getWorldDirection: (out: THREE.Vector3) => THREE.Vector3 } };
  readonly mount: { readonly mounted: boolean; readonly horse: A | null; breakShake: number; breakRoll: number;
    readonly mount: (horse: A, breaking?: boolean) => boolean; readonly dismount: (thrown?: boolean) => void; readonly addMountable: (horse: A, name: string) => void; readonly removeMountable: (horse: A) => void };
  readonly hud: { readonly offer: boolean; readonly lean: number };
  readonly herds: () => readonly H[]; readonly rest: { x: number; z: number; face: { x: number; z: number } };
  readonly wind: () => { x: number; z: number; strength: number }; readonly random: () => number;
  readonly spawnBonded: (x: number, z: number, yaw: number, argymaq: boolean) => A; readonly hideStallion: (horse: A) => void; readonly retireBonded: (horse: A) => void;
  readonly hurt: (damage: number) => void; readonly toast?: (text: string) => void;
}
interface Move { kind: 'buck' | 'spin' | 'rear'; dir: number; at: number; power: number }

const HERD_MAX = 8, MOVE_MAX = 8;
const RANGE = 40, ROUNDS = 5, ROUND_T = 3.5, TELEGRAPH = 0.3;
const LEAN_ACC = 6.2, DAMP = 2.4, RED = 0.72, THROW_T = 0.4;
/** the elite stallion's kind (src/shards/nalati-grasslands/elites.ts ARGYMAQ) — the one horse that may replace a bonded Tulpar */
const ARGYMAQ_KIND = 'argymaq';
const _v = new THREE.Vector3(), _f = new THREE.Vector3();

const finite = v.pipe(v.number(), v.finite());
const triple = v.tuple([finite, finite, finite]);
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const SavedMove = v.strictObject({ kind: v.picklist(['buck', 'spin', 'rear']), dir: v.picklist([-1, 1]), at: finite, power: finite });
const SavedTaming = v.strictObject({ version: v.literal(1), phase: v.picklist(['wild', 'breaking', 'bonded']),
  tulpar: v.nullable(id), argymaq: v.boolean(), herd: v.nullable(v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(7))),
  stallion: v.nullable(id), beaten: v.pipe(v.array(id), v.maxLength(64)),
  drove: v.pipe(v.array(v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(7))), v.maxLength(8)),
  lookT: finite, prev: triple, speed: finite, init: v.boolean(), round: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(6)),
  roundT: finite, b: finite, bv: finite, redT: finite, spinF: finite, spinT: finite,
  moves: v.pipe(v.array(SavedMove), v.maxLength(MOVE_MAX)), ear: triple,
  prompt: v.strictObject({ at: triple, radius: finite, label: v.string() }),
  view: v.strictObject({ trust: v.nullable(finite), alert: finite, ear: v.boolean(), round: v.nullable(finite), balance: finite, danger: v.boolean(), offer: v.boolean() }) });

/** The shipping approach, five bucking rounds and one-horse bond law, shared by Nalati's page and native host.
 * Crouch slowly and offer beside the live herd: its existing trust/alert controls the MOUNT prompt.
 * Five 3.5-second rounds show buck/spin/rear tells before the impulse; lean opposes the public balance gauge.
 * Being thrown costs ten health and forty trust. Winning hides the original living stallion and adopts a saddled Tulpar.
 * Only Argymaq can replace that bond, once; the old Tulpar is retired, rather than parked as a dormant actor.
 * The adapters own camera observations, native riding, rendering, storage and random draws. This law owns only taming.
 */
export class NalatiTamingLaw<A extends TamingHorse, H extends TamingHerd<A>> {
  phase: 'wild' | 'breaking' | 'bonded' = 'wild';
  /** your bonded horse */
  tulpar: A | null = null;
  /** the bonded horse is Argymaq (the elite) — the best horse; nothing replaces him */
  isArgymaq = false;
  /** the MOUNT prompt on the stallion (radius 0 until he lets you) */
  readonly interactable: { readonly position: THREE.Vector3; radius: number; label: string; onInteract: () => void } = { position: new THREE.Vector3(0, -1e4, 0), radius: 0, label: 'Mount the stallion', onInteract: () => { this.startBreaking(); } };
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
  private readonly moves: Move[] = Array.from({ length: MOVE_MAX }, () => ({ kind: 'buck', dir: 1, at: 0, power: 1 }));
  private moveCount = 0;
  private readonly invalidHerds = new Error('Nalati taming herd bound exceeded');
  private readonly missingMove = new Error('Missing Nalati bucking move');
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
    const herds = this.opts.herds(); if (herds.length > HERD_MAX) throw this.invalidHerds;
    for (let i = 0; i < HERD_MAX; i++) { const h = herds[i]; if (h === undefined) break; if (!this.drove.has(h) && Math.hypot(h.cx - x, h.cz - z) < 40 && this.opts.player.position.distanceTo(_v.set(h.cx, this.opts.player.position.y, h.cz)) < 60) {
      this.drove.add(h); h.addTrust(30); this.opts.toast?.('The herd saw you drive the wolves off · TRUST +30');
    } }
  }

  /** an arrow / javelin landed at (x, z): −30 TRUST and ALERT full if a stallion is within 40 m */
  noteShot(x: number, z: number): void {
    const herds = this.opts.herds(); if (herds.length > HERD_MAX) throw this.invalidHerds;
    for (let i = 0; i < HERD_MAX; i++) { const h = herds[i]; if (h === undefined) break;
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
    const herds = this.opts.herds(); if (herds.length > HERD_MAX) throw this.invalidHerds;
    for (let i = 0; i < HERD_MAX; i++) { const h = herds[i]; if (h === undefined) break;
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

  /** The currently selected real stallion owns this live prompt's native sight identity. */
  get promptHorse(): A | null { return this.stallion; }

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
    this.moveCount = 0;
    let t = 0.55;
    for (let i = 0; i < MOVE_MAX; i++) {
      if (t >= ROUND_T - 0.4) break;
      const r = this.opts.random();
      const kind: Move['kind'] = r < 0.5 ? 'buck' : r < 0.78 ? 'spin' : 'rear';
      const move = this.moves[i]; if (move === undefined) throw this.missingMove;
      move.kind = kind; move.dir = this.opts.random() < 0.5 ? -1 : 1; move.at = t; move.power = k; this.moveCount++;
      t += (kind === 'spin' ? 1.25 : 0.95) * (1.08 - 0.07 * this.round) + this.opts.random() * 0.3;
    }
    if (t < ROUND_T - 0.4) throw this.missingMove;
  }

  private updateBreaking(dt: number): void {
    const m = this.opts.mount, st = this.stallion, p = this.opts.player;
    if (st === null || m.horse !== st) { this.endBreaking(false); return; }
    this.roundT += dt;
    // telegraph (0.3 s ahead) and fire the moves
    let force = 0;
    for (let i = 0; i < MOVE_MAX; i++) {
      if (i >= this.moveCount) break; const mv = this.moves[i]; if (mv === undefined) throw this.missingMove;
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

  /** Capture all approach and bucking clocks, identities and observations without consuming random draws. */
  snapshot(): string {
    const herds = this.opts.herds();
    if (herds.length > HERD_MAX) throw this.invalidHerds;
    return JSON.stringify({ version: 1, phase: this.phase, tulpar: this.tulpar?.entityId ?? null, argymaq: this.isArgymaq,
      herd: this.herd === null ? null : herds.indexOf(this.herd), stallion: this.stallion?.entityId ?? null,
      beaten: [...this.beaten].map(a => a.entityId), drove: [...this.drove].map(h => herds.indexOf(h)),
      lookT: this.lookT, prev: this.prev.toArray(), speed: this.speed, init: this.init,
      round: this.round, roundT: this.roundT, b: this.b, bv: this.bv, redT: this.redT, spinF: this.spinF, spinT: this.spinT,
      moves: this.moves.slice(0, this.moveCount).map(m => ({ kind: m.kind, dir: m.dir, at: m.at, power: m.power })), ear: this.ear.toArray(),
      prompt: { at: this.interactable.position.toArray(), radius: this.interactable.radius, label: this.interactable.label },
      view: { ...this.view, ear: this.view.ear !== null } });
  }

  /** Quietly reconnect a validated continuation to this owner's actual herd and horse objects; no spawn or callback. */
  restore(wire: string, horses: readonly A[]): void {
    if (wire.length > 65536) throw new Error('Nalati taming wire exceeds its bound');
    const saved = v.parse(SavedTaming, JSON.parse(wire)), herds = this.opts.herds();
    if (herds.length > HERD_MAX || horses.length > 64 || new Set(horses.map(a => a.entityId)).size !== horses.length
      || new Set(saved.beaten).size !== saved.beaten.length || new Set(saved.drove).size !== saved.drove.length) throw new Error('Invalid Nalati taming roster');
    const byId = new Map(horses.map(a => [a.entityId, a]));
    const horse = (identity: string | null): A | null => {
      if (identity === null) return null;
      const a = byId.get(identity); if (a === undefined) throw new Error('Foreign Nalati taming horse'); return a;
    };
    const herd = saved.herd === null ? null : herds[saved.herd];
    const st = horse(saved.stallion), tulpar = horse(saved.tulpar), beaten = saved.beaten.map(horse);
    const drove = saved.drove.map(i => { const h = herds[i]; if (h === undefined) throw new Error('Foreign Nalati taming herd'); return h; });
    if (herd === undefined || (saved.phase === 'breaking' && (herd === null || st === null || this.opts.mount.horse !== st
        || saved.round < 1 || saved.round > ROUNDS || saved.moves.length === 0))
      || (saved.phase === 'bonded' && tulpar === null) || (saved.argymaq && tulpar === null)
      || Math.abs(saved.b) > 1.2 || saved.prompt.radius < 0 || saved.prompt.radius > 3.6
      || saved.moves.some(m => m.at < 0.55 || m.at >= ROUND_T - 0.4 || m.power <= 0)
      || saved.moves.some((m, i) => i > 0 && m.at <= (saved.moves[i - 1]?.at ?? Infinity))) throw new Error('Invalid Nalati taming continuation');
    this.phase = saved.phase; this.tulpar = tulpar; this.isArgymaq = saved.argymaq; this.herd = herd; this.stallion = st;
    this.beaten.clear(); beaten.forEach(a => { if (a !== null) this.beaten.add(a); }); this.drove.clear(); drove.forEach(h => { this.drove.add(h); });
    this.lookT = saved.lookT; this.prev.fromArray(saved.prev); this.speed = saved.speed; this.init = saved.init;
    this.round = saved.round; this.roundT = saved.roundT; this.b = saved.b; this.bv = saved.bv; this.redT = saved.redT;
    this.spinF = saved.spinF; this.spinT = saved.spinT; this.moveCount = saved.moves.length;
    saved.moves.forEach((m, i) => { const move = this.moves[i]; if (move !== undefined) Object.assign(move, m); });
    this.ear.fromArray(saved.ear); this.interactable.position.fromArray(saved.prompt.at);
    this.interactable.radius = saved.prompt.radius; this.interactable.label = saved.prompt.label;
    Object.assign(this.view, saved.view, { ear: saved.view.ear ? this.ear : null });
  }

  /** debugging / the harness: jump straight to the bucking rounds on the nearest stallion */
  forceBreak(): void {
    const h = this.herd, st = this.stallion;
    if (h === null || st === null) return;
    h.addTrust(100);
    this.startBreaking();
  }
}
