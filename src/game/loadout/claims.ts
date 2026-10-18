import * as THREE from 'three';
import * as v from 'valibot';
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
import { bindRuntimeEquipment, type RuntimeEquipmentFactory } from '../plugin/headless';
import { readItemEquipment } from '../plugin/nativeItems';
import { heldArmsGear } from '../models/heldGear';
import { ToonArms } from '../systems/viewmodel/toonArms';
import { SWORD_WOOD, SWORD_IRON } from '../weapons/starterMeleeProfile';
import { Sword } from '../weapons/Sword';
import { QuestStepRunner, type QuestStepFrame } from '../quest/steps';

type Claim = HeldArmsRows['claims'][number];
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
  private readonly arms: ToonArms;
  private readonly geometries = new Map<string, { file: string; source: OwnedGeometry }>();
  private readonly drops = new Map<string, HeldClaim>();
  private constructor(private readonly context: ShardContext) {
    this.rows = v.parse(HeldArmsSchema, context.product.section('held/arms')); this.arms = ToonArms.admit(this.rows.look);
    for (const claim of this.rows.claims) for (const [id, file] of Object.entries(claim.geometries)) {
      this.geometries.set(`${claim.id}/${id}`, { file, source: createOwnedGeometry(context.product.url(file)) });
    }
  }
  /** Prepare explicitly during kit installation; publication and retirement follow the context scope. */
  static async prepare(context: ShardContext): Promise<HeldClaims> {
    const host = new HeldClaims(context); await Promise.all([host.arms.prepare(context), Promise.all([...host.geometries.values()].map(async ({ file, source }) => { await source.load(await context.product.file(file)); }))]);
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
    const row = this.rows.claims.find(claim => claim.id === id); if (row === undefined) throw new Error('Unknown held claim');
    const geometry = new Map(Object.keys(row.geometries).map(name => {
      const part = this.geometries.get(`${row.id}/${name}`)?.source.copy(); if (part === undefined) throw new Error('Held claim geometry is not prepared'); return [name, part] as const;
    }));
    const materials = new Map(Object.entries(row.materials).map(([name, material]) => [name, this.arms.materialById(material)]));
    const made = createClientScene(row.scene, { geometry, materials }), group = made.group(row.group);
    if (group === null) throw new Error('Held claim needs its declared group'); return group;
  }
  /** Register native melee rows and factories in the admitted item order, without shard callbacks. */
  install(): void {
    const context = this.context, runtime = context.game.runtime, world = runtime?.world;
    if (runtime === undefined || world === undefined || world === null) throw new Error('Held melee needs its world');
    const items = context.product.shardfile.items, factories = new Map<string, RuntimeEquipmentFactory>();
    const profiles = this.rows.weapons.map(row => {
      const item = items.rows.find(entry => entry.id === row.item);
      if (item?.kind !== 'weapon' || item.profile?.family !== 'melee') throw new Error('Held melee needs its native item profile');
      const profile: MeleeProfile = applyMeleeCombatProfile({ ...(row.blade === 'iron' ? SWORD_IRON : SWORD_WOOD), ...readItemEquipment(items, row.item) }, item.profile);
      const claim = this.rows.claims.find(entry => entry.item === row.item);
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
