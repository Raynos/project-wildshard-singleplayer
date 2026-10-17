/** Client-only collection presentation over existing game/save owners. */
import * as THREE from 'three';
import { app } from '@wildshard/engine/app/runtime';
import { ownSceneTree, sceneObjectOwner } from '@wildshard/engine/app/sceneOwnership';
import type { Audio } from '@wildshard/engine/audio/Audio';
import { InteractSfx } from '@wildshard/engine/audio/interactSfx';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { modelContext, type ModelContext, type ModelDef } from '@wildshard/engine/models/model';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { place } from '@wildshard/engine/models/place';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { Place } from '@wildshard/engine/world/interact/types';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { CollectionKeepsakes } from '@wildshard/format/collectionDisplay';
import { curveAt } from '@wildshard/format/materials';
import type { BodyShadow } from '../cosmetics/bodyShadow';
import { ClaimedPickupRoster } from '../loot/runtime';
import { isOwnedId, isCosmetic, type Owned } from '../loot/Owned';
import { rollLoot } from '../loot/tables';
import { onCreatureDeath } from '../loot/deaths';
import type { DeclaredLootEconomy } from '../shard/declaredRows';
import type { ShardContext } from '../plugin/context';
import { CollectionDisplay, collectionCosmetic, type CollectionCatalogue, type CollectionParams } from '../models/collectionDisplay';

/** Existing save, world, model and effect owners lend only the capabilities the collection presenter needs. */
export interface CollectionKeepsakeHost<A extends { kind: string; variant?: string | undefined; position: THREE.Vector3 }> {
  rows: CollectionKeepsakes;
  models: Readonly<Record<string, ModelDef<CollectionParams>>>;
  loose: (model: string, trophy: string | undefined, ctx: ModelContext) => THREE.Object3D;
  progression: DeclaredLootEconomy['progression'];
  pickups: NonNullable<DeclaredLootEconomy['pickups']>;
  owner?: ShardContext;
  onDeath?: (run: (animal: A) => void, order: number) => void;
  owned: Owned;
  flags: Flags;
  place: (row: Place) => { x: number; y: number; z: number; yaw: number };
  floorAt: (x: number, z: number) => number;
  rewardAt: () => THREE.Vector3 | undefined;
  sky: SkyRig;
  game: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: Renderer; onUpdate: (fn: (dt: number, t: number) => void, label?: string) => void };
  player: { position: THREE.Vector3; yaw: number };
  hud: { toast: (text: string) => void };
  audio: Audio;
  music: { sting: (name: 'pickup' | 'death' | 'chunk') => void };
  swords: readonly { bladeGlow: number }[];
  body: BodyShadow | null;
  registry?: WorldRegistry | undefined;
}

/** Present keepsakes from admitted rows; old flags and Owned saves remain authoritative and load quietly. */
export function installCollectionKeepsakes<A extends { kind: string; variant?: string | undefined; position: THREE.Vector3 }>(h: CollectionKeepsakeHost<A>): {
  chime: CollectionDisplay | null; plaques: CollectionDisplay | null; drops: ClaimedPickupRoster<string>['drops'];
} {
  const { owned, progression, flags, rows } = h, ctx = modelContext(h.sky), scope = h.owner?.scope;
  const sfx = new InteractSfx(h.audio), floor = h.place(rows.floor).y;
  const displays = new Map<string, CollectionDisplay>();
  for (const row of rows.placements) {
    const model = h.models[row.model];
    if (model === undefined) throw new Error(`Missing collection model: ${row.model}`);
    const at = h.place({ poi: row.poi, x: row.x, z: row.z, y: floor + row.up, yaw: row.yaw });
    const build = (): THREE.Object3D => place(model, [{ ...at, scale: row.scale, params: row.params }], {
      ctx, draw: 'single', ...(h.registry === undefined ? {} : { registry: h.registry }), piece: row.piece,
    }).object;
    const object = scope === undefined ? build() : scope.run(build);
    if (scope !== undefined) {
      const mine = sceneObjectOwner(object);
      if (mine === null || mine === (object.parent === null ? null : sceneObjectOwner(object.parent))) ownSceneTree(object, scope, app.assets);
    }
    if (object instanceof CollectionDisplay) displays.set(row.role, object);
  }
  const chime = displays.get('count') ?? null, plaques = displays.get('trophies') ?? null;
  const pending: { text: string; at: number }[] = [];
  let clock = 0;
  const sync = (announce: boolean): void => {
    const state = progression.states[progression.flags.filter(flag => flags.has(flag)).length];
    if (state === undefined) throw new Error('Missing admitted reward state');
    chime?.setCount(state.displayCount);
    for (const reward of state.earned) {
      if (!owned.grant(reward.id) || !announce) continue;
      const last = pending[pending.length - 1]?.at ?? -Infinity;
      pending.push({ text: reward.text, at: Math.max(clock + rows.delay, last + rows.spacing) });
    }
  };
  sync(false);
  const offFlags = flags.onChange(flag => { if (flag.startsWith(rows.flags.prefix)) sync(true); });
  scope?.onDispose(offFlags);
  const wardrobe = new Map<string, THREE.Object3D>();
  const apply = (): void => {
    for (const [id, item] of Object.entries(rows.trophies)) {
      if (!isOwnedId(item)) throw new Error(`Unknown collection item: ${item}`);
      plaques?.setFilled(id, owned.has(item));
    }
    for (const row of rows.wardrobe) {
      if (!isOwnedId(row.owned) || !isCosmetic(row.owned)) throw new Error(`Unknown collection cosmetic: ${row.owned}`);
      if (h.body === null) continue;
      if (!owned.worn(row.owned)) { h.body.wardrobe.wear(row.slot, null); continue; }
      let object = wardrobe.get(row.model);
      if (object === undefined) { object = h.loose(row.model, undefined, ctx); wardrobe.set(row.model, object); }
      h.body.wardrobe.wear(row.slot, object);
    }
  };
  apply(); const offOwned = owned.onChange(apply); scope?.onDispose(offOwned);
  const roster = new ClaimedPickupRoster<string>(h.pickups, {
    scene: h.game.scene, has: id => isOwnedId(id) && owned.has(id),
    model: id => { const row = rows.drops[id]; if (row === undefined) throw new Error(`Missing collection drop: ${id}`); return h.loose(row.model, row.trophy, ctx); },
    random: () => app.rng.stream('loot').next(), enter: (_id, drop) => { scope?.own(drop); },
    take: id => {
      const text = h.pickups[id]?.toast, row = rows.drops[id];
      if (!isOwnedId(id) || text === undefined || row === undefined) throw new Error(`Unknown collection pickup: ${id}`);
      owned.grant(id); if (row.wear && isCosmetic(id)) owned.wear(id);
      h.hud.toast(text); sfx.interact('chime', undefined, { gain: 0.8 }); h.music.sting('pickup');
    },
  });
  h.onDeath?.(animal => {
    if (practiceRoom.open) return;
    const drop = roster.death(animal, h.player.position, rollLoot('trophies', animal).map(row => row.item));
    if (drop === null) return;
    if (drop.floor === 'ground') drop.at.y = h.floorAt(drop.at.x, drop.at.z);
    roster.spawn(drop.id, drop.at, true);
  }, 30);
  for (const row of rows.restore) {
    const at = h.rewardAt();
    if (flags.has(row.flag) && isOwnedId(row.item) && !owned.has(row.item) && at !== undefined) roster.spawn(row.item, at, false);
  }
  h.game.onUpdate((dt, t) => {
    clock += dt;
    if (clock >= (pending[0]?.at ?? Infinity)) {
      const next = pending.shift();
      if (next !== undefined) { h.hud.toast(next.text); sfx.interact('chime', undefined, { gain: 0.9 }); h.music.sting('pickup'); }
    }
    roster.update(dt, t, h.game.renderer, h.game.camera, h.player.position);
    const glow = owned.has(progression.glow.owned) ? curveAt(progression.glow.curve, h.sky.night) : 0;
    for (const sword of h.swords) sword.bladeGlow = glow;
  }, 'keepsakes');
  h.owner?.debug.expose(rows.debugName, { chime, plaques, drops: roster.drops,
    glass: (n: number) => { for (let i = 1; i <= rows.flags.count; i++) flags.set(`${rows.flags.prefix}${i}`, i <= n); },
    drop: (id: string) => {
      const player = h.player.position, x = player.x - Math.sin(h.player.yaw) * 2.5, z = player.z - Math.cos(h.player.yaw) * 2.5;
      roster.spawn(id, new THREE.Vector3(x, h.floorAt(x, z), z), true);
    },
  });
  return { chime, plaques, drops: roster.drops };
}

