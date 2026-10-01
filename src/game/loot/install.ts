import { legacyShardId } from '../shard/manifest';
/**
 * installLoot — the shard's loot wired into the running game in one call from main.ts (E314 stage 1,
 * project/archive/2026-09-30-driftwood-loot.md). main.ts builds the shard's Owned store first (the iron sword is kept there); a shard
 * whose ShardManifest says `loot: { coins: true }` (Driftwood) gets:
 *   - the purse (Purse.ts) and its HUD chip under VITALS (src/game/loot/CoinChip.ts);
 *   - the kill → coins burst (coins.ts values, CoinBurst.ts): chained onto `animals.onKill`, so call this AFTER main.ts
 *     assigns its own onKill; each enemy pays once, a respawn's kill pays nothing (Bounty.ts);
 *   - the Bag's loot: GEAR's sharpening pips / health / charm / cosmetics / purse, and the FINDS tab (finds.ts), read
 *     from the adventure's flags;
 *   - stage 2, the trader's shop (shop.ts goods + prices, src/shards/driftwood-isle/loot/ShopPanel.ts screen C): her prompt at the counter opens
 *     it (TraderStall.ts); a sale spends the purse and grants the Owned id, and the effects follow Owned live — the
 *     whetstones scale every sword's damage (`swords`), the hearts (and the first charm) raise max health
 *     (`setMaxHealth`: main.ts's bar, regen and respawn), the sea chart marks the unfound sea glass on the minimap and
 *     the full map (`minimap.setMarks`), the cape is worn from GEAR.
 * Other shards: GEAR shows their weapons and skins only, no FINDS tab, no coins (Jake: FINDS elsewhere is a later review).
 *
 *   const owned = new Owned(chunk.id);  // early: owned.has('iron-sword') = the sword taken on an earlier visit
 *   const loot = installLoot({ owned, chunk, game, player, camera: game.camera, animals, audio, menu, flags: adventure?.flags ?? null });
 *   loot.dispose()                      // the shard is evicted
 *   window.__loot = { purse, owned, bounty, fullClear, grant(id), coins(n), shop }   // dev console / captures: grant an
 *                                       // item, add coins, open the shop; fullClear = the coins for killing every enemy once
 */
import * as THREE from 'three';
import type { Audio } from '#engine/audio/Audio';
import { IslandSfx } from '#engine/audio/IslandSfx';
import { CoinChip } from './CoinChip';
import type { GameMenu } from '#engine/ui/Menu';
import type { CosmeticSlot, GearLoot } from '../bag/bag';
import { CoinBurst } from './CoinBurst';
import { coinsFor, coinsOn, type LootGate } from './coins';
import { driftwoodFinds, nextCharmAt, seaChartMarks, seaGlassFound, type FlagReader } from '#shards/driftwood-isle/loot/finds';
import { buyGood, goodById, goodState, GOODS, maxHealthOf, swordMul, type Good } from '#shards/driftwood-isle/loot/shop';
import { ShopPanel } from '#shards/driftwood-isle/loot/ShopPanel';
import type { MapMark } from '#engine/ui/Minimap';
import { TRADER_NAME, type TraderStall } from '#shards/driftwood-isle/quest/TraderStall';
import { isCosmetic, isOwnedId, OWNED, type Owned, type OwnedId } from './Owned';
import { practiceRoom } from '#engine/core/practiceRoom';
import { Purse } from './Purse';
import { Bounty } from './Bounty';

