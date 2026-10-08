import { bagMenu } from '../bag/tabs';
import * as THREE from 'three';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { GameMenu } from '@wildshard/engine/ui/Menu';
import type { MapMark } from '@wildshard/engine/ui/Minimap';
import type { GearLoot, FindsView } from '../bag/bag';
import { CoinChip } from './ui/CoinChip';
import { CoinBurst } from './CoinBurst';
import { Purse } from './Purse';
import { Bounty } from './Bounty';
import { coinsFor, coinsOn, type LootGate } from './coins';
import { isCosmetic, isOwnedId, type Owned, type OwnedId } from './Owned';
import { onCreatureDeath, DEATH_ORDER, type CreatureDeathSource } from './deaths';
import type { ShardContext } from '../shard/context';

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
  ctx: Pick<LevelContext, 'scope' | 'on' | 'system' | 'debug'>;
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
    live = false; flush(); offOwned(); offPurse();
    lifetime.dispose();
    offBag(); if (charted) h.minimap?.setMarks(null);
    shop?.dispose(); chip.dispose(); burst.dispose();
  };
  ctx.scope.onDispose(dispose);
  return { purse, dispose };
}

/** Install ordinary loot against the admitted world services without exposing a raw scene to runtime content. */
export function installRuntimeLoot(ctx: ShardContext, presentation: LootPresentation): ScopedLoot | null {
  const runtime = ctx.game.runtime;
  if (runtime?.play === null || runtime?.play === undefined || runtime.world === null) return null;
  return installLoot({ ctx, manifest: ctx.manifest, owned: runtime.play.owned, scene: runtime.world.game.scene,
    player: runtime.world.player, camera: runtime.world.game.camera, animals: () => runtime.play?.animals.animals ?? [],
    menu: runtime.play.menu, presentation });
}
