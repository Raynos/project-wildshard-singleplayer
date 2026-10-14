import { bindMeleeContacts } from './simulation';
import { createClientChannelView, createClientScene, createHeldMeleeBinding, type ClientScene, type ClientScenePorts, type ClientGeometryKernels } from './ui';
import { type Object3D, Group, Mesh, BoxGeometry, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PointLight, Vector2, Vector3, MathUtils } from "three";
import { blocks } from "@wildshard/engine/blocks";
import type { ContactFamily, ContactScanTarget, ContactFamilyPorts, ContactWorldTarget } from "@wildshard/engine/combat/contactWeapon";
import { Weapon, type WeaponState, type AimInfo } from "@wildshard/engine/combat/Weapon";
import { Tool } from "@wildshard/engine/combat/Tool";
import type { EquipmentRow, EquipContext } from "@wildshard/engine/combat/Equipment";
import type { ItemFamily, ItemFamilyPorts } from "@wildshard/engine/combat/itemFamilies";
import type { ItemSpec } from "@wildshard/engine/combat/items";
import { buildSword } from "../systems/items/declaredSword";
import { parseWeaponHooks, type WeaponHooksData } from "@wildshard/format/weaponHooks";
import { ScriptHost, SCRIPT_PARAMETER_QUERY, type ScriptSnapshot } from "@wildshard/engine/script/host";
import { ScriptWorld, SCRIPT_OP, type EffectTransaction, type ScriptEffect } from "@wildshard/engine/script/effects";
import type { LevelContext } from "@wildshard/engine/level/context";
import { directorVariant } from "../shardfile/directorClient";

type App = LevelContext['app'];

// SF54: the private iron sword copy, deleted when these families graduate

/**
 * The share of a held item's flat colour that glows (E460). A declared shard's look need not light a camera-held item:
 * the template's neutral look has no environment and a dim sun, so a plain grey item's shade side rendered near black on
 * every renderer (its measure surfaces carry their own lift, families/measure.ts). At 0.5 the sunlit face reads as the
 * declared colour and the shade side a step darker.
 */
export const ITEM_VIEW_LIFT = 0.5;
/** A lit lantern shows a warm glowing band round its body, so the toggle shows by day (playtest round 3: LANTERN showed nothing). */
const LANTERN_LIT = 0xffc46a;
/** On a portrait screen a held item's view sits at most this share of the half-frame from the centre (its depth's). */
const IN_FRAME = 0.7;

/**
 * Keep a held item inside a portrait frame (playtest round 3, iPhone portrait: the lantern's view at x −0.3 sat off the left
 * edge and the whip's showed as a slab on the right one). Its declared x is pulled toward the centre until it lies within
 * IN_FRAME of the half-width the camera sees at its depth; landscape keeps the declared pose. The model's parent is the
 * camera's viewmodel root.
 */
function keepInFrame(model: Group, at: readonly [number, number, number]): void {
  const camera = model.parent?.parent;
  let x = at[0];
  if (camera instanceof PerspectiveCamera && camera.aspect < 1) {
    const half = Math.abs(at[2]) * Math.tan(MathUtils.degToRad(camera.fov) / 2) * camera.aspect * IN_FRAME;
    x = Math.sign(x) * Math.min(Math.abs(x), half);
  }
  if (model.position.x !== x) model.position.x = x;
}

