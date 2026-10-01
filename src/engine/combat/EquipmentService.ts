import type { Vector3 } from 'three';
import { Scope } from '../app/scope';
import type { WeaponId, ToolId } from './Equipment';
import type { Weapon, WeaponHooks, WeaponState, AimInfo } from './Weapon';
import { Tool } from './Tool';
import { EquipmentDomInput, type EquipmentInput } from '../input/equipmentInput';
import type { Events } from '../events/events';
import type { EquipmentPickup, EquipmentPickupHost, PickupLoadout } from './EquipmentPickup';

const SWAP_TIME = 0.25, STOW_TIME = 0.25;

export class EquipmentService implements WeaponHooks {
  readonly list: Weapon[];
  current: Weapon;
  onFire?: (() => void) | undefined; onHit?: Weapon['onHit']; onImpact?: Weapon['onImpact']; onReloadStart?: (() => void) | undefined; onReloadEnd?: (() => void) | undefined; onDry?: (() => void) | undefined;
  /** a swap started (play the sling rustle) */
  onSwap?: ((to: WeaponId) => void) | undefined;
  /** a weapon was unlocked (the touch layer shows its SWAP pill) */
  onUnlock?: ((id: WeaponId | ToolId) => void) | undefined;
  private unlocked = new Set<WeaponId | ToolId>();
  private _enabled = true;
  private _adsHeld = false;
  private _altHeld = false;
  private _visible = true;
  private _stowed = false; private stowT = 0;
  private order: WeaponId[] | undefined;
  private swapping: { from: Weapon; to: Weapon; t: number; switched: boolean } | null = null;
  private readonly pickups = new Map<string, EquipmentPickup>();

  /** Place the active level's declarations using its installed equipment rows. */
  placePickups(loadout: PickupLoadout, host: EquipmentPickupHost): void {
    for (const declaration of loadout.pickups ?? []) {
      if (this.scope.disposed) throw new Error('Cannot place pickups on disposed equipment');
      if (this.pickups.has(declaration.id)) throw new Error(`Duplicate equipment pickup ${declaration.id}`);
      const weapon = this.list.find((item) => item.row.id === declaration.id);
      if (weapon === undefined) throw new Error(`Pickup equipment ${declaration.id} is not installed`);
      const row = weapon.row, spec = row.pickup;
      if (spec === undefined) throw new Error(`Equipment ${row.id} has no pickup factory`);
      const pickup = spec.create(declaration.at, spec.prompt);
      if (pickup === null) {
        // Saved ownership/harness selection never depended on a display site in the original shell.
        if (host.owned.has(spec.owned) || host.hold === row.id) { this.unlock(weapon.id); this.select(weapon.id, true); }
        continue;
      }
      this.pickups.set(row.id, pickup);
      host.prompts.push(pickup.interactable);
      const stop = this.scope.child(`pickup:${row.id}`);
      let live = true, granted = false;
      stop.onDispose(() => {
        live = false;
        pickup.onPickup = undefined; pickup.onNear = undefined;
        const at = host.prompts.indexOf(pickup.interactable);
        if (at !== -1) host.prompts.splice(at, 1);
        this.pickups.delete(row.id);
        pickup.dispose();
      });
      pickup.onNear = (inside) => { if (live) host.onNear(inside); };
      pickup.onPickup = () => {
        if (!live || granted) return;
        granted = true;
        host.owned.grant(spec.owned);
        this.unlock(weapon.id); this.select(weapon.id);
        host.onPickup(row, spec.toast);
      };
      // Build then hide, as the original saved/harness path did: retained pooled lights and RNG draws stay identical.
      if (host.owned.has(spec.owned) || host.hold === row.id) {
        granted = true;
        this.unlock(weapon.id); this.select(weapon.id, true);
        pickup.dispose();
      }
    }
  }

  pickup(id: string): EquipmentPickup | null { return this.pickups.get(id) ?? null; }
  updatePickups(dt: number, t: number): void { for (const pickup of this.pickups.values()) pickup.update(dt, t); }