/** Borrowed opaque service instances; all rules and schedules are owned by the shared host. */
export interface CollectionKeepers<P extends object> {
  adventure: { flags: Flags; place: CollectionKeepsakeHost<never>['place']; floorAt: (x: number, z: number) => number;
    finale: { rewardAt: THREE.Vector3 } | null };
  world: { game: Omit<CollectionKeepsakeHost<never>['game'], 'onUpdate'>; sky: SkyRig;
    player: CollectionKeepsakeHost<never>['player']; registry: WorldRegistry };
  play: { owned: Owned; hud: CollectionKeepsakeHost<never>['hud']; audio: Audio; music: CollectionKeepsakeHost<never>['music'];
    bodyShadow?: BodyShadow | null; animals: AnimalManager };
  swords: CollectionKeepsakeHost<never>['swords'];
  catalogue: CollectionCatalogue;
  models: ReadonlyMap<string, ModelDef<P>>;
}

/** Bind existing world/adventure/player instances from rows; their legacy capability borrow is tracked by G482. */
export async function installDeclaredCollectionKeepsakes<P extends object>(ctx: ShardContext, rows: CollectionKeepsakes, economy: DeclaredLootEconomy,
  owners: ReadonlyMap<string, CollectionKeepers<P>>): Promise<void> {
  const owner = owners.get('collection'); if (owner === undefined) throw new Error('Missing collection owners');
  await owner.catalogue.prepare(); if (ctx.scope.disposed) return;
  const { world, play, adventure } = owner;
  installCollectionKeepsakes({ rows, models: owner.catalogue.models, owner: ctx,
    progression: economy.progression, pickups: economy.pickups ?? {}, flags: adventure.flags,
    place: row => adventure.place(row), floorAt: (x, z) => adventure.floorAt(x, z), rewardAt: () => adventure.finale?.rewardAt,
    owned: play.owned, sky: world.sky, player: world.player, hud: play.hud, audio: play.audio, music: play.music,
    body: play.bodyShadow ?? null, swords: owner.swords, registry: world.registry,
    onDeath: (run, order) => { onCreatureDeath(ctx, () => play.animals.animals, run, order); },
    loose: (key, trophy, modelCtx) => {
      if (trophy !== undefined) return owner.catalogue.trophy(key, trophy, modelCtx);
      const model = owner.models.get(key); if (model === undefined) throw new Error(`Missing collection cosmetic: ${key}`);
      return collectionCosmetic(model, modelCtx);
    },
    game: { ...world.game, onUpdate: run => { ctx.system({ id: 'keepsakes', phase: 'update', after: ['game.loot', 'body-shadow'],
      before: ['hud.combat', 'last place', 'first hints', 'main.world'], run }); } },
  });
}
