/**
 * Driftwood's keepsakes (E314 stage 3, project/archive/2026-09-30-driftwood-loot.md — Jake's picks 2026-09-30): what the beach and the
 * chosen fights give you to keep, hung in Wendell's hut, and what each one does. One call from main.ts on Driftwood.
 *
 *   - The sea glass chime (board 3 C): a wind chime hung under the eave over the hut's door (above the door opening's
 *     headroom, clear of the trader's stall). It shows the sea glass you have found in whole charms — 0 / 5 / 10 / 15 pieces — and at 5, 10
 *     and 15 pieces the charm is yours (Owned charm-1 / 2 / 3) with a toast and a chime: I = +10 max health (shop.ts's
 *     maxHealthOf, stacking with the trader's hearts), II = the dodge recharges 30 % faster (0.8 s → 0.56 s), III = the
 *     held sword glows sea-glass aqua at night (both swords, src/engine/player/bladeGlow.ts). The count is the beach pieces'
 *     flags (finds.ts), so an old save gets its charms on load, quietly.
 *   - The trophy plaques (board 4 A): on the hut's back wall inside, facing the door. The brown bear's claw and a boar's
 *     tusk: while you don't have it, a kill of that beast (the brown bear of the south-east grove; any of the island's
 *     boars) drops it — a walk-over pickup in the game's loot-drop orb (ItemPickup, tossed out of the body like Pine
 *     Hollow's legendaries). Walking into it takes it (Owned bear-claw / boar-tusk, saved): its plaque fills, FINDS lights
 *     it, and its perk is on — the claw: the charged heavy hits 20 % harder; the tusk: a hit that lands while a dodge
 *     carries you does nothing (dodge i-frames; the shared effect grants own these attributes and tags).
 *   - The captain's hat (board 4 C): the Drowned Captain's death drops it (gold orb) between you and where he fell; taking
 *     it grants captain-hat and puts it on. GEAR wears it / takes it off; FINDS shows it with the trophies. Left lying and
 *     the game reloaded, it waits at the ring's reward spot (he only dies once).
 *   - Worn cosmetics (the hat, the trader's cape) dress the body shadow (src/game/cosmetics/bodyShadow.ts), following GEAR.
 *
 * Wired after the player and weapon effect bindings; this owner only presents their keepsakes.
 * Seen in the game: scripts/e314-keepsakes-capture.mjs, progress/294-e314-keepsakes-stage3.jpg.
 *
 *   installKeepsakes({ effectsManaged: true, owned, adventure, sky, game, player, hud, audio, music, swords, body, registry })
 *   ctx.debug.expose('driftwood.keepsakes', { chime, plaques, glass(n), drop(id), drops }   // dev / captures: set the found count, drop a
 *                                                                        // trophy in front of you
 */
import * as THREE from 'three';
import { app } from '@wildshard/engine/app/runtime';
import type { Audio } from '@wildshard/engine/audio/Audio';
import { InteractSfx } from '@wildshard/engine/audio/interactSfx';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { modelContext } from '@wildshard/engine/models/model';
import { place } from '@wildshard/engine/models/place';
import { ClaimedPickupRoster } from '@wildshard/game/loot/runtime';
import KEEPSAKE_CONTENT from '../data/keepsakes.json' with { type: 'json' };
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { rollLoot } from '@wildshard/game/loot/tables';
import { curveAt } from '@wildshard/format/materials';
import type { DeclaredLootEconomy } from '@wildshard/game/shard/declaredRows';
import { seaGlassChime, SeaGlassChime } from '../runtime/models/seaGlassChime';
import { buildTrophy, trophyPlaques, TrophyPlaques } from '../runtime/models/trophyPlaques';
import { buildCaptainHat, buildSailclothCape } from '../runtime/models/captainHat';
import interactables from '../data/interactables.generated.json' with { type: 'json' };
import type { Adventure } from '../quest/adventure';
import { ownEnteredTree } from '../quest/Spine';
import type { BodyShadow } from '@wildshard/game/cosmetics/bodyShadow';
import { isOwnedId, type Owned } from '@wildshard/game/loot/Owned';
import type { ShardContext } from '@wildshard/game/shard/context';

const { SEA_GLASS_COUNT, SEA_GLASS_FLAG } = interactables;

type TrophyDropId = string;