  readonly tools: Tool[] = [];
  private readonly scope: Scope;
  readonly events: Events | undefined;
  constructor(first: Weapon, opts: { scope?: Scope; events?: Events; input?: EquipmentInput; order?: WeaponId[] } = {}) {
    this.scope = opts.scope?.child('equipment') ?? new Scope('equipment');
    this.events = opts.events;
    this.list = []; this.current = first; this.order = opts.order;
    this.add(first, { locked: false });
    const input = opts.input ?? new EquipmentDomInput(this.scope, () => this.current.inputAllowed());
    input.bind('swap', () => this.swap(), this.scope);
    input.bind('swap.next', () => this.step(1), this.scope);
    input.bind('swap.prev', () => this.step(-1), this.scope);
    for (const digit of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) input.bind(`swap.slot.${digit}`, () => {
      const w = this.available[digit - 1]; if (w) this.select(w.id);
    }, this.scope);
  }
  private wire(w: Weapon): void {
    // Compatibility callbacks keep existing source clocks; each boundary publishes once for new subscribers.
    w.onFire = () => { this.events?.emit('weapon.fired', { id: w.row.id }); this.onFire?.(); };
    w.onHit = (kind, headshot, killed) => { this.events?.emit('weapon.hit', { id: w.row.id, kind, headshot, killed }); this.onHit?.(kind, headshot, killed); };
    w.onImpact = (surface, point) => { this.events?.emit('weapon.impact', { id: w.row.id, surface, point: point.clone() }); this.onImpact?.(surface, point); };
    w.onReloadStart = () => { this.events?.emit('weapon.reload', { id: w.row.id, phase: 'start' }); this.onReloadStart?.(); };
    w.onReloadEnd = () => { this.events?.emit('weapon.reload', { id: w.row.id, phase: 'end' }); this.onReloadEnd?.(); };
    w.onDry = () => { this.events?.emit('weapon.dry', { id: w.row.id }); this.onDry?.(); };
  }
  add(w: Weapon | Tool, opts: { locked: boolean; order?: number }): void {
    if ([...this.list, ...this.tools].some((item) => item.row.id === w.row.id)) throw new Error(`Duplicate equipment ${w.row.id}`);
    w.install({ scope: this.scope.child(w.row.id), ...(this.events === undefined ? {} : { events: this.events }) });
    if (w instanceof Tool) this.tools.push(w);
    else {
      this.wire(w);
      if (opts.order === undefined) this.list.push(w); else this.list.splice(opts.order, 0, w);
      w.setActive(w === this.current); this.apply();
    }
    if (!opts.locked) this.unlocked.add(w.id);
    this.apply();
  }
  replace(id: WeaponId, next: Weapon): void {
    const previous = this.get(id), index = this.list.indexOf(previous);
    if (next.id !== id) throw new Error(`Replacement must preserve legacy slot ${id}`);
    next.state.ammo = previous.state.ammo;
    next.state.reserve = previous.state.reserve;
    next.state.loaded = previous.state.loaded;
    next.state.reloading = previous.state.reloading;
    next.state.reloadProgress = previous.state.reloadProgress;
    next.state.ads = previous.state.ads;
    next.holster = previous.holster;
    next.install({ scope: this.scope.child(next.row.id), ...(this.events === undefined ? {} : { events: this.events }) }); this.wire(next);
    this.list[index] = next;
    if (this.current === previous) this.current = next;
    if (this.swapping?.from === previous) this.swapping.from = next;
    if (this.swapping?.to === previous) this.swapping.to = next;
    previous.setActive(false); previous.dispose();
    next.setActive(next === this.current); next.model.visible = next === this.current && this._visible;
    this.apply(); this.onUnlock?.(id);
  }
  dispose(): void { this.scope.dispose(); }

  /** input on the held weapon (menu / pause → false) */
  get enabled(): boolean { return this._enabled; }
  set enabled(on: boolean) { this._enabled = on; this.apply(); }
  setEnabled(on: boolean): void { this.enabled = on; }
  /** the held weapon's viewmodel (hidden under the main menu) */
  get visible(): boolean { return this._visible; }
  set visible(on: boolean) { this._visible = on; this.current.model.visible = on; }
  /** the touch AIM latch — survives a swap (the incoming weapon comes up sighted) */
  get adsHeld(): boolean { return this._adsHeld; }
  set adsHeld(on: boolean) { this._adsHeld = on; this.apply(); }
  get swappingNow(): boolean { return this.swapping !== null; }
  /** lowered out of the frame, input off (a dialogue is open — E129); false raises it again */
  get stowed(): boolean { return this._stowed; }
  set stowed(on: boolean) { this._stowed = on; this.apply(); }
  /** The held secondary action is released during a swap. */
  get altHeld(): boolean { return this._altHeld; }
  set altHeld(on: boolean) { this._altHeld = on; this.apply(); }

  private apply(): void {
    for (const w of this.list) {
      const held = w === this.current && this.swapping === null;
      w.enabled = this._enabled && held && !this._stowed;
      w.adsHeld = held && this._adsHeld;
      w.altHeld = held && this._altHeld;
    }
    for (const tool of this.tools) tool.enabled = this._enabled && this.has(tool.id);
  }

