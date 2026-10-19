import * as THREE from 'three';
import * as v from 'valibot';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import type { TamingHorse, TamingHerd, TamingObservation, NalatiTamingPorts } from './tamingBindings';

const finite = v.pipe(v.number(), v.finite());
const triple = v.tuple([finite, finite, finite]);
const Saved = v.strictObject({ version: v.literal(2), phase: v.picklist(['wild', 'breaking', 'bonded']),
  tulpar: v.nullable(v.string()), argymaq: v.boolean(), herd: v.nullable(v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(7))),
  stallion: v.nullable(v.string()), drove: v.pipe(v.array(v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(7))), v.maxLength(8)),
  state: v.record(v.string(), finite), clock: v.pipe(finite, v.minValue(0), v.maxValue(.1)), prev: v.nullable(triple) });
const direction = new THREE.Vector3(), toward = new THREE.Vector3();

/** Native identities and effects around Nalati's admitted approach and bucking programs. */
export class NalatiTamingLaw<A extends TamingHorse, H extends TamingHerd<A>> {
  phase: 'wild' | 'breaking' | 'bonded' = 'wild';
  tulpar: A | null = null;
  isArgymaq = false;
  readonly interactable = { position: new THREE.Vector3(0, -1e4, 0), radius: 0, label: 'Mount the stallion', onInteract: (): void => { this.startBreaking(); } };
  readonly view: TamingObservation = { trust: null, alert: 0, ear: null, round: null, balance: 0, danger: false, offer: false };
  onBonded?: ((horse: A) => void) | undefined;
  onBreaking?: ((on: boolean) => void) | undefined;
  input: { readonly held: (action: 'ride.offer' | 'lean.right' | 'lean.left') => boolean } | null = null;
  private herd: H | null = null;
  private stallion: A | null = null;
  private readonly drove = new Set<H>();
  private readonly ear = new THREE.Vector3();
  private readonly prev = new THREE.Vector3();
  private initialized = false;
  private readonly observed: Record<string, number> = {};
  private readonly candidates = Array.from({ length: 8 }, () => ({ x: 0, y: 0, z: 0, alive: 0, argymaq: 0 }));
  private readonly stateKeys: readonly string[];
  private readonly invalidHerds = new Error('Nalati taming herd bound exceeded');
  private clock = 0;
  private state: Record<string, number>;
  private readonly approach: ReturnProgram;
  private readonly breaking: ReturnProgram;
  constructor(private readonly opts: NalatiTamingPorts<A, H>) {
    this.approach = ReturnProgram.page(opts.programs.approach); this.breaking = ReturnProgram.page(opts.programs.breaking);
    this.state = v.parse(v.record(v.string(), finite), { ...opts.programs.initial });
    this.stateKeys = Object.keys(opts.programs.initial);
    if (this.stateKeys.length > 32) throw this.invalidHerds;
    let saved: string | null = null;
    try { saved = opts.bond.read(); } catch { /* unavailable storage */ }
    if (saved === '1' || saved === 'argymaq') this.spawnTulpar(opts.rest.x + 2.6, opts.rest.z + 3.5, Math.atan2(opts.rest.face.x, opts.rest.face.z), saved === 'argymaq');
  }
  private roster(): readonly H[] { const rows = this.opts.herds(); if (rows.length > 8) throw this.invalidHerds; return rows; }
  noteEvent(name: string, x: number, z: number): void { if (name === 'pack-driven-off' || name === 'pack-break') this.event(x, z, false); }
  noteShot(x: number, z: number): void { this.event(x, z, true); }
  private event(x: number, z: number, shot: boolean): void {
    const herds = this.roster();
    for (let i = 0; i < 8; i++) {
      const h = herds[i]; if (h === undefined) break;
      if ((!shot && this.drove.has(h)) || (shot && h.stallion === null)) continue;
      const p = shot ? h.stallion?.position : { x: h.cx, z: h.cz }; if (p === undefined) continue;
      const row = this.approach.project('event', { x, z, cx: p.x, cz: p.z, px: this.opts.player.position.x, pz: this.opts.player.position.z, shot: Number(shot), alert: h.alert });
      h.addTrust(row['trust'] ?? 0); h.alert = row['alert'] ?? h.alert;
      if (!shot && (row['trust'] ?? 0) > 0) { this.drove.add(h); this.opts.toast?.('The herd saw you drive the wolves off · TRUST +30'); }
    }
  }
  update(dt: number): void {
    // Bucking is fixed-step physics; only the approach decision is periodic.
    if (this.phase === 'breaking') { this.updateBreaking(dt); return; }
    this.clock += dt; if (this.clock + 1e-9 < .1) return;
    const elapsed = this.clock; this.clock = 0;
    const p = this.opts.player, pos = p.position;
    this.state['speed'] = !this.initialized ? 0 : (this.state['speed'] ?? 0) + (Math.hypot(pos.x - this.prev.x, pos.z - this.prev.z) / elapsed - (this.state['speed'] ?? 0)) * Math.min(1, elapsed * 6);
    this.prev.copy(pos); this.initialized = true;
    const herds = this.roster(), obs = this.observed;
    for (let i = 0; i < 8; i++) {
      const h = herds[i], candidate = this.candidates[i]; if (candidate === undefined) break;
      candidate.x = h?.stallion?.position.x ?? 0; candidate.y = h?.stallion?.position.y ?? 0; candidate.z = h?.stallion?.position.z ?? 0;
      candidate.alive = Number(h?.stallion?.alive === true); candidate.argymaq = Number(h?.stallion?.kind === 'argymaq');
    }
    obs['count'] = herds.length; obs['px'] = pos.x; obs['py'] = pos.y; obs['pz'] = pos.z; obs['bonded'] = Number(this.tulpar !== null); obs['argymaq'] = Number(this.isArgymaq);
    const selected = this.approach.project('select', obs, undefined, this.candidates);
    const herd = herds[selected['index'] ?? -1] ?? null, st = herd?.stallion ?? null;
    if (this.herd !== null && this.herd !== herd) this.herd.alertOwned = false;
    this.herd = herd; this.stallion = st; this.interactable.radius = 0;
    this.view.round = null; this.view.danger = false; this.view.trust = null; this.view.ear = null; this.view.offer = false;
    if (herd === null || st === null) return;
    if (selected['active'] === 0) { herd.alertOwned = false; herd.addTrust(-elapsed); return; }
    herd.alertOwned = true; st.headWorld(this.ear); p.camera.getWorldDirection(direction); toward.copy(this.ear).sub(p.camera.position).normalize();
    const wind = this.opts.wind(), tx = pos.x - st.position.x, tz = pos.z - st.position.z;
    obs['dt'] = elapsed; obs['distance'] = selected['distance'] ?? 41; obs['beaten'] = Number(herd.stallionState === 'beaten'); obs['mounted'] = Number(this.opts.mount.mounted); obs['speed'] = this.state['speed'] ?? 0;
    obs['scale'] = st.scale; obs['dot'] = direction.dot(toward); obs['lookT'] = this.state['lookT'] ?? 0; obs['offer'] = Number(this.input?.held('ride.offer') ?? this.opts.hud.offer); obs['alert'] = herd.alert; obs['trust'] = herd.trust;
    obs['crouched'] = Number(p.crouching); obs['downwind'] = (tx * wind.x + tz * wind.z) / (Math.hypot(tx, tz) || 1); obs['strength'] = wind.strength; obs['flee'] = Number(herd.mode === 'flee');
    const row = this.approach.project('approach', obs);
    this.state['lookT'] = row['lookT'] ?? 0; herd.addTrust(row['trust'] ?? 0); herd.alert = row['alert'] ?? herd.alert;
    if (row['lead'] === 1) herd.leadAway(pos.x, pos.z);
    this.interactable.position.copy(st.position); this.interactable.radius = row['radius'] ?? 0; this.interactable.label = herd.stallionState === 'beaten' ? 'Break the stallion' : 'Mount the stallion';
    this.ear.y += row['ear'] ?? 0; this.view.trust = herd.trust; this.view.alert = herd.alert; this.view.ear = this.ear; this.view.offer = row['offer'] === 1;
  }
  canTame(s: A): boolean { return this.approach.project('eligible', { bonded: Number(this.tulpar !== null), argymaq: Number(this.isArgymaq), horseArgymaq: Number(s.kind === 'argymaq') })['accept'] === 1; }
  get promptHorse(): A | null { return this.stallion; }
  startBreaking(): void {
    const st = this.stallion, h = this.herd;
    if (st === null || h === null || this.phase === 'breaking' || !this.canTame(st) || !this.opts.mount.mount(st, true)) return;
    this.phase = 'breaking'; this.interactable.radius = 0; h.alertOwned = true;
    this.opts.player.yaw = st.yaw - Math.PI; this.opts.player.pitch = -.1; this.onBreaking?.(true);
    this.state = { ...this.opts.programs.initial, ...this.breaking.project('start', { r0: this.opts.random(), r1: this.opts.random() }) }; this.clock = 0;
    this.opts.toast?.('HOLD ON — lean against him (A / D, LEAN L / LEAN R)');
  }
  private updateBreaking(dt: number): void {
    const m = this.opts.mount, st = this.stallion, p = this.opts.player;
    if (st === null || m.horse !== st) { this.endBreaking(false); return; }
    const lean = this.input ? Number(this.input.held('lean.right')) - Number(this.input.held('lean.left')) : Number(p.keys.has('KeyD')) - Number(p.keys.has('KeyA')) + this.opts.hud.lean;
    const obs = this.observed;
    for (let i = 0; i < 32; i++) { const key = this.stateKeys[i]; if (key === undefined) break; obs[key] = this.state[key] ?? 0; }
    obs['dt'] = dt; obs['lean'] = lean; obs['r0'] = this.opts.random(); obs['r1'] = this.opts.random(); obs['r2'] = this.opts.random();
    const row = this.breaking.project('step', obs);
    for (let i = 0; i < 32; i++) { const key = this.stateKeys[i]; if (key === undefined) break; const value = row[key]; if (value !== undefined) this.state[key] = value; }
    m.breakShake = row['shake'] ?? 0; m.breakRoll = row['roll'] ?? 0;
    st.mem['buck'] = row['buck'] ?? 0; st.mem['buckDir'] = this.state['dir'] ?? 1;
    if ((row['rear'] ?? -1) >= 0) st.mem['rear'] = row['rear'] ?? 0;
    if (row['kick'] === 1) st.mem['kick'] = 1; if (row['toss'] === 1) st.mem['toss'] = 1;
    const yaw = row['yaw'] ?? 0; if (yaw !== 0) { st.setMotion(st.yaw + Math.sign(yaw) * 2, 0, 3.2); st.yaw += yaw; }
    this.view.round = row['round'] ?? 1; this.view.balance = row['b'] ?? 0; this.view.danger = row['danger'] === 1; this.view.trust = null; this.view.ear = null;
    if ((row['outcome'] ?? 0) !== 0) this.endBreaking(row['outcome'] === 1);
  }
  private endBreaking(won: boolean): void {
    const m = this.opts.mount, st = this.stallion, h = this.herd;
    this.phase = this.tulpar === null ? 'wild' : 'bonded'; this.view.round = null; this.view.danger = false; m.breakRoll = 0; m.breakShake = 0; this.onBreaking?.(false);
    if (st === null || h === null) { if (m.mounted) m.dismount(true); return; }
    st.mem['buck'] = 0; st.mem['rear'] = 0;
    if (!won) { this.observed['won'] = 0; const loss = this.approach.project('finish', this.observed); m.dismount(true); this.opts.hurt(loss['damage'] ?? 0); h.addTrust(loss['trust'] ?? 0); h.leadAway(this.opts.player.position.x, this.opts.player.position.z); this.opts.toast?.('Thrown! TRUST −40 — find him again when the herd settles'); return; }
    const { x, z } = st.position, yaw = st.yaw, argymaq = st.kind === 'argymaq';
    m.dismount(); h.releaseStallion(); this.opts.hideStallion(st);
    if (this.tulpar !== null) { m.removeMountable(this.tulpar); this.opts.retireBonded(this.tulpar); this.tulpar = null; }
    const t = this.spawnTulpar(x, z, yaw, argymaq); m.mount(t); this.opts.bond.write(argymaq ? 'argymaq' : '1');
    this.opts.toast?.(argymaq ? 'ARGYMAQ is yours — he takes Tulpar\'s place at the camp\'s rail · whistle (X / HORSE) to call him' : 'TULPAR is yours · he waits at the camp\'s hitching rail · whistle (X / HORSE) to call him'); this.onBonded?.(t);
  }
  private spawnTulpar(x: number, z: number, yaw: number, argymaq: boolean): A {
    const t = this.opts.spawnBonded(x, z, yaw, argymaq); this.opts.mount.addMountable(t, argymaq ? 'Argymaq' : 'Tulpar');
    this.tulpar = t; this.isArgymaq = argymaq; this.phase = 'bonded'; return t;
  }
  snapshot(): string { const herds = this.roster(); return JSON.stringify({ version: 2, phase: this.phase, tulpar: this.tulpar?.entityId ?? null, argymaq: this.isArgymaq, herd: this.herd === null ? null : herds.indexOf(this.herd), stallion: this.stallion?.entityId ?? null, drove: [...this.drove].map(h => herds.indexOf(h)), state: this.state, clock: this.clock, prev: this.initialized ? this.prev.toArray() : null }); }
  restore(wire: string, horses: readonly A[]): void {
    if (wire.length > 65536 || horses.length > 64) throw new Error('Nalati taming continuation bound exceeded');
    const saved = v.parse(Saved, JSON.parse(wire)), herds = this.roster(), byId = new Map(horses.map(a => [a.entityId, a]));
    const resolve = (id: string | null): A | null => { if (id === null) return null; const a = byId.get(id); if (a === undefined) throw new Error('Foreign taming horse'); return a; };
    const h = saved.herd === null ? null : herds[saved.herd], st = resolve(saved.stallion), tulpar = resolve(saved.tulpar);
    const drove = saved.drove.map(i => { const a = herds[i]; if (a === undefined) throw new Error('Foreign taming herd'); return a; });
    if (h === undefined || byId.size !== horses.length || new Set(drove).size !== drove.length || Object.keys(saved.state).sort((a, b) => a.localeCompare(b)).join(',') !== Object.keys(this.opts.programs.initial).sort((a, b) => a.localeCompare(b)).join(',')
      || Math.abs(saved.state['b'] ?? 2) > 1.2 || (saved.state['round'] ?? 0) < 1 || (saved.state['round'] ?? 7) > 6
      || (saved.phase === 'breaking' && (h === null || st === null || this.opts.mount.horse !== st)) || ((saved.phase === 'bonded' || saved.argymaq) && tulpar === null)) throw new Error('Invalid taming continuation');
    this.phase = saved.phase; this.tulpar = tulpar; this.isArgymaq = saved.argymaq; this.herd = h; this.stallion = st; this.state = saved.state; this.clock = saved.clock; this.initialized = saved.prev !== null; if (saved.prev !== null) this.prev.fromArray(saved.prev);
    this.view.round = saved.phase === 'breaking' ? saved.state['round'] ?? 1 : null; this.view.balance = saved.state['b'] ?? 0;
    this.drove.clear(); drove.forEach(a => { this.drove.add(a); }); this.interactable.radius = 0;
  }
  forceBreak(): void { if (this.herd === null || this.stallion === null) return; this.herd.addTrust(100); this.startBreaking(); }
}
