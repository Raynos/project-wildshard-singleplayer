import { bagMenu } from '../bag/tabs';
import * as THREE from 'three';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { ItemPickup } from '@wildshard/engine/player/WeaponPickup';
import type { GameMenu } from '@wildshard/engine/ui/Menu';
import type { MapMark } from '@wildshard/engine/ui/Minimap';
import type { GearLoot, FindsView } from '../bag/bag';
import { CoinChip } from './ui/CoinChip';
import { CoinBurst } from './CoinBurst';
import { Purse, publishPurse } from './Purse';
import { installQuestShop } from '../quest/trader';
import { Bounty } from './Bounty';
import { coinsFor, coinsOn, type LootGate } from './coins';
import { isCosmetic, isOwnedId, type Owned, type OwnedId } from './Owned';
import { onCreatureDeath, DEATH_ORDER, type CreatureDeathSource } from './deaths';
import type { ShardContext } from "../plugin/context";
import { DynamicBodySlots } from '@wildshard/engine/physics/bodies';

export interface LootShop { readonly isOpen: boolean; render: () => void; dispose: () => void }
export interface LootPresentation {
  debugName?: string;
  /** The shard supplies its registered goods, prompt and presentation; the mechanism owns the purse and lifetime. */
  shop?: (purse: Purse) => LootShop | null;
  gear: (purse: Purse) => GearLoot;
  finds: (() => FindsView) | null;
  marks: (() => readonly MapMark[]) | null;
  charted: () => boolean;
  lateKinds?: readonly string[];
  chime: () => void;
}
export interface LootBody extends CreatureDeathSource { kind: string; position: THREE.Vector3; herd: number; alive: boolean }
export interface ScopedLootHost<A extends LootBody> {
  ctx: Pick<ShardContext, 'scope' | 'on' | 'system' | 'debug'>;
  owned: Owned;
  manifest: LootGate & { slug: string };
  scene: THREE.Scene;
  player: { position: THREE.Vector3 };
  camera: THREE.Camera;
  animals: () => readonly A[];
  before?: readonly string[];
  menu: GameMenu;
  presentation: LootPresentation;
  minimap?: { setMarks: (source: (() => readonly MapMark[]) | null) => void } | null;
}
export interface ScopedLoot { purse: Purse | null; dispose: () => void }

/** Any coin-enabled manifest gets the same scoped coin and shop mechanism. */
export function installLoot<A extends LootBody>(h: ScopedLootHost<A>): ScopedLoot {
  if (!coinsOn(h.manifest)) return { purse: null, dispose: () => undefined };
  const { ctx, owned, presentation: view } = h;
  const lifetime = ctx.scope.child('loot');
  const purse = new Purse(h.manifest.slug), chip = new CoinChip(purse.coins), burst = new CoinBurst(h.scene);
  const releasePurse = publishPurse(ctx.scope, purse);
  let live = true, charted = false;
  ctx.system({ id: 'game.loot', phase: 'update', before: h.before ?? [], run: (dt) => { if (live) burst.update(dt, h.player.position); } });
  const flush = (): void => { purse.flush(); };
  const onHidden = (): void => { if (document.visibilityState === 'hidden') flush(); };
  lifetime.listen(window, 'pagehide', flush); lifetime.listen(document, 'visibilitychange', onHidden);
  const census = Bounty.census(h.animals()), bounty = new Bounty(h.manifest.slug, census);
  let fullClear = 0;
  for (const [key, n] of census) fullClear += n * coinsFor(h.manifest, key.split(':')[0] ?? key);
  for (const lone of view.lateKinds ?? []) if (!census.has(lone)) fullClear += coinsFor(h.manifest, lone);
  const projected = new THREE.Vector3();
  onCreatureDeath(ctx, h.animals, (a) => {
    if (!live || practiceRoom.open) return;
    const n = coinsFor(h.manifest, a.kind);
    if (n <= 0 || !bounty.claim(a)) return;
    burst.spawn(a.position, n, (share) => { purse.add(share, false); }, () => { flush(); view.chime(); });
    projected.set(a.position.x, a.position.y + 1.5, a.position.z).project(h.camera);
    if (projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1) chip.pop((projected.x + 1) * 0.5 * window.innerWidth, (1 - projected.y) * 0.5 * window.innerHeight, n);
  }, DEATH_ORDER.loot);
  const applyChart = (): void => {
    const want = view.charted() && view.marks !== null;
    if (want !== charted) { charted = want; h.minimap?.setMarks(want ? view.marks : null); }
  };
  applyChart();
  const shop = view.shop?.(purse) ?? null;
  const offBag = bagMenu(h.menu).addLoot('loot', { gear: () => view.gear(purse), finds: view.finds,
    wear: (id) => { if (isOwnedId(id) && isCosmetic(id)) owned.toggleWorn(id); } });
  const refresh = (): void => { if (h.menu.isOpen) h.menu.refresh(); };
  const offOwned = owned.onChange(() => { applyChart(); refresh(); });
  const offPurse = purse.onChange((n) => { chip.set(n); if (shop?.isOpen === true) shop.render(); refresh(); });
  ctx.debug.expose(view.debugName ?? `${h.manifest.slug}.loot`, { purse, owned, bounty, fullClear, grant: (id: OwnedId) => owned.grant(id), coins: (n: number) => { purse.add(n); }, shop });
  const dispose = (): void => {
    if (!live) return;
    live = false; flush(); offOwned(); offPurse(); releasePurse();
    lifetime.dispose();
    offBag(); if (charted) h.minimap?.setMarks(null);
    shop?.dispose(); chip.dispose(); burst.dispose();
  };
  ctx.scope.onDispose(dispose);
  return { purse, dispose };
}