export interface KeepsakeAnimal { kind: string; variant?: string | undefined; position: THREE.Vector3 }
export interface KeepsakeHost<A extends KeepsakeAnimal> {
  progression: DeclaredLootEconomy['progression'];
  pickups: NonNullable<DeclaredLootEconomy['pickups']>;
  owner?: ShardContext;
  onDeath?: (run: (animal: A) => void, order: number) => void;
  owned: Owned;
  adventure: Adventure;
  sky: Sky;
  game: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: Renderer; onUpdate: (fn: (dt: number, t: number) => void, label?: string) => void };
  player: { position: THREE.Vector3; yaw: number };
  hud: { toast: (text: string) => void };
  audio: Audio;
  music: { sting: (name: 'pickup' | 'death' | 'chunk') => void };
  /** The island's swords retain charm III's visual glow; effects own their damage attributes. */
  swords: readonly { bladeGlow: number }[];
  /** C5 applies the perks to live attributes once, before these presentation hooks. */
  effectsManaged: true;
  /** the body shadow (ShardManifest.bodyShadow): the worn hat and cape ride on it */
  body: BodyShadow | null;
  registry?: WorldRegistry | undefined;
}
export interface Keepsakes {
  chime: SeaGlassChime | null;
  plaques: TrophyPlaques | null;
}

