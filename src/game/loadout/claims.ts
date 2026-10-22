import * as THREE from 'three';
import * as v from 'valibot';
import { isJsonData } from '@wildshard/format/json';
import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import { Rng } from '@wildshard/engine/core/rng';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { ItemPickup } from '@wildshard/engine/player/WeaponPickup';
import { InteractSfx } from '@wildshard/engine/audio/interactSfx';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { applyMeleeCombatProfile, type MeleeProfile } from '@wildshard/engine/combat/meleeProfile';
import type { RosterEntry } from '@wildshard/engine/models/live';
import { HeldArmsSchema, type HeldArmsRows } from '@wildshard/format/heldArms';
import type { ShardContext } from '../plugin/context';
import { createOwnedGeometry, type OwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { createClientScene } from '../plugin/ui';
import { bindRuntimeEquipment, bindRuntimeItems, sameRuntimeProfile, type RuntimeEquipmentFactory } from '../plugin/headless';
import { ItemCatalogue } from '../plugin/nativeItems';
import { heldArmsGear } from '../models/heldGear';
import { ToonArms } from '../systems/viewmodel/toonArms';
import { SWORD_WOOD, SWORD_IRON } from '../weapons/starterMeleeProfile';
import { Sword } from '../weapons/Sword';
import { installDeclaredMelee, type DeclaredMelee } from './declaredMelee';
import { GrappleTool, grappleGuard } from '../grapple/tool';
import { parseGrappleProfile, type GrappleRows } from '@wildshard/format/grapple';
import { QuestStepRunner, type QuestStepFrame } from '../quest/steps';

type ToonRows = Extract<HeldArmsRows, { readonly look: unknown }>;
type Claim = ToonRows['claims'][number];
function requireHeldOwner(context: ShardContext, reason: string): void {
  if (context.scope.disposed || context.scope.disposing) throw new Error(reason);
}
const HeldPlaySchema = v.strictObject({ grapple: v.strictObject({ item: v.string(), source: v.string(), presentation: v.string() }) });
const hookCoordinate = v.pipe(v.number(), v.finite());
const GrappleHooksSchema = v.array(v.strictObject({ x: hookCoordinate, y: hookCoordinate, z: hookCoordinate }));
const PrimaryPresentationSchema = v.object({ portraitFov: v.pipe(v.number(), v.finite(), v.minValue(1), v.maxValue(179)) });
/** A claim's guard evaluates rows over facts; no executable shard guard or notice callback is accepted. */
export class HeldClaimGuard {
  private readonly runner: QuestStepRunner;
  private facts: QuestStepFrame | null = null;
  constructor(private readonly row: Claim['guard']['condition']) { this.runner = new QuestStepRunner({ version: 1, steps: [], guards: [row] }); }
  /** Native fact arrays remain live, so a death changes the prompt before the next interaction read. */
  bindFacts(facts: QuestStepFrame): void { this.facts = facts; }
  reason(): string | null { return this.facts === null ? null : this.runner.guard(this.row.id, this.facts); }
}

const halos = new Map<string, THREE.CanvasTexture>();
function haloTexture(row: Claim['halo']): THREE.CanvasTexture {
  const key = JSON.stringify([row.size, row.stops]), ready = halos.get(key); if (ready !== undefined) return ready;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = row.size;
  const context = canvas.getContext('2d'); if (context === null) throw new Error('Held claim needs a halo canvas');
  const half = row.size / 2, gradient = context.createRadialGradient(half, half, 0, half, half, half);
  for (const [at, opacity] of row.stops) gradient.addColorStop(at, `rgba(255,255,255,${opacity})`);
  context.fillStyle = gradient; context.fillRect(0, 0, row.size, row.size);
  const texture = cacheUntilDisposed(new THREE.CanvasTexture(canvas), () => { halos.delete(key); });
  texture.colorSpace = THREE.SRGBColorSpace; halos.set(key, texture); return texture;
}

/** Internal native pickup; all per-content choices and guard effects come from admitted rows. */
class HeldClaim extends ItemPickup {
  declare readonly interactable: Interactable;
  private readonly guard: HeldClaimGuard;
  private readonly glowLight: THREE.PointLight;
  private readonly halo: THREE.Sprite;
  private readonly haloMat: THREE.SpriteMaterial;
  private readonly glowScene: THREE.Scene;
  private readonly phase: number;
  private flags: readonly string[] | null = null;
  private gone = false;
  constructor(private readonly context: ShardContext, private readonly row: Claim, item: THREE.Object3D, prompt: string) {
    const world = context.game.runtime?.world; if (world === undefined || world === null) throw new Error('Held claim needs its world');
    const random = new Rng(context.product.shardfile.identity.seed ^ row.seedXor), phase = random.next() * row.phase;
    const floor = new THREE.Vector3(...row.position); floor.y += row.lift;
    super({ scene: world.game.scene, item, position: floor, prompt, radius: row.radius, scale: row.scale, tilt: row.tilt, random: () => random.next() });
    this.glowScene = world.game.scene; this.phase = phase; this.guard = new HeldClaimGuard(row.guard.condition);
    const base = this.interactable, reason = (): string | null => this.reason();
    this.interactable = { position: base.position,
      get radius() { return reason() === null ? base.radius : Math.min(base.radius, row.guard.radius); },
      get weak() { return reason() !== null; }, get label() { return reason() ?? base.label; },
      onInteract: () => {
        const blocked = reason(); if (blocked === null) { base.onInteract(); return; }
        const play = context.game.runtime?.play; if (play === undefined || play === null) return;
        play.hud.toast(row.guard.toast.replaceAll('{reason}', blocked)); new InteractSfx(play.audio).interact('locked');
      } };
    this.glowLight = LightPool.for(this.glowScene).acquire(row.light.colour, row.light.intensity, row.light.distance, row.light.decay);
    this.glowLight.position.set(floor.x, floor.y + row.light.height, floor.z);
    this.haloMat = new THREE.SpriteMaterial({ map: haloTexture(row.halo), color: row.halo.colour, transparent: true, opacity: row.halo.opacity,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
    this.halo = new THREE.Sprite(this.haloMat); this.halo.position.set(floor.x, floor.y + row.halo.height, floor.z);
    this.halo.scale.setScalar(row.halo.scale); this.halo.renderOrder = row.halo.order; this.glowScene.add(this.halo);
  }
  bindGuardFlags(flags: readonly string[]): void { this.flags = flags; }
  private reason(): string | null {
    if (this.flags === null) return null;
    const animals = this.context.game.runtime?.play?.animals.animals;
    this.guard.bindFacts({ flags: this.flags, ...(animals === undefined ? {} : { actors: animals.map(({ kind, alive }) => ({ kind, alive })) }) });
    return this.guard.reason();
  }
  override dispose(): void { super.dispose(); this.removeGlow(); }
  private removeGlow(): void {
    if (this.gone) return; this.gone = true;
    this.glowScene.remove(this.halo); LightPool.for(this.glowScene).release(this.glowLight); this.haloMat.dispose();
  }
  override update(dt: number, time: number): void {
    const world = this.context.game.runtime?.world;
    super.update(dt, time, world?.game.renderer, world?.game.camera);
    if (!this.taken) {
      let flicker = 1; for (const [frequency, amplitude] of this.row.waves) flicker += Math.sin((time + this.phase) * frequency) * amplitude;
      this.glowLight.intensity = this.row.light.intensity * flicker; this.haloMat.opacity = this.row.halo.flickerOpacity * flicker; return;
    }
    if (this.gone) return;
    this.glowLight.intensity = Math.max(0, this.glowLight.intensity - dt * this.row.fade.light);
    this.haloMat.opacity = Math.max(0, this.haloMat.opacity - dt * this.row.fade.opacity); this.halo.scale.addScalar(dt * this.row.fade.scale);
    if (this.haloMat.opacity <= 0) this.removeGlow();
  }
}

const catalogues = new Map<string, HeldClaims>();
/** Client-only held melee families, world claims and Explorer cards. The shard supplies rows and platform contexts. */
export class HeldClaims {
  readonly rows: HeldArmsRows;
  private readonly arms: ToonArms | null;
  private primary: DeclaredMelee | null = null;
  private entered = false;
  private portraitFov: number | null = null;
  private readonly geometries = new Map<string, { file: string; source: OwnedGeometry }>();
  private readonly drops = new Map<string, HeldClaim>();
  private constructor(private readonly context: ShardContext) {
    this.rows = v.parse(HeldArmsSchema, context.product.section('held/arms'));
    this.arms = 'kind' in this.rows ? null : ToonArms.admit(this.rows.look);
    if ('kind' in this.rows) return;
    for (const claim of this.rows.claims) for (const [id, file] of Object.entries(claim.geometries)) {
      this.geometries.set(`${claim.id}/${id}`, { file, source: createOwnedGeometry(context.product.url(file)) });
    }
  }
  /** Prepare explicitly during kit installation; publication and retirement follow the context scope. */
  static async prepare(context: ShardContext): Promise<HeldClaims> {
    if (context.scope.disposed || context.scope.disposing) throw new Error('Held preparation scope has ended');
    const host = new HeldClaims(context);
    if ('kind' in host.rows) {
      host.portraitFov = v.parse(PrimaryPresentationSchema, await context.product.json(host.rows.primary.file)).portraitFov;
    } else {
      if (host.arms === null) throw new Error('Held claims require their original arms');
      await Promise.all([host.arms.prepare(context), Promise.all([...host.geometries.values()].map(async ({ file, source }) => { await source.load(await context.product.file(file)); }))]);
    }
    requireHeldOwner(context, 'Held claim entry owner ended during preparation');
    catalogues.set(context.product.slug, host);
    context.scope.onDispose(() => {
      if (catalogues.get(context.product.slug) === host) catalogues.delete(context.product.slug);
      host.drops.clear(); for (const { source } of host.geometries.values()) source.take().dispose();
    });
    return host;
  }
  static current(slug: string): HeldClaims { const host = catalogues.get(slug); if (host === undefined) throw new Error('Held claims are not prepared'); return host; }
  /** Look up a claim for plain quest facts. Taking, ownership and persistence remain on EquipmentService. */
  claim(id: string): HeldClaim | null { return this.drops.get(id) ?? null; }
  /** Owned copies of the row's original geometry and shared graph materials, used by pickup and parity fixtures. */
  display(id: string): THREE.Group {
    const rows = this.rows, arms = this.arms;
    if ('kind' in rows || arms === null) throw new Error('Declared primary has no Toon claim display');
    const row = rows.claims.find(claim => claim.id === id); if (row === undefined) throw new Error('Unknown held claim');
    const geometry = new Map(Object.keys(row.geometries).map(name => {
      const part = this.geometries.get(`${row.id}/${name}`)?.source.copy(); if (part === undefined) throw new Error('Held claim geometry is not prepared'); return [name, part] as const;
    }));
    const materials = new Map(Object.entries(row.materials).map(([name, material]) => [name, arms.materialById(material)]));
    const made = createClientScene(row.scene, { geometry, materials }), group = made.group(row.group);
    if (group === null) throw new Error('Held claim needs its declared group'); return group;
  }
  /** The original primary owner, available only after its declared kit install. */
  melee(): DeclaredMelee {
    if (this.context.scope.disposed || this.context.scope.disposing) throw new Error('Held primary owner has ended');
    if (this.primary === null) throw new Error('Declared primary is not installed');
    return this.primary;
  }
  private requireUnentered(): void { if (this.entered) throw new Error('Held play is already installed'); }
  /** Bind the already-built declared primary and one declared grapple tool at entered play. */
  async enter(context: ShardContext, input: unknown): Promise<void> {
    if (!isJsonData(input)) throw new Error('Held play input must be JSON data');
    requireHeldOwner(context, 'Held play owner has ended');
    const scope = context.scope, product = context.product, app = context.app;
    if (scope !== this.context.scope || product !== this.context.product) throw new Error('Held play requires its original entered owner');
    const rows = this.rows;
    if (!('kind' in rows)) throw new Error('Held play requires a declared primary');
    this.requireUnentered();
    const { grapple: spec } = v.parse(HeldPlaySchema, input), source = product.shardfile, items = source.items;
    if (rows.tools.length !== 1 || rows.tools[0] !== spec.item) throw new Error('Held play requires its one declared grapple');
    const declaration = items.rows.find(row => row.id === spec.item), weapon = items.rows.find(row => row.id === rows.primary.item);
    if (declaration?.kind !== 'tool' || weapon?.kind !== 'weapon') throw new Error('Held play requires its declared primary and tool');
    if (items.rows.some(row => row.id !== weapon.id && row.id !== declaration.id)) throw new Error('Held play cannot bind an undeclared equipment family');
    if (![spec.source, spec.presentation].every(file => product.hasFile(file))) throw new Error('Held play requires its admitted grapple files');
    const equipment = app.equipment;
    if (equipment === null) throw new Error('Held play requires its loadout');
    const melee = this.melee(), { primary: built, profile } = melee, primary = built();
    if (primary.row.id !== rows.primary.item || !sameRuntimeProfile(weapon.profile, profile)) throw new Error('Held play primary differs from its original item');
    const equipmentRow = new ItemCatalogue(items).equipment(spec.item);
    const [content, presentation] = await Promise.all([
      product.json<{ readonly hooks: unknown; readonly grappleProfile: unknown }>(spec.source),
      product.json<GrappleRows>(spec.presentation),
    ]);
    const hooks = v.parse(GrappleHooksSchema, content.hooks), grappleProfile = parseGrappleProfile(content.grappleProfile);
    if (grappleProfile.id !== spec.item) throw new Error('Held play grapple profile and item differ');
    if (context.scope !== scope || scope.disposed || scope.disposing) throw new Error('Held play owner ended during preparation');
    if (context.product !== product || product.shardfile !== source || context.app !== app || app.equipment !== equipment) throw new Error('Held play owner was replaced during preparation');
    const current = this.melee();
    if (current !== melee || current.primary() !== primary || current.profile !== profile || !sameRuntimeProfile(weapon.profile, profile)) throw new Error('Held play primary was replaced during preparation');
    this.requireUnentered();
    const grapple = new GrappleTool(context, { equipment: equipmentRow, profile: grappleProfile, presentation, hooks }), tool = grapple.row;
    grappleGuard(scope).bind(grapple);
    this.entered = true;
    bindRuntimeEquipment(context, { ...source, items: { ...items, rows: items.rows.filter(row => row.kind === 'weapon'), loadout: { ...items.loadout, tools: [] } } },
      [{ id: primary.row.id, weapon: primary, profile }]);
    bindRuntimeItems(context, source, {
      kit: new Map([[weapon.family, { kind: 'weapon', profiles: ['melee'], create: () => primary }]]),
      families: new Map([[declaration.family, { kind: 'tool', presentation: { ui: tool.ui }, create: row => { grapple.row = { ...row, meta: tool.meta }; return grapple; } }]]),
      icon: name => { const row = [primary.row, tool].find(entry => entry.ui.icon === name); if (row === undefined) throw new Error(`Unknown held item icon ${name}`); return row.ui.icon; },
    });
    equipment.add(grapple, { locked: false });
  }

  /** Register native melee rows and factories in the admitted item order, without shard callbacks. */
  install(): void {
    const context = this.context, runtime = context.game.runtime, world = runtime?.world;
    if (runtime === undefined || world === undefined || world === null) throw new Error('Held melee needs its world');
    if (context.scope.disposed || context.scope.disposing) throw new Error('Held installation owner has ended');
    const rows = this.rows;
    if ('kind' in rows) {
      if (this.primary !== null) throw new Error('Declared primary is already installed');
      if (this.portraitFov === null) throw new Error('Declared primary presentation is not prepared');
      const items = context.product.shardfile.items, catalogue = new ItemCatalogue(items);
      const tools = rows.tools.map(id => {
        if (!items.rows.some(item => item.id === id && item.kind === 'tool')) throw new Error(`Missing declared tool: ${id}`);
        return catalogue.equipment(id);
      });
      this.primary = installDeclaredMelee(context, { item: rows.primary.item, blade: rows.primary.blade, portraitFov: this.portraitFov });
      for (const tool of tools) context.rows.tool(tool);
      return;
    }
    const items = context.product.shardfile.items, factories = new Map<string, RuntimeEquipmentFactory>();
    const profiles = rows.weapons.map(row => {
      const item = items.rows.find(entry => entry.id === row.item);
      if (item?.kind !== 'weapon' || item.profile?.family !== 'melee') throw new Error('Held melee needs its native item profile');
      const profile: MeleeProfile = applyMeleeCombatProfile({ ...(row.blade === 'iron' ? SWORD_IRON : SWORD_WOOD), ...new ItemCatalogue(items).equipment(row.item) }, item.profile);
      const claim = rows.claims.find(entry => entry.item === row.item);
      if (claim !== undefined) profile.pickup = { owned: claim.owned, prompt: claim.prompt, toast: claim.toast, create: (at, prompt) => {
        if (at !== claim.at) throw new Error('Unknown held claim site');
        const drop = new HeldClaim(context, claim, this.display(claim.id), prompt); this.drops.set(claim.id, drop); return drop;
      } };
      factories.set(row.item, { create: (_item, targets, allowUnlocked, viewmodel) => {
        if (viewmodel?.arms === undefined || viewmodel.ironArms === undefined) throw new Error('Held melee requires both native arm rigs');
        if (row.blade === 'iron') return new Sword(world, targets, { row: profile, profile, allowUnlocked, blade: 'iron', arms: viewmodel.ironArms });
        const { ironArms: _iron, swim: _swim, ...wood } = viewmodel;
        return new Sword(world, targets, { row: profile, profile, allowUnlocked, ...wood,
          ...(world.game.level.camera === undefined ? {} : { portraitFov: world.game.level.camera.portraitFov }) });
      } });
      return profile;
    });
    context.rows.weapon(profiles); runtime.buildEquipment = bindRuntimeEquipment(context, context.product.shardfile, { factories });
  }
  /** Define cold cards from admitted rows; loading and dressing remain inside this host. */
  static gear(input: unknown): readonly RosterEntry[] {
    return heldArmsGear(input);
  }
}