  get(id: WeaponId): Weapon {
    const w = this.list.find((k) => k.id === id);
    if (w === undefined) throw new Error(`EquipmentService: no weapon '${id}' in the kit`);
    return w;
  }
  /** Is this slot owned? */
  has(id: WeaponId | ToolId): boolean { return this.unlocked.has(id); }
  /** the unlocked weapons, in kit order */
  get available(): Weapon[] {
    const list = this.list.filter((w) => this.unlocked.has(w.id));
    const order = this.order;
    if (order === undefined) return list;
    const rank = (id: WeaponId) => { const i = order.indexOf(id); return i === -1 ? order.length : i; };
    return list.sort((a, b) => rank(a.id) - rank(b.id));
  }
  unlock(id: WeaponId | ToolId): void {
    if (this.unlocked.has(id) || !([...this.list, ...this.tools].some((w) => w.id === id))) return; // absent slots remain absent
    this.unlocked.add(id);
    this.apply();
    const item = [...this.list, ...this.tools].find((w) => w.id === id);
    if (item !== undefined) this.events?.emit('weapon.unlocked', { id: item.row.id });
    this.onUnlock?.(id);
  }
  /** what the player owned before the practice room lent the whole kit (null = no loan running) */
  private loaned: Set<WeaponId | ToolId> | null = null;
  /** the practice room lends every weapon of the kit (E298 A, the weapon explorer); `endLoan` puts back what was owned */
  lendAll(): void {
    if (this.loaned !== null) return;
    this.loaned = new Set(this.unlocked);
    for (const w of [...this.list, ...this.tools]) this.unlock(w.id);
  }
  endLoan(): void {
    const owned = this.loaned;
    if (owned === null) return;
    this.loaned = null;
    this.unlocked = owned;
    this.apply();
    const first = this.list.find((w) => owned.has(w.id));
    if (!owned.has(this.current.id) && first !== undefined) this.select(first.id, true);
    this.onUnlock?.(this.current.id); // the SWAP pill / the strip re-read what is owned
  }
  /** hold `id` (if unlocked); animated unless `instant` (start-up `?weapon=`) */
  select(id: WeaponId, instant = false): void {
    if (!this.unlocked.has(id)) return;
    const to = this.get(id);
    if (to === this.current && this.swapping === null) return;
    if (this.swapping !== null) { if (this.swapping.to === to) return; this.finishSwap(); if (to === this.current) return; }
    if (instant) {
      this.current.setActive(false); this.current.holster = 0;
      this.current = to; to.holster = 0; to.setActive(true); to.model.visible = this._visible;
      this.apply();
      return;
    }
    this.swapping = { from: this.current, to, t: 0, switched: false };
    this.apply();
    this.events?.emit('weapon.swap', { to: to.row.id });
    this.onSwap?.(id);
  }
  /** Select the next owned slot, if there is one. */
  swap(): void { this.step(1); }
  /** the owned weapon `dir` slots away from the held one, wrapping (the ring's tap, Q, the mouse wheel) */
  step(dir: 1 | -1): void {
    const list = this.available;
    if (list.length < 2) return;
    const i = list.indexOf(this.current);
    const next = list[(i + dir + list.length) % list.length];
    if (next !== undefined) this.select(next.id);
  }
  private finishSwap(): void {
    const s = this.swapping;
    if (s === null) return;
    s.from.holster = 0; s.to.holster = 0;
    if (!s.switched) { s.from.setActive(false); this.current = s.to; s.to.setActive(true); s.to.model.visible = this._visible; }
    this.swapping = null;
    this.apply();
  }

  tryFire(): void { this.current.tryFire(); }
  reload(): void { this.current.reload(); }
  aimRay(o: Vector3, d: Vector3): Vector3 { return this.current.aimRay(o, d); }
  get aimInfo(): AimInfo | null { return this.current.aimInfo; }
  get state(): WeaponState { return this.current.state; }
  /** the HELD weapon's melee reach (m from the eye), undefined while a ranged weapon is out — Combat's MISS judgement reads it per swing */
  get reach(): number | undefined { return this.current.reach; }

  update(dt: number, t: number): void {
    const s = this.swapping;
    if (s !== null) {
      s.t += dt;
      if (s.t < SWAP_TIME) s.from.holster = s.t / SWAP_TIME;
      else {
        if (!s.switched) { s.switched = true; s.from.holster = 1; s.from.setActive(false); this.current = s.to; s.to.holster = 1; s.to.setActive(true); s.to.model.visible = this._visible; }
        s.to.holster = Math.max(0, 1 - (s.t - SWAP_TIME) / SWAP_TIME);
        if (s.t >= SWAP_TIME * 2) this.finishSwap();
      }
    }
    this.stowT = Math.min(1, Math.max(0, this.stowT + (this._stowed ? dt : -dt) / STOW_TIME));
    if (this.swapping === null) this.current.holster = this.stowT;
    for (const w of this.list) w.update(dt, t);
    for (const tool of this.tools) if (this.has(tool.id)) tool.update(dt, t);
  }
}

export type { WeaponId } from './Equipment';
export type { WeaponState, AimInfo } from './Weapon';