/** Install ordinary loot against the admitted world services without exposing a raw scene to runtime content. */
export function installRuntimeLoot(ctx: ShardContext, presentation: LootPresentation, options: { readonly minimap?: boolean; readonly before?: readonly string[]; readonly shop?: unknown } = {}): ScopedLoot | null {
  const runtime = ctx.game.runtime;
  if (runtime?.play === null || runtime?.play === undefined || runtime.world === null) return null;
  return installLoot({ ctx, manifest: ctx.manifest, owned: runtime.play.owned, scene: runtime.world.game.scene,
    player: runtime.world.player, camera: runtime.world.game.camera, animals: () => runtime.play?.animals.animals ?? [],
    menu: runtime.play.menu, presentation: options.shop === undefined ? presentation : { ...presentation, shop: () => installQuestShop(ctx, options.shop)() },
    ...(options.minimap === true ? { minimap: runtime.play.minimap ?? null } : {}),
    ...(options.before === undefined ? {} : { before: options.before }) });
}

/** Bounded authored presentation and retirement of an already claimed loot identity. */
export interface ClaimedPickupRow {
  readonly death?: { readonly kind: string; readonly variant?: string; readonly floor: 'source' | 'ground' | 'max';
    readonly towardPlayer?: { readonly distance: number; readonly epsilon: number } };
  readonly options: Pick<ConstructorParameters<typeof ItemPickup>[0], 'scale' | 'tilt' | 'glow' | 'prompt'> & { readonly tier?: string };
  readonly toss: { readonly horizontal: number; readonly up: number };
  readonly walkIn: { readonly radius: number; readonly height: number } | null;
  readonly takenGrace: number;
  readonly unique: boolean;
  readonly disposeItemOnTake: boolean;
  readonly retireBeforeCallback: boolean;
}
/** Content retains its model, grant/wear callbacks and independent cosmetic/loot RNG streams. */
export interface ClaimedPickupPorts<I extends string> {
  readonly scene: THREE.Scene;
  readonly has: (id: I) => boolean;
  readonly model: (id: I) => THREE.Object3D;
  readonly take: (id: I, item: THREE.Object3D) => void;
  readonly random: () => number;
  readonly visualRandom?: () => number;
  readonly enter?: (id: I, drop: ItemPickup) => void;
}
/** One owner for floating claimed items and their original after-take grace policy; never advances physics itself. */
export class ClaimedPickupRoster<I extends string> {
  readonly drops = new Map<I, ItemPickup>();
  private readonly active = new Map<ItemPickup, { id: I; row: ClaimedPickupRow }>();
  private readonly fading: { drop: ItemPickup; left: number }[] = [];
  constructor(private readonly rows: Readonly<Record<string, ClaimedPickupRow | undefined>>, private readonly ports: ClaimedPickupPorts<I>) {
    const keys = Object.keys(rows);
    if (keys.length === 0 || keys.length > 128) throw new Error('Claimed pickup rows exceed their bound');
    for (const id in rows) {
      if (!Object.hasOwn(rows, id)) continue;
      const row = rows[id];
      if (row === undefined || !Number.isFinite(row.takenGrace) || row.takenGrace < 0 || row.takenGrace > 60
        || !Number.isFinite(row.toss.horizontal) || !Number.isFinite(row.toss.up)
        || (row.walkIn !== null && (!(row.walkIn.radius > 0) || !(row.walkIn.height > 0)))) throw new Error('Invalid claimed pickup row');
    }
  }
  /** Resolve a death without sampling terrain or claiming ownership. The caller keeps its current floor query and event order. */
  death(actor: { readonly kind: string; readonly variant?: string | undefined; readonly position: THREE.Vector3 }, player: THREE.Vector3,
    candidates: readonly string[] = Object.keys(this.rows)): { id: I; at: THREE.Vector3; floor: 'source' | 'ground' | 'max' } | null {
    if (candidates.length > 128) throw new Error('Claimed death candidates exceed their bound');
    for (const candidate of candidates) {
      if (!Object.hasOwn(this.rows, candidate)) continue;
      const id = candidate as I, policy = this.rows[id]?.death;
      if (policy === undefined || policy.kind !== actor.kind || policy.variant !== undefined && policy.variant !== actor.variant) continue;
      if (this.ports.has(id)) return null;
      const at = actor.position.clone(), toward = policy.towardPlayer;
      if (toward !== undefined) {
        const distance = Math.hypot(at.x - player.x, at.z - player.z), ratio = distance > toward.epsilon ? Math.min(1, toward.distance / distance) : 0;
        at.x = player.x + (at.x - player.x) * ratio; at.z = player.z + (at.z - player.z) * ratio;
      }
      return { id, at, floor: policy.floor };
    }
    return null;
  }
  spawn(id: I, at: THREE.Vector3, toss: boolean): ItemPickup | null {
    const row = this.rows[id];
    if (row === undefined) throw new Error('Unknown claimed pickup row');
    if (this.ports.has(id) || (row.unique && this.drops.has(id))) return null;
    if (this.active.size + this.fading.length >= 128) throw new Error('Claimed pickup roster is full');
    const { tier, ...options } = row.options;
    if (tier !== undefined && tier !== 'common' && tier !== 'rare' && tier !== 'legendary') throw new Error('Invalid claimed pickup tier');
    const item = this.ports.model(id), angle = this.ports.random() * Math.PI * 2, velocity = { x: 0, y: 0, z: 0 };
    if (toss) DynamicBodySlots.velocity({ kind: 'radial', ...row.toss }, at, at, angle, velocity);
    const drop = new ItemPickup({ ...options, ...(tier === undefined ? {} : { tier }), scene: this.ports.scene, item, position: at.clone(),
      ...(toss ? { toss: velocity } : {}),
      ...(this.ports.visualRandom === undefined ? {} : { random: this.ports.visualRandom }) });
    this.ports.enter?.(id, drop);
    const retire = (): void => {
      this.active.delete(drop); if (this.drops.get(id) === drop) this.drops.delete(id);
      if (row.takenGrace > 0) this.fading.push({ drop, left: row.takenGrace });
      if (row.disposeItemOnTake) item.traverse(o => { if (o instanceof THREE.Mesh) { const geometry: unknown = o.geometry; if (geometry instanceof THREE.BufferGeometry) geometry.dispose(); } });
    };
    drop.onPickup = () => { if (row.retireBeforeCallback) retire(); this.ports.take(id, item); if (!row.retireBeforeCallback) retire(); };
    this.active.set(drop, { id, row }); this.drops.set(id, drop);
    return drop;
  }
  update(dt: number, t: number, renderer: Parameters<ItemPickup['update']>[2], camera: Parameters<ItemPickup['update']>[3], player: THREE.Vector3): void {
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const entry = this.fading[i]; if (entry === undefined) continue;
      entry.drop.update(dt, t, renderer, camera); if ((entry.left -= dt) <= 0) this.fading.splice(i, 1);
    }
    for (const [drop, { row }] of this.active) {
      drop.update(dt, t, renderer, camera);
      const reach = row.walkIn, at = drop.group.position;
      if (reach !== null && Math.hypot(at.x - player.x, at.z - player.z) < reach.radius && Math.abs(at.y - player.y) < reach.height) drop.take();
    }
  }
}