function isGroup(value: unknown): value is Group { return value instanceof Group; }
function itemMesh(ports: ItemFamilyPorts): Group {
  if (ports.view.asset !== undefined) {
    if (!isGroup(ports.model)) throw new Error('Admitted equipment asset needs its loaded model');
    const model = ports.model.clone(true);
    model.position.set(...ports.view.position); model.rotation.set(...ports.view.rotation);
    ports.scope.onDispose(() => { model.removeFromParent(); });
    return model;
  }
  const recipe = ports.view.recipe;
  if (!['kit.whip', 'kit.sword', 'kit.lantern'].includes(recipe)) throw new Error(`Unresolved item view ${recipe}`);
  const model = new Group();
  const material = new MeshStandardMaterial({ color: ports.view.colour, flatShading: true, emissive: ports.view.colour, emissiveIntensity: ITEM_VIEW_LIFT });
  const sword = recipe === 'kit.sword' ? buildSword('iron') : null;
  const geometry = sword?.sword ?? (recipe === 'kit.whip' ? new CylinderGeometry(0.025, 0.04, 0.8, 6) : new BoxGeometry(0.12, 0.18, 0.12));
  sword?.arms.dispose(); model.add(new Mesh(geometry, material));
  model.position.set(...ports.view.position); model.rotation.set(...ports.view.rotation);
  ports.scope.onDispose(() => { model.removeFromParent(); geometry.dispose(); material.dispose(); });
  return model;
}
class DeclaredMelee extends Weapon {
  readonly model: Group;
  readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  holster = 0; enabled = true; aimInfo: AimInfo | null = null;
  private readonly ports: ItemFamilyPorts;
  private held = false;
  private readonly origin = new Vector3(); private readonly direction = new Vector3();
  get adsHeld(): boolean { return this.held; }
  set adsHeld(on: boolean) { this.held = this.enabled && on; this.ports.runtime.hold(this.held, this.ports.aim(), this.enabled); }
  constructor(row: EquipmentRow, _spec: Extract<ItemSpec, { kind: 'weapon' }>, ports: ItemFamilyPorts) {
    super(row); this.ports = ports; this.model = itemMesh(ports); this.setAimSource(ports.aim);
    ports.runtime.observe(ports.scope, (phase, contact) => {
      if (phase === 'fire') this.onFire?.();
      if (phase === 'hit' && contact !== undefined) this.onHit?.(contact.kind, contact.headshot, contact.killed);
    });
  }
  override install(ctx: EquipContext): void {
    super.install(ctx); ctx.scope.onDispose(() => { this.ports.scope.dispose(); });
    this.ports.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled);
    this.ports.input.bind('heavy', () => { this.ports.runtime.queue(2, this.ports.aim()); }, ctx.scope, () => this.enabled);
  }
  tryFire(): void {
    if (!this.enabled) return;
    this.aimRay(this.origin, this.direction); this.ports.runtime.queue(1, { origin: this.origin, direction: this.direction });
  }
  update(_dt: number, _t: number): void {
    this.model.visible = this.enabled || this.holster > 0;
    keepInFrame(this.model, this.ports.view.position);
  }
}
class DeclaredLantern extends Tool {
  readonly id: `tool.${string}`;
  readonly slot = 'offhand'; readonly actions: readonly NonNullable<Extract<ItemSpec, { kind: 'tool' }>['action']>[];
  readonly model: Group; readonly light: PointLight;
  private readonly flame: Mesh;
  holster = 0; enabled = true;
  private readonly ports: ItemFamilyPorts;
  private readonly spec: Extract<ItemSpec, { kind: 'tool' }>;
  constructor(row: EquipmentRow, spec: Extract<ItemSpec, { kind: 'tool' }>, ports: ItemFamilyPorts) {
    super(row);
    if (!row.id.startsWith('tool.')) throw new Error('Tool id required');
    if (spec.action === null) throw new Error('Declared lantern requires its toggle action');
    this.id = `tool.${row.id.slice(5)}`; this.actions = [spec.action]; this.spec = spec; this.ports = ports;
    this.model = itemMesh(ports);
    // the lit band: its own unlit material, shown only while the lantern burns (the body's material is never changed)
    const band = new BoxGeometry(0.13, 0.07, 0.13), glow = new MeshBasicMaterial({ color: LANTERN_LIT });
    this.flame = new Mesh(band, glow); this.flame.visible = false; this.model.add(this.flame);
    ports.scope.onDispose(() => { band.dispose(); glow.dispose(); });
    this.light = new PointLight(0xffe1aa, 0, 8); this.model.add(this.light);
    ports.scope.onDispose(() => { this.light.dispose(); });
    ports.runtime.observe(ports.scope, (phase) => { if (phase === 'light') this.equipEvents?.emit('tool.used', { id: row.id, phase: ports.runtime.lightOn ? 'on' : 'off' }); });
  }
  override install(ctx: EquipContext): void { super.install(ctx); ctx.scope.onDispose(() => { this.ports.scope.dispose(); }); }
  update(_dt: number, _t: number): void {
    const lit = this.ports.runtime.lightOn;
    this.light.intensity = lit ? this.spec.intensity : 0;
    this.flame.visible = lit;
    keepInFrame(this.model, this.ports.view.position);
  }
}
/** The view spring a held contact weapon's model sways on (`blocks.viewmodel`). */
export type HeldContactSpring = Parameters<typeof blocks.viewmodel>[0];
/**
 * A held contact weapon (SHARD-PLATFORM SF85): the chassis a trusted family's held weapon shares over its move rows
 * (`ContactFamily`). Attack swings light, Heavy swings heavy, and a still hold (touch) fills the charge ring over
 * `chargeSeconds` and its release swings heavy at once; the model sways on the view spring; contacts go through the
 * shared melee block. A family gives its rows' runtime (`moves`), its `swing` and its view in `update` (after `stepHeld`).
 */
