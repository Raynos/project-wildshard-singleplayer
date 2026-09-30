/**
 * installLoot — the shard's loot wired into the running game in one call from main.ts (E314 stage 1,
 * docs/plans/DRIFTWOOD-LOOT.md). main.ts builds the shard's Owned store first (the iron sword is kept there); a shard
 * whose ChunkDef says `loot: { coins: true }` (Driftwood) gets:
 *   - the purse (Purse.ts) and its HUD chip under VITALS (src/ui/CoinChip.ts);
 *   - the kill → coins burst (coins.ts values, CoinBurst.ts): chained onto `animals.onKill`, so call this AFTER main.ts
 *     assigns its own onKill;
 *   - the Bag's loot: GEAR's sharpening pips / health / charm / cosmetics / purse, and the FINDS tab (finds.ts), read
 *     from the adventure's flags.
 * Other shards: GEAR shows their weapons and skins only, no FINDS tab, no coins (Jake: FINDS elsewhere is a later review).
 *
 *   const owned = new Owned(chunk.id);  // early: owned.has('iron-sword') = the sword taken on an earlier visit
 *   installLoot({ owned, chunk, game, player, camera: game.camera, animals, audio, menu, flags: adventure?.flags ?? null });
 *   window.__loot = { purse, owned, grant(id), coins(n) }   // dev console / captures: grant an item, add coins
 */
import * as THREE from 'three';
import type { Audio } from '../../audio/Audio';
import { IslandSfx } from '../../audio/IslandSfx';
import { CoinChip } from '../../ui/CoinChip';
import type { GameMenu } from '../../ui/Menu';
import type { CosmeticSlot, GearLoot } from '../../ui/bag';
import { CoinBurst } from './CoinBurst';
import { coinsFor, coinsOn, type LootGate } from './coins';
import { driftwoodFinds, nextCharmAt, seaGlassFound, type FlagReader } from './finds';
import { isCosmetic, isOwnedId, OWNED, type Owned, type OwnedId } from './Owned';
import { Purse } from './Purse';

export interface LootHost<A extends { kind: string; position: THREE.Vector3 }> {
  /** the shard's Owned store (main.ts builds it early: the iron sword's pickup writes to it) */
  owned: Owned;
  chunk: LootGate & { id: string };
  game: { scene: THREE.Scene; onUpdate: (fn: (dt: number, t: number) => void, label?: string) => void };
  player: { position: THREE.Vector3 };
  camera: THREE.Camera;
  animals: { onKill?: ((a: A) => void) | undefined };
  audio: Audio;
  menu: GameMenu;
  /** the adventure's saved flags (Driftwood) — FINDS reads them; null on a shard with no adventure */
  flags: FlagReader | null;
}
export interface Loot { purse: Purse | null }

const MAX_HEALTH = 100;
const _v = new THREE.Vector3();

export function installLoot<A extends { kind: string; position: THREE.Vector3 }>(h: LootHost<A>): Loot {
  const owned = h.owned;
  if (!coinsOn(h.chunk)) return { purse: null };

  const purse = new Purse(h.chunk.id);
  const chip = new CoinChip(purse.coins);
  purse.onChange((n) => { chip.set(n); });
  const burst = new CoinBurst(h.game.scene);
  h.game.onUpdate((dt) => { burst.update(dt, h.player.position); }, 'loot');
  const sfx = new IslandSfx(h.audio);

  const prevKill = h.animals.onKill;
  h.animals.onKill = (a) => {
    prevKill?.(a);
    const n = coinsFor(h.chunk, a.kind);
    if (n <= 0) return;
    burst.spawn(a.position, n, (share) => { purse.add(share); }, () => { sfx.interact('chime', undefined, { gain: 0.55 }); });
    _v.set(a.position.x, a.position.y + 1.5, a.position.z).project(h.camera);
    if (_v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1) chip.pop((_v.x + 1) * 0.5 * window.innerWidth, (1 - _v.y) * 0.5 * window.innerHeight, n);
  };

  const cosmetic = (id: 'captain-hat' | 'cape', ic: 'hat' | 'cape', how: string): CosmeticSlot =>
    ({ id, name: OWNED[id].label, icon: ic, owned: owned.has(id), worn: owned.worn(id), how });
  const flags = h.flags;
  const gear = (): GearLoot => {
    const glass = flags ? seaGlassFound(flags).filter(Boolean).length : 0;
    return {
      sharpen: owned.sharpen,
      health: { max: MAX_HEALTH + 20 * owned.hearts, hearts: owned.hearts },
      charms: { owned: owned.charms, next: nextCharmAt(glass) },
      cosmetics: [cosmetic('captain-hat', 'hat', 'The Drowned Captain'), cosmetic('cape', 'cape', 'The trader')],
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
  Object.assign(window, { __loot: { purse, owned, grant: (id: OwnedId) => owned.grant(id), coins: (n: number) => { purse.add(n); } } });
  return { purse };
}