export interface LootAnimal { kind: string; position: THREE.Vector3; herd: number; alive: boolean }
export interface LootHost<A extends LootAnimal> {
  /** the shard's Owned store (main.ts builds it early: the iron sword's pickup writes to it) */
  owned: Owned;
  chunk: LootGate & { slug: string };
  game: { scene: THREE.Scene; onUpdate: (fn: (dt: number, t: number) => void, label?: string) => void };
  player: { position: THREE.Vector3 };
  camera: THREE.Camera;
  animals: { animals: readonly A[]; onKill?: ((a: A) => void) | undefined };
  audio: Audio;
  menu: GameMenu;
  /** the adventure's saved flags (Driftwood) — FINDS reads them; null on a shard with no adventure */
  flags: FlagReader | null;
  /** the trader's stall (Driftwood's adventure, E314 stage 2): the shop screen is handed to her prompt */
  trader?: TraderStall | null | undefined;
  /** the swords the whetstones sharpen (each one's damage at install is its base) */
  swords?: readonly { damage: number }[];
  /** max health changed (a sturdy heart, the first sea glass charm): main.ts's health bar, regen and respawn read it */
  setMaxHealth?: (max: number) => void;
  /** the shop screen is up (true: release the pointer lock and the weapons) / closed (false: take them back) */
  hold?: (on: boolean) => void;
  toast?: (text: string) => void;
  /** the minimap (its marks are the full map's too): the sea chart's sea glass */
  minimap?: { setMarks: (source: (() => readonly MapMark[]) | null) => void } | null;
}
export interface Loot {
  purse: Purse | null;
  /** the shard is evicted (main.ts's ShardWorld.dispose): the chip and its pops leave #hud, the coins leave the scene,
   *  the purse is written, the page listeners go */
  dispose: () => void;
}

const _v = new THREE.Vector3();