export abstract class HeldContactWeapon<T extends ContactScanTarget = ContactScanTarget> extends Weapon {
  override readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  override holster = 0; override enabled = true; override adsHeld = false; override aimInfo: AimInfo | null = null;
  /** told of every swing's start (heavy or light) */
  onSwing: ((heavy: boolean) => void) | null = null;
  protected readonly app: App;
  protected readonly vm: ReturnType<typeof blocks.viewmodel>;
  protected readonly contact: ReturnType<typeof blocks.melee>;
  protected readonly spring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  protected get hold(): ContactFamily<T>['hold'] { return this.moves.hold; }
  protected chargeSeconds: number;
  /** the family's move rows at work */
  protected abstract readonly moves: ContactFamily<T>;
  private readonly releaseHold = (): void => { this.moves.cooldown = 0; this.swing(true); };
  constructor(app: App, row: EquipmentRow, spring: HeldContactSpring, chargeSeconds: number) {
    super(row); this.app = app; this.chargeSeconds = chargeSeconds;
    this.vm = blocks.viewmodel({ ...spring }); this.contact = blocks.melee(app.combat);
    this.blocks.vm = this.vm; this.blocks.melee = this.contact;
  }
  override get charge(): number { return Math.min(1, this.hold.elapsed / this.chargeSeconds); }
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled);
    this.app.input.bind('heavy', () => { this.swing(true); }, ctx.scope, () => this.enabled);
    ctx.scope.onDispose(() => { this.hold.reset(); });
  }
  override tryFire(): void { this.swing(false); }
  /** Starts a light or heavy swing when its cooldown and the weapon allow (false: refused). */
  abstract swing(heavy: boolean): boolean;
  /** This frame's aim from the eye (false: no equipment host). */
  protected aim(from: Vector3, dir: Vector3): boolean {
    const host = this.app.equipmentHost; if (host === null) return false;
    this.setAimSource(() => host.player.sampleAimCommand()); this.aimRay(from, dir); return true;
  }
  /** The cooldowns run down, the hold steps (its release swings heavy) and the view spring follows the turn. */
  protected stepHeld(dt: number): void {
    this.moves.cool(dt);
    this.hold.step(dt, this.enabled && this.holster <= 0.001, this.adsHeld, this.releaseHold);
    this.vm.step(this.spring, new Vector2(), dt);
  }
}

/** Register one trusted weapon family in the caller's session-local registry, without allocating a weapon or installing inputs.
 * The loader checks the shard namespace and every item before construction. Duplicate and reserved kit names refuse here. */
export function registerWeaponFamily(registry: Map<string, ItemFamily>, id: string, family: ItemFamily): void {
  if (typeof id !== 'string' || id.length > 128 || !/^[a-z][a-zA-Z0-9.-]*$/u.test(id) || !id.includes('.') || id.startsWith('kit.')) throw new Error('A trusted weapon family needs a bounded shard-local id');
  if (family.kind !== 'weapon') throw new Error('Weapon family registration requires a weapon constructor');
  if (registry.has(id)) throw new Error(`Duplicate weapon family ${id}`);
  registry.set(id, family);
}

/** Explicit built-in item family registry, injected into the full loader; importing does not install content. */
export function declaredKitItemFamilies(): ReadonlyMap<string, ItemFamily> {
  return new Map<string, ItemFamily>([
    ['kit.melee', { kind: 'weapon', create: (row, spec, ports) => new DeclaredMelee(row, spec, ports) }],
    ['kit.lantern', { kind: 'tool', create: (row, spec, ports) => new DeclaredLantern(row, spec, ports) }],
  ]);
}

/**
 * Weapon hooks (SHARD-PLATFORM SF36): the points where a weapon family asks a shard's admitted AssemblyScript for a number
 * instead of using its own row rule. A family holds `hooks: WeaponHooks | null` (null = the row rule, always the default)
 * and calls a hook where it computes the number; a hook that declines, fails or answers out of its declared bounds returns
 * null and the family's own rule applies, so a hook can never stop a weapon working.
 *
 * The hooks come from `@wildshard/game/shardfile/weaponHooks` (`WeaponHookLane.hooks(weaponId)`), which admits the module
 * through the same ScriptHost as the shard's director (fuel, memory, event and failure ceilings) and keeps every call a
 * pure function of its inputs.
 *
 *   // in the family, where the mounted pass computes its damage:
 *   this.damage = this.hooks?.damage({ phase: 'pass', base, facts: { speed, links } }) ?? rowRule;
 */

/** The family's moment: `pass` = a mounted pass slash's damage, set at the swing's input edge (the mounted sword). */
export type WeaponHookPhase = 'pass';
/** The phases in their wire order (the script reads phase `index + 1`). */
export const WEAPON_HOOK_PHASES: readonly WeaponHookPhase[] = ['pass'];

/** What the family tells a damage hook: its phase, the row's base damage and the numeric facts the declaration names. */
export interface WeaponDamageInput {
  readonly phase: WeaponHookPhase;
  readonly base: number;
  /** keyed by the declaration's fact keys; a missing or out-of-bounds fact declines the call */
  readonly facts: Readonly<Record<string, number>>;
}

/** One weapon's admitted hooks. */
export interface WeaponHooks {
  /** a bounded integer damage, or null for the family's own rule */
  readonly damage: (input: WeaponDamageInput) => number | null;
}

/**
 * Admitted weapon hooks (SHARD-PLATFORM SF36): a shard declares which weapons ask its AssemblyScript module for a number,
 * the facts each family supplies and the bounds of each answer; the game admits the module through the same ScriptHost
 * (ABI v0, fuel, memory, event and failure ceilings) as the shard's director and hands each weapon its `WeaponHooks`.
 *
 * The call's input slots (f64): 0 the call's tick, 1 dt (0), 2 the hook (1 = damage), 3 the module's entity, 4 the phase
 * (`WEAPON_HOOK_PHASES` index + 1), 5 the weapon (declaration order + 1), 6 the row's base damage, 7… the declared facts
 * in order. The answer is ONE event record `{ op 3, type: the weapon's declared event, target: the entity, value }`; any
 * other output, a trap, a fuel overrun or a value outside `[min, max]` (or not an integer) declines, and the family's own
 * rule applies. The declaration's `parameters` reach the module through the parameter query (410), like a director's.
 * A hook is a pure function of its inputs: the module's memory and globals return to their admitted state after every
 * call, so nothing about a hook needs saving or restoring.
 */