export function installKeepsakes<A extends KeepsakeAnimal>(h: KeepsakeHost<A>): Keepsakes {
  const { owned, adventure: adv, progression, pickups: KEEPSAKE_PICKUPS } = h;
  const flags = adv.flags;
  const ctx = modelContext(h.sky);
  const registry = h.registry ? { registry: h.registry } : {};
  const sfx = new InteractSfx(h.audio);
  const floor = adv.place({ poi: 'hut', anchor: 'hut.door', x: 0, z: -2.7 }).y;

  // ── the chime and the plaques, placed models (the Model Explorer's world pieces; no colliders: they hang out of reach) ──
  // SF57: each piece and its drawn object belong to the owner's entry, not the page (a re-entered borrowed home runs this again)
  const scope = h.owner?.scope;
  const entered = (placed: () => THREE.Object3D): THREE.Object3D => {
    if (scope === undefined) return placed();
    const object = scope.run(placed);
    ownEnteredTree(object, scope);
    return object;
  };
  const c = adv.place({ poi: 'hut', x: KEEPSAKE_CONTENT.chime.x, z: KEEPSAKE_CONTENT.chime.z, y: floor + KEEPSAKE_CONTENT.chime.up });
  const chimeObj = entered(() => place(seaGlassChime, [{ x: c.x, y: c.y, z: c.z, yaw: c.yaw, scale: KEEPSAKE_CONTENT.chime.scale, params: { count: 0 } }], { ctx, draw: 'single', ...registry, piece: { id: 'sea-glass-chime', name: 'Sea glass wind chime' } }).object);
  const chime = chimeObj instanceof SeaGlassChime ? chimeObj : null;
  const p = adv.place({ poi: 'hut', x: KEEPSAKE_CONTENT.plaques.x, z: KEEPSAKE_CONTENT.plaques.z, y: floor + KEEPSAKE_CONTENT.plaques.up, yaw: Math.PI });
  const plaquesObj = entered(() => place(trophyPlaques, [{ x: p.x, y: p.y, z: p.z, yaw: p.yaw, scale: KEEPSAKE_CONTENT.plaques.scale, params: { bear: false, boar: false } }], { ctx, draw: 'single', ...registry, piece: { id: 'trophy-plaques', name: 'Trophy plaques' } }).object);
  const plaques = plaquesObj instanceof TrophyPlaques ? plaquesObj : null;

  // ── the charms: the found count → the chime's pieces and the charms owned ──
  const pending: { text: string; at: number }[] = [];
  let clock = 0;
  const syncGlass = (announce: boolean): void => {
    const state = progression.states[progression.flags.filter(flag => flags.has(flag)).length];
    if (state === undefined) throw new Error('Missing admitted reward state');
    chime?.setCount(state.displayCount);
    for (const reward of state.earned) {
      if (!owned.grant(reward.id) || !announce) continue;
      const last = pending[pending.length - 1]?.at ?? -Infinity;   // two charms at once (a dev jump): one toast after the other
      pending.push({ text: reward.text, at: Math.max(clock + KEEPSAKE_CONTENT.charms.delay, last + KEEPSAKE_CONTENT.charms.spacing) });
    }
  };
  syncGlass(false);
  const offGlass = flags.onChange((f) => { if (f.startsWith(SEA_GLASS_FLAG)) syncGlass(true); });
  scope?.onDispose(offGlass);

  // ── the worn things on the body shadow, built once when first worn ──
  let hat: THREE.Object3D | null = null, cape: THREE.Object3D | null = null;
  const dress = (): void => {
    const b = h.body;
    if (!b) return;
    if (owned.worn('captain-hat')) { hat ??= buildCaptainHat(ctx); b.wardrobe.wear('hat', hat); } else b.wardrobe.wear('hat', null);
    if (owned.worn('cape')) { cape ??= buildSailclothCape(ctx); b.wardrobe.wear('cape', cape); } else b.wardrobe.wear('cape', null);
  };

  // ── what you own, applied: the plaques, the perks, the wardrobe (a pickup, a purchase, a reload, a dev grant alike) ──
  const apply = (): void => {
    plaques?.setFilled('bear', owned.has('bear-claw'));
    plaques?.setFilled('boar', owned.has('boar-tusk'));
    dress();
  };
  apply();
  const offOwned = owned.onChange(apply);
  scope?.onDispose(offOwned);

  // ── the trophy drops ──
  const roster = new ClaimedPickupRoster<TrophyDropId>(KEEPSAKE_PICKUPS, {
    scene: h.game.scene, has: id => isOwnedId(id) && owned.has(id),
    model: id => id === 'captain-hat' ? buildCaptainHat(ctx) : buildTrophy(ctx, id === 'bear-claw' ? 'bear' : 'boar'),
    random: () => app.rng.stream('loot').next(), enter: (_id, drop) => { h.owner?.scope.own(drop); },
    take: id => {
      const text = KEEPSAKE_PICKUPS[id]?.toast;
      if (!isOwnedId(id) || text === undefined) throw new Error('Unknown admitted keepsake');
      owned.grant(id); if (id === 'captain-hat') owned.wear('captain-hat');
      h.hud.toast(text); sfx.interact('chime', undefined, { gain: 0.8 }); h.music.sting('pickup');
    },
  });
  const killed = (a: A): void => {
    if (practiceRoom.open) return;
    const drop = roster.death(a, h.player.position, rollLoot('trophies', a).map(row => row.item));
    if (drop === null) return;
    if (drop.floor === 'ground') drop.at.y = adv.floorAt(drop.at.x, drop.at.z);
    roster.spawn(drop.id, drop.at, true);
  };
  h.onDeath?.(killed, 30);
  // the captain dies once: a hat left lying through a reload waits at the ring's reward spot
  if (flags.has('dead:captain') && !owned.has('captain-hat') && adv.finale) roster.spawn('captain-hat', adv.finale.rewardAt, false);

  // ── per frame: the drops (walk-over), the charm toasts, charm III's glow ──
  h.game.onUpdate((dt, t) => {
    clock += dt;
    if (clock >= (pending[0]?.at ?? Infinity)) {
      const next = pending.shift();
      if (next) { h.hud.toast(next.text); sfx.interact('chime', undefined, { gain: 0.9 }); h.music.sting('pickup'); }
    }
    roster.update(dt, t, h.game.renderer, h.game.camera, h.player.position);
    const glow = owned.has(progression.glow.owned) ? curveAt(progression.glow.curve, h.sky.night) : 0;
    for (const s of h.swords) s.bladeGlow = glow;
  }, 'keepsakes');

  // dev console / capture scripts (not a URL switch)
  const dev = {
    chime, plaques, drops: roster.drops,
    /** set the beach's found sea glass to `n` (flags glass:1 … n on, the rest off) */
    glass: (n: number) => { for (let i = 1; i <= SEA_GLASS_COUNT; i++) flags.set(`${SEA_GLASS_FLAG}${i}`, i <= n); },
    /** drop a keepsake 2.5 m in front of you (the kill's toss) */
    drop: (id: TrophyDropId) => {
      const pl = h.player.position, x = pl.x - Math.sin(h.player.yaw) * 2.5, z = pl.z - Math.cos(h.player.yaw) * 2.5;
      roster.spawn(id, new THREE.Vector3(x, adv.floorAt(x, z), z), true);
    },
  };
  if (h.owner !== undefined) h.owner.debug.expose('driftwood.keepsakes', dev);
  return { chime, plaques };
}