export function installLoot<A extends LootAnimal>(h: LootHost<A>): Loot {
  const owned = h.owned;
  if (!coinsOn(h.chunk)) return { purse: null, dispose: () => undefined };

  const purse = new Purse(legacyShardId(h.chunk.slug));
  const chip = new CoinChip(purse.coins);
  purse.onChange((n) => { chip.set(n); });
  const burst = new CoinBurst(h.game.scene);
  let live = true;
  h.game.onUpdate((dt) => { if (live) burst.update(dt, h.player.position); }, 'loot'); // Game has no off: the flag stops it
  // a burst's coins are counted as they land but written once, when the last one lands (a captain = 12 landings, each a
  // native Preferences write on iOS); leaving the page or hiding the tab writes whatever a burst in flight has counted
  const flush = (): void => { purse.flush(); };
  const onHidden = (): void => { if (document.visibilityState === 'hidden') purse.flush(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', onHidden);
  const sfx = new IslandSfx(h.audio);
  // each enemy pays once (Jake, 2026-09-30): a respawn's kill pays nothing (Bounty.ts); the census is the island as it starts
  const census = Bounty.census(h.animals.animals);
  const bounty = new Bounty(legacyShardId(h.chunk.slug), census);
  let fullClear = 0;
  for (const [k, n] of census) fullClear += n * coinsFor(h.chunk, k.split(':')[0] ?? k);
  for (const lone of ['sailor', 'captain']) if (!census.has(lone)) fullClear += coinsFor(h.chunk, lone); // they rise later

  const prevKill = h.animals.onKill;
  h.animals.onKill = (a) => {
    prevKill?.(a);
    if (!live || practiceRoom.open) return; // a practice kill (arena / playground, E321) pays nothing and spends no one-time pay
    const n = coinsFor(h.chunk, a.kind);
    if (n <= 0 || !bounty.claim(a)) return;
    burst.spawn(a.position, n, (share) => { purse.add(share, false); }, () => { purse.flush(); sfx.interact('chime', undefined, { gain: 0.55 }); });
    _v.set(a.position.x, a.position.y + 1.5, a.position.z).project(h.camera);
    if (_v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1) chip.pop((_v.x + 1) * 0.5 * window.innerWidth, (1 - _v.y) * 0.5 * window.innerHeight, n);
  };

  // ── the effects (stage 2): they follow Owned, so a purchase, a reload and a dev grant all land the same way ──
  const swords = (h.swords ?? []).map((w) => ({ w, base: w.damage }));
  const chart = h.flags;
  const marks = chart ? (): readonly MapMark[] => seaChartMarks(chart) : null;
  let charted = false;
  const applyEffects = (): void => {
    const mul = swordMul(owned.sharpen);
    for (const s of swords) s.w.damage = Math.round(s.base * mul);  // wood 12 → 15 → 18 · iron 28 → 35 → 42
    h.setMaxHealth?.(maxHealthOf(owned));
    const want = owned.has('sea-chart') && marks !== null;
    if (want !== charted) { charted = want; h.minimap?.setMarks(want ? marks : null); }
  };
  applyEffects();
  owned.onChange(applyEffects);

  // ── the trader's shop (screen C): her prompt → the panel; BUY spends the purse, grants the good ──
  let shop: ShopPanel<Good> | null = null;
  const stall = h.trader ?? null;
  if (stall) {
    const greeting = (): string => {
      if (GOODS.every((g) => owned.has(g.id))) return 'That\'s all I carry. Fair winds, castaway.';
      if (purse.coins === 0) return 'No coin? Every beast on this island carries a few.';
      return 'Coin\'s good. What\'ll it be?';
    };
    const panel = new ShopPanel<Good>({
      trader: TRADER_NAME, place: 'Driftwood Isle', goods: GOODS, greeting,
      state: (g) => goodState(g, owned, purse.coins),
      coins: () => purse.coins,
      needs: (g) => (g.needs !== undefined ? goodById(g.needs)?.name ?? g.needs : ''),
    });
    panel.onBuy = (g) => {
      if (!buyGood(g, owned, purse)) return false;
      sfx.interact('chime', stall.at, { gain: 0.8 });
      stall.trader.offer();
      h.toast?.(`Bought · ${g.name} — ${g.id === 'cape' ? 'wear it from GEAR' : g.does.toLowerCase()}`);
      return true;
    };
    panel.onOpen = () => { h.hold?.(true); };
    panel.onClose = () => { h.hold?.(false); };
    purse.onChange(() => { if (panel.isOpen) panel.render(); });
    stall.shop = panel;
    shop = panel;
  }

  const cosmetic = (id: 'captain-hat' | 'cape', ic: 'hat' | 'cape', how: string): CosmeticSlot =>
    ({ id, name: OWNED[id].label, icon: ic, owned: owned.has(id), worn: owned.worn(id), how });
  const flags = h.flags;
  const gear = (): GearLoot => {
    const glass = flags ? seaGlassFound(flags).filter(Boolean).length : 0;
    return {
      sharpen: owned.sharpen,
      health: { max: maxHealthOf(owned), hearts: owned.hearts },
      charms: { owned: owned.charms, next: nextCharmAt(glass) },
      cosmetics: [cosmetic('captain-hat', 'hat', 'The Drowned Captain'), cosmetic('cape', 'cape', `${TRADER_NAME}'s counter`)],
      coins: purse.coins,
    };
  };
  h.menu.setLoot({
    gear,
    finds: flags ? () => driftwoodFinds(flags, owned) : null,
    wear: (id) => { if (isOwnedId(id) && isCosmetic(id)) owned.toggleWorn(id); },
  });
  const refresh = (): void => { if (h.menu.isOpen) h.menu.refresh(); };
  owned.onChange(refresh); purse.onChange(refresh);

  // dev console / capture scripts (not a URL switch): grant an item, add coins
  const dev = { purse, owned, bounty, fullClear, grant: (id: OwnedId) => owned.grant(id), coins: (n: number) => { purse.add(n); }, shop };
  Object.assign(window, { __loot: dev });
  return {
    purse,
    dispose: () => {
      if (!live) return;
      live = false;
      purse.flush();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
      h.menu.setLoot(null);
      if (charted) h.minimap?.setMarks(null);
      if (stall) stall.shop = null;
      shop?.dispose();
      chip.dispose();
      burst.dispose();
      const w = window as { __loot?: unknown };
      if (w.__loot === dev) delete w.__loot;
    },
  };
}