/** The hook selector in input slot 2. */
export const WEAPON_HOOK_DAMAGE = 1;

class WeaponHookWorld extends ScriptWorld {
  private readonly data: WeaponHooksData;
  constructor(data: WeaponHooksData) {
    super({ fields: {}, archetypes: [], events: data.weapons.map((row) => row.damage.event), maxEntities: 1 },
      [{ id: data.entity, name: data.id, position: [0, 0, 0], fields: {}, frozen: false, interactive: true }]);
    this.data = data;
  }
  override prepare(effects: readonly ScriptEffect[], self: number, spawns: number, events: number): EffectTransaction {
    if (effects.length > 1 || effects.some((e) => e.op !== SCRIPT_OP.event || e.b !== self || !this.data.weapons.some((row) => row.damage.event === e.a))) throw new Error('Invalid weapon hook answer');
    return super.prepare(effects, self, spawns, events);
  }
}

/** One admitted weapon-hook module: `hooks(weaponId)` hands a declared weapon its bounded, pure hooks. */
export class WeaponHookLane {
  readonly data: WeaponHooksData;
  readonly host: ScriptHost;
  private readonly admitted: ScriptSnapshot;
  private tick = 0;
  constructor(data: WeaponHooksData, bytes: Uint8Array) {
    this.data = parseWeaponHooks(data);
    this.host = new ScriptHost({ world: new WeaponHookWorld(this.data), query: (kind, request, self) => {
      if (kind !== SCRIPT_PARAMETER_QUERY || self !== this.data.entity || request.length !== 8 || request.some((value) => value !== 0)) throw new Error('Weapon hooks query only their parameters');
      return [...this.data.parameters];
    } });
    this.host.install(this.data.module, bytes);
    this.admitted = this.host.snapshot(this.data.module);
  }
  /** Calls made so far (each is its own script tick). */
  get calls(): number { return this.tick; }
  /** The declared weapon's hooks; an undeclared weapon is refused. */
  hooks(weapon: string): WeaponHooks {
    const index = this.data.weapons.findIndex((row) => row.weapon === weapon), row = this.data.weapons[index];
    if (row === undefined) throw new Error(`Undeclared hooked weapon ${weapon}`);
    return { damage: (input) => this.damage(index, row, input) };
  }
  private damage(index: number, row: WeaponHooksData['weapons'][number], input: WeaponDamageInput): number | null {
    const phase = WEAPON_HOOK_PHASES.indexOf(input.phase);
    if (phase === -1 || !row.damage.phases.includes(input.phase) || !Number.isFinite(input.base)) return null;
    const facts: number[] = [];
    for (const f of row.damage.facts) {
      const value = input.facts[f.key];
      if (value === undefined || !Number.isFinite(value) || value < f.min || value > f.max) return null;
      facts.push(value);
    }
    this.host.beginTick(++this.tick);
    const call = this.host.call(this.data.module, this.data.entity, [this.tick, 0, WEAPON_HOOK_DAMAGE, this.data.entity, phase + 1, index + 1, input.base, ...facts]);
    // pure: whatever the call wrote, the next one starts from the admitted memory and globals
    if (call.ok) this.host.restore(this.data.module, this.admitted);
    const answer = call.ok && call.events.length === 1 ? call.events[0] : undefined;
    if (answer?.type !== row.damage.event || answer.target !== this.data.entity) return null;
    const value = answer.value;
    return Number.isInteger(value) && value >= row.damage.min && value <= row.damage.max ? value : null;
  }
}

/** Verify the immutable module bytes against the declaration's hash, then admit them. */
export async function createWeaponHookLane(data: WeaponHooksData, bytes: Uint8Array): Promise<WeaponHookLane> {
  const checked = parseWeaponHooks(data), copy = Uint8Array.from(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', copy));
  if ([...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('') !== checked.module) throw new Error('Weapon hook module hash mismatch');
  return new WeaponHookLane(checked, copy);
}

/** A weapon that takes hooks: the family's `hooks` slot (null = its row rule). */
export interface HookedWeapon { readonly row: { readonly id: string }; hooks: WeaponHooks | null }
/** The shard's declaration, its module bytes and the built weapons to hook. */
export interface WeaponHooksInstallation {
  data: unknown;
  bytes: () => Promise<Uint8Array>;
  /** each must be declared; its hooks are cleared when the level's scope ends */
  weapons: () => readonly HookedWeapon[];
}

/**
 * Admit a shard's weapon hooks and hand each built weapon its own (SHARD-PLATFORM SF36). Gated by the same default-off
 * Developer row as the shard directors ("Shard directors (data)": Legacy / Script): off, nothing is fetched and every
 * weapon keeps its row rule. Async admission never hooks a weapon after its level has gone.
 */
export async function installWeaponHooks(context: Pick<LevelContext, 'scope' | 'debugRow'>, options: WeaponHooksInstallation): Promise<WeaponHookLane | null> {
  if (!directorVariant(context)) return null;
  const data = parseWeaponHooks(options.data);
  const lane = await createWeaponHookLane(data, await options.bytes());
  if (context.scope.disposed) return null;
  const hooked = options.weapons().map((weapon) => ({ weapon, hooks: lane.hooks(weapon.row.id) }));
  for (const { weapon, hooks } of hooked) weapon.hooks = hooks;
  context.scope.onDispose(() => { for (const { weapon, hooks } of hooked) if (weapon.hooks === hooks) weapon.hooks = null; });
  return lane;
}

/** One presentation clock and the admitted numeric views of privately owned held-model parts.
 * The owner cannot write simulation state, issue contacts or choose a gameplay action. */
export class HeldPlayback {
  readonly model: ClientScene | null;
  private readonly attachments: ClientScene[] = [];
  private elapsed = 0;
  private delta = 0;
  private readonly groups = new Map<string, { lane: ReturnType<typeof createClientChannelView>; copied: number[] }[]>();
  constructor(rows: Readonly<Record<string, readonly unknown[]>>, parts: ReadonlyMap<string, unknown>, kernels?: ClientGeometryKernels | ((parts: ReadonlyMap<string, unknown>, model: ClientScene | null) => ClientGeometryKernels), source?: { readonly row: unknown; readonly ports: ClientScenePorts }) {
    const groups = Object.entries(rows);
    if (groups.length === 0 || groups.length > 16) throw new RangeError('Held playback groups exceed admission');
    for (const [id, programs] of groups) if (!/^[a-z][a-zA-Z0-9.-]*$/u.test(id) || id.length > 128 || !Array.isArray(programs) || programs.length === 0 || programs.length > 8) throw new Error('Invalid held playback group');
    this.model = source === undefined ? null : createClientScene(source.row, source.ports);
    try {
    const targets = new Map(parts);
    for (const [id, object] of this.model?.parts ?? []) {
      if (targets.has(id)) { this.model?.dispose(); throw new Error('Private scene target repeated'); }
      targets.set(id, object);
    }
    const binding = typeof kernels === 'function' ? kernels(targets, this.model) : kernels;
    for (const [id, programs] of groups) {
      this.groups.set(id, programs.map(program => {
        const lane = createClientChannelView(program, targets, binding);
        return { lane, copied: Array.from({ length: lane.reads.length }, () => 0) };
      }));
    }    } catch (error) { this.model?.dispose(); throw error; }
  }

  /** Required scene handles for declared held weapons and their catalogue views. */
  get root(): Group {
    const root = this.model?.group('root');
    if (root === null || root === undefined) throw new Error('Held scene root unavailable');
    return root;
  }
  part(id: string): Object3D {
    const part = this.model?.parts.get(id);
    if (part === undefined) throw new Error('Held scene part unavailable');
    return part;
  }
  material(id: string): MeshStandardMaterial {
    const material = this.model?.standardMaterial(id);
    if (material === null || material === undefined) throw new Error('Held scene material unavailable');
    return material;
  }

  /** Construct another owned private part, optionally appended at an existing admitted node. No world-scene access. */
  createPart(source: {readonly row:unknown;readonly ports:ClientScenePorts}, parent?: string): ClientScene {
    const target = parent === undefined ? null : this.model?.parts.get(parent);
    if (target === undefined) throw new Error('Missing owned attachment parent');
    const part = createClientScene(source.row,source.ports); target?.add(part.root); this.attachments.push(part); return part;
  }
  /** Dispose only resources this owner constructed, including detached parts. Borrowed ports remain caller-owned. */
  dispose(): void { for (const part of this.attachments) part.dispose(); this.model?.dispose(); this.attachments.length = 0; }
  /** Refuse a schedule naming an unbound group before inputs or contact clocks advance. */
  requireGroups(ids: readonly string[]): void { for (const id of ids) if (!this.groups.has(id)) throw new Error('Missing held playback group'); }
  /** Presentation time only; callers retain their original contact/hold phase ordering. */
  beginFrame(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0 || dt > 1e12 || this.elapsed + dt > 1e12) throw new RangeError('Invalid held playback frame');
    this.delta = dt; this.elapsed += dt;
  }
  get time(): number { return this.elapsed; }
  /** Copy a bounded observation into one selected view group; never lends authoritative objects. */
  apply(group: string, values: Readonly<Record<string, number>>): void {
    const views = this.groups.get(group); if (views === undefined) throw new Error('Missing held playback group');
    for (const { lane, copied } of views) {
      for (let i = 0; i < lane.reads.length; i++) {
        const key = lane.reads[i]; if (key === undefined) throw new Error('Missing held playback read');
        const value = values[key]; if (value === undefined) throw new Error(`Missing held playback observation ${key}`);
        copied[i] = value;
      }
      lane.evaluate({ time: this.elapsed, delta: this.delta, values: copied });
    }
  }
}


/** Owned presentation parts and the trusted contact factory; the factory retains the original source/reaction laws. */
export interface HeldMeleePorts<T extends ContactScanTarget, P> {
  readonly model: Group; readonly parts: P; readonly presentation: HeldPlayback;
  readonly nodes: ReadonlyMap<string, unknown>;
  readonly contacts: (ports: Omit<ContactFamilyPorts<T>, 'react' | 'body'>) => ContactFamily<T>;
  readonly targets: () => readonly T[];
  readonly restingVisible?: boolean; readonly tip?: Vector3; readonly caughtPart?: () => Mesh;
}
/**
 * One page held-melee phase owner. Immediate contacts claim before sampling aim; delayed contacts sample at their
 * original landing times. Rows select the phase/channel, while ContactFamily and the existing AS owner stay authoritative.
 */
export class HeldMeleeWeapon<T extends ContactScanTarget, P> extends HeldContactWeapon<T> {
  override readonly model: Group;
  readonly parts: P; readonly presentation: HeldPlayback;
  protected readonly moves: ContactFamily<T>;
  private readonly binding: ReturnType<typeof createHeldMeleeBinding>;
  private readonly ports: HeldMeleePorts<T, P>;
  private readonly observed = { phase: 1, charge: 0, spring: 0, holster: 0, stowed: 0,
    ext: 0, slack: 0, tipX: 0, tipY: 0, tipZ: 0, gripX: 0, gripY: 0, gripZ: 0, modelX: 0, modelY: 0,
    reach: 0, taut: 0, caughtX: 0, caughtY: 0, caughtZ: 0 };
  private readonly end = new Vector3();
  private worldTargets: readonly ContactWorldTarget[] = [];
  private caughtAt: Vector3 | null = null; private caughtT = 0; private caughtMesh: Mesh | null = null;
  private secondary: ((family: ContactFamily<T>) => number | null) | null = null;
  onGust: ((from: Vector3, dir: Vector3) => void) | null = null;
  stowed: () => boolean = () => false;
  motion: string; motionK = 1;
  constructor(app: App, row: EquipmentRow, phases: unknown, ports: HeldMeleePorts<T, P>) {
    const binding = createHeldMeleeBinding(phases, ports.nodes), data = binding.row;
    super(app, row, data.spring, data.charge);
    if (data.mode === 'delayed' && (ports.tip === undefined || ports.caughtPart === undefined)) throw new Error('Delayed phase requires owned deformation/catch ports');
    this.binding = binding; this.ports = ports; this.model = ports.model; this.parts = ports.parts; this.presentation = ports.presentation;
    this.motion = data.phases[0].id;
    this.moves = ports.contacts({ hit: request => this.contact.hit(request), targets: ports.targets,
      world: () => this.worldTargets, aim: (from, dir) => this.aim(from, dir),
      fired: () => { this.onFire?.(); }, struck: (id, killed) => { this.onHit?.(id, false, killed); },
      caught: caught => { if (this.moves.move === data.phases[1].move) this.catchAt(caught.at); } });
    for (let i = 0; i < data.phases.length; i++) { const phase = data.phases[i]; if (phase === undefined) throw new Error('Missing admitted primary'); const move = this.moves.row(phase.move); if (move.lane !== 'primary' || move.heavy !== (i === 1) || (data.mode === 'immediate' ? move.lands.length > 0 : move.lands.length === 0)) throw new Error('Phase crossed its contact mode or lane'); }
    if (data.mode === 'immediate') { const move = this.moves.row(data.secondary.phase.move); if (move.lane !== 'secondary' || move.lands.length > 0) throw new Error('Phase crossed its contact mode or lane'); }
    this.presentation.requireGroups(data.mode === 'immediate' ? [...data.phases.map(phase => phase.channel), data.secondary.phase.channel] : Object.values(data.channels));
    this.model.position.set(...data.position);
    if (data.rotation !== undefined) this.model.rotation.set(...data.rotation);
    if (data.scale !== undefined) this.model.scale.setScalar(data.scale);
  }
  bindSecondary(start: (family: ContactFamily<T>) => number | null, charge: number): void { this.secondary = start; this.chargeSeconds = charge; }
  aimAt(targets: readonly ContactWorldTarget[]): void { this.worldTargets = targets; }
  override install(ctx: EquipContext): void {
    super.install(ctx);
    const row = this.binding.row;
    if (row.mode === 'immediate') this.app.input.bind(row.secondary.action, () => { this.gust(); }, ctx.scope, () => this.enabled);
    else ctx.scope.onDispose(() => {
      this.moves.cancel();
      if (this.caughtMesh !== null) { this.caughtMesh.removeFromParent(); this.caughtMesh.geometry.dispose(); this.caughtMesh = null; }
    });
  }
  private aimed(): { from: Vector3; dir: Vector3 } | null {
    const from = new Vector3(), dir = new Vector3(); return this.aim(from, dir) ? { from, dir } : null;
  }
  swing(heavy: boolean): boolean {
    const row = this.binding.row, phase = row.phases[heavy ? 1 : 0];
    if (row.mode === 'delayed') {
      if (!this.enabled || !this.moves.swing(phase.move)) return false;
      this.onSwing?.(heavy); return true;
    }
    if (this.moves.cooldown > 0 || !this.enabled || this.stowed()) return false;
    this.moves.claim(phase.move); this.play(phase.id); this.onSwing?.(heavy);
    const aim = this.aimed(); if (aim !== null) this.slash(aim.from, aim.dir, heavy);
    return true;
  }
  slash(from: Vector3, dir: Vector3, heavy: boolean): number {
    const struck = this.moves.land(this.binding.row.phases[heavy ? 1 : 0].move, 0, from, dir);
    if (struck > 0) this.onFire?.(); return struck;
  }
  gust(): void {
    const row = this.binding.row;
    if (row.mode !== 'immediate' || this.moves.secondaryCooldown > 0 || !this.enabled || this.stowed()) return;
    if (this.secondary?.(this.moves) !== row.secondary.phase.move) return;
    this.play(row.secondary.phase.id);
    const aim = this.aimed(); if (aim === null) return;
    this.onGust?.(aim.from, aim.dir); this.blow(aim.from, aim.dir);
  }
  blow(from: Vector3, dir: Vector3): number {
    const row = this.binding.row; if (row.mode !== 'immediate') throw new Error('No admitted immediate secondary');
    this.moves.land(row.secondary.phase.move, 0, from, dir); return this.moves.touched;
  }
  crackWorld(from: Vector3, dir: Vector3, reach: number, second: boolean): ContactWorldTarget | null { return this.moves.crackWorld(from, dir, reach, second); }
  strike(target: Parameters<ContactFamily<T>['strike']>[0], point: Vector3, dir: Vector3, from: Vector3, heavy: boolean, second = false): boolean {
    return this.moves.strike(target, this.binding.row.phases[heavy ? 1 : 0].move, second ? 1 : 0, point, dir, from);
  }
  private play(id: string): void { this.motion = id; this.motionK = 0; }
  private catchAt(at: Vector3): void {
    const row = this.binding.row;
    if (row.mode !== 'delayed') return;
    const scene = this.app.equipmentHost?.game.scene; if (scene === undefined) return;
    if (this.caughtMesh === null) { const part = this.ports.caughtPart?.(); if (part === undefined) throw new Error('Missing owned catch part'); this.caughtMesh = part; part.frustumCulled = false; scene.add(part); }
    this.caughtMesh.position.copy(at); this.caughtMesh.visible = true; this.caughtAt = at.clone(); this.caughtT = row.caughtSeconds;
  }
  override update(dt: number): void {
    const row = this.binding.row, observed = this.observed;
    if (row.mode === 'immediate') {
      this.stepHeld(dt);
      const phase = this.binding.phases.get(this.motion);
      if (phase === undefined) throw new Error('Unadmitted held phase');
      this.motionK = Math.min(1, this.motionK + dt / phase.seconds);
      this.presentation.beginFrame(dt);
      observed.phase = this.motionK; observed.charge = this.charge; observed.spring = this.spring.yaw; observed.holster = this.holster; observed.stowed = Number(this.stowed());
      this.presentation.apply(phase.channel, observed); return;
    }
    this.presentation.beginFrame(dt); this.stepHeld(dt);
    observed.holster = this.holster; observed.spring = this.spring.yaw; this.presentation.apply(row.channels.root, observed);
    const { moving, resting, deformation } = this.binding, tip = this.ports.tip;
    if (moving === null || resting === null || deformation === null || tip === undefined) throw new Error('Missing owned delayed bindings');
    if (this.caughtT > 0) { this.caughtT -= dt; if (this.caughtT <= 0 && this.caughtMesh !== null) this.caughtMesh.visible = false; }
    if (this.moves.t < 0) { deformation.visible = false; resting.visible = this.ports.restingVisible ?? true; this.presentation.apply(row.channels.rest, observed); return; }
    const t = this.moves.advance(dt), double = this.moves.move === row.phases[1].move;
    if (t < 0) return;
    const local = double && t > row.second - row.overlap ? t - (row.second - row.unroll) : t;
    observed.ext = Math.min(1, local / row.unroll); observed.slack = Math.max(0, (local - row.unroll) / (row.show - row.unroll));
    this.presentation.apply(row.channels.active, observed); resting.visible = false; deformation.visible = true;
    observed.tipX = tip.x; observed.tipY = tip.y; observed.tipZ = tip.z;
    observed.gripX = moving.position.x; observed.gripY = moving.position.y; observed.gripZ = moving.position.z;
    observed.modelX = this.model.position.x; observed.modelY = this.model.position.y; observed.reach = row.reach[double ? 1 : 0];
    if (this.caughtT > 0 && this.caughtAt !== null) { this.model.updateWorldMatrix(true, false); this.end.copy(this.caughtAt); this.model.worldToLocal(this.end); }
    observed.taut = Number(this.caughtT > 0); observed.caughtX = this.end.x; observed.caughtY = this.end.y; observed.caughtZ = this.end.z;
    this.presentation.apply(row.channels.deformation, observed);
  }
}

type PageMeleeTarget = ReturnType<App['combat']['targets']>[number];
/** Borrowed query and owned scene ports for an admitted held melee item. */
export interface HeldMeleeScenePorts {
  readonly presentation: HeldPlayback; readonly contacts: unknown;
  readonly targets?: () => readonly PageMeleeTarget[];
  readonly raycast?: (from: Vector3, dir: Vector3, reach: number) => { readonly animal: Parameters<App['combat']['target']>[0]; readonly point: Vector3 } | null;
  readonly tip?: readonly [number, number, number]; readonly restingGroup?: string;
  readonly caught?: { readonly scene: Parameters<HeldPlayback['createPart']>[0]; readonly part: string };
}
/** Construct the existing held owner directly from its rows and scene; no private subclass/controller. */
export function createHeldMelee(app: App, row: EquipmentRow, phases: unknown, ports: HeldMeleeScenePorts): HeldMeleeWeapon<PageMeleeTarget, HeldPlayback> {
  const model = ports.presentation, caught = ports.caught;
  return new HeldMeleeWeapon(app, row, phases, { model: model.root, parts: model, presentation: model, nodes: model.model?.parts ?? new Map(),
    ...(ports.tip === undefined ? {} : { tip: new Vector3(...ports.tip) }),
    ...(ports.restingGroup === undefined ? {} : { restingVisible: model.model?.group(ports.restingGroup) === null }),
    ...(caught === undefined ? {} : { caughtPart: () => { const mesh = model.createPart(caught.scene).mesh(caught.part); if (mesh === null) throw new Error('Declared caught part unavailable'); return mesh; } }),
    targets: ports.targets ?? (() => app.combat.targets()),
    contacts: bound => bindMeleeContacts(row.id, ports.contacts, { ...bound, owner: 'env',
      ...(ports.raycast === undefined ? {} : { body: (from: Vector3, dir: Vector3, reach: number) => {
        const hit = ports.raycast?.(from, dir, reach) ?? null, target = hit === null ? null : app.combat.target(hit.animal);
        return hit === null || target === null ? null : { port: target, point: hit.point };
      } }),
      react: target => ({ actor: target.actor, ...(target.impulse === undefined ? {} : { impulse: target.impulse }),
        stagger: (dir: Vector3, strength: number) => { target.target.stagger?.(dir, strength); } }),
    }),
  });
}

/** Authored scene/playback/item rows; no builder, shader or contact authority in a recipe. */
export interface HeldMeleeRecipe {
  readonly equipment: EquipmentRow; readonly phases: Readonly<Record<string,unknown>>;
  readonly playback: Readonly<Record<string,readonly unknown[]>>; readonly scene:unknown;
  readonly attachments?:readonly {readonly id:string;readonly row:unknown;readonly parent:string}[];
  readonly tip?:readonly [number,number,number]; readonly restingGroup?:string;
  readonly caught?:{readonly row:unknown;readonly part:string};
}
/** Private borrowed resources are resolved by their actual owners before construction. */
export interface HeldPresentationPorts {
  readonly scene:ClientScenePorts; readonly attachments?:ReadonlyMap<string,ClientScenePorts|null>;
}
/** Construct one shared held hierarchy for page and Explorer, including declared optional attachments. */
export function createHeldPresentation(recipe:HeldMeleeRecipe,ports:HeldPresentationPorts):HeldPlayback {
  const rows=recipe.attachments??[];
  if(rows.length>16||new Set(rows.map(row=>row.id)).size!==rows.length||rows.some(row=>!/^[a-z][a-zA-Z0-9.-]{0,127}$/u.test(row.id)))throw new Error('Invalid held attachment roster');
  const model=new HeldPlayback(recipe.playback,new Map(),undefined,{row:recipe.scene,ports:ports.scene});
  try {
    for(const row of rows){const borrowed=ports.attachments?.get(row.id);if(borrowed!==undefined&&borrowed!==null)model.createPart({row:row.row,ports:borrowed},row.parent);}
    return model;
  } catch(error){model.dispose();throw error;}
}
/** Query/phase ports stay owned; presentation assembly is declared once for both melee families. */
export interface DeclaredHeldMeleePorts extends Omit<HeldMeleeScenePorts,'presentation'|'tip'|'restingGroup'|'caught'> {
  readonly model:HeldPresentationPorts; readonly charge?:number;
}
/** Bind the recipe to the existing held controller; never installs a second actor or phase owner. */
export function createDeclaredHeldMelee(app:App,recipe:HeldMeleeRecipe,ports:DeclaredHeldMeleePorts):ReturnType<typeof createHeldMelee> {
  const model=createHeldPresentation(recipe,ports.model);
  try {
    return createHeldMelee(app,recipe.equipment,ports.charge===undefined?recipe.phases:{...recipe.phases,charge:ports.charge},{
      presentation:model,contacts:ports.contacts,
      ...(ports.targets===undefined?{}:{targets:ports.targets}),...(ports.raycast===undefined?{}:{raycast:ports.raycast}),
      ...(recipe.tip===undefined?{}:{tip:recipe.tip}),...(recipe.restingGroup===undefined?{}:{restingGroup:recipe.restingGroup}),
      ...(recipe.caught===undefined?{}:{caught:{scene:{row:recipe.caught.row,ports:{geometry:ports.model.scene.geometry}},part:recipe.caught.part}}),
    });
  } catch(error){model.dispose();throw error;}
}
