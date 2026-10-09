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
 *     carries you does nothing (dodge i-frames; the damage rules read `perks.dodgeGuard`).
 *   - The captain's hat (board 4 C): the Drowned Captain's death drops it (gold orb) between you and where he fell; taking
 *     it grants captain-hat and puts it on. GEAR wears it / takes it off; FINDS shows it with the trophies. Left lying and
 *     the game reloaded, it waits at the ring's reward spot (he only dies once).
 *   - Worn cosmetics (the hat, the trader's cape) dress the body shadow (src/game/cosmetics/bodyShadow.ts), following GEAR.
 *
 * Wired in main.ts on Driftwood (after installLoot; the damage rules read `perks.dodgeGuard` + `player.dodging`).
 * Seen in the game: scripts/e314-keepsakes-capture.mjs, progress/294-e314-keepsakes-stage3.jpg.
 *
 *   installKeepsakes({ owned, adventure, sky, game, player, animals, hud, audio, music, swords, body, registry })
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
import { ItemPickup, type PickupTier } from '@wildshard/engine/player/WeaponPickup';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { islandTrophies } from './tables';
import { seaGlassChime, SeaGlassChime } from '../models/seaGlassChime';
import { buildTrophy, trophyPlaques, TrophyPlaques } from '../models/trophyPlaques';
import { buildCaptainHat } from '../models/captainHat';
import { buildSailclothCape } from '../models/sailclothCape';
import { SEA_GLASS_COUNT, SEA_GLASS_FLAG } from '../quest/interactables';
import type { Adventure } from '../quest/adventure';
import { ownEnteredTree } from '../quest/Spine';
import type { BodyShadow } from '@wildshard/game/cosmetics/bodyShadow';
import type { Owned } from '@wildshard/game/loot/Owned';
import type { ShardContext } from '@wildshard/game/shard/context';
import { seaGlassFound } from './finds';
import { charmsFor, chimeCount, dodgeCooldownScale, heavyMult, nightGlow } from './perks';

export type TrophyDropId = 'bear-claw' | 'boar-tusk' | 'captain-hat';
/** which death drops which keepsake (while you don't own it) */
export function trophyFor(a: { kind: string; variant?: string | undefined }): TrophyDropId | null {
  const id = islandTrophies(a)[0];
  return id === 'bear-claw' || id === 'boar-tusk' || id === 'captain-hat' ? id : null;
}

const CHARM_TOAST: Record<'charm-1' | 'charm-2' | 'charm-3', string> = {
  'charm-1': 'Sea glass charm I · +10 max health — it hangs in Wendell\'s doorway',
  'charm-2': 'Sea glass charm II · your dodge recharges faster',
  'charm-3': 'Sea glass charm III · your sword glows at night',
};
const DROP: Record<TrophyDropId, { tier: PickupTier; scale: number; toast: string }> = {
  'bear-claw': { tier: 'rare', scale: 1.7, toast: 'Bear claw · your heavy attack hits 20 % harder — it hangs in Wendell\'s hut' },
  'boar-tusk': { tier: 'rare', scale: 2.4, toast: 'Boar tusk · no hit lands while you dodge — it hangs in Wendell\'s hut' },
  'captain-hat': { tier: 'legendary', scale: 1.7, toast: 'Captain\'s hat · you wear it now (GEAR to take it off)' },
};
/** walk-over reach (m, feet to the drop, flat) and the height band it counts in */
const TAKE_R = 1.4, TAKE_DY = 2;
/** a charm's toast waits for the adventure's own "Sea glass · n / 15" */
const CHARM_DELAY = 1.3;

/** hut-local spots (the hut's own frame: the door at −z, its wall at z = −2.7; the back wall at +2.7; the floor is the
 *  door anchor's y). The chime (Jake's look review 2026-09-30: "over Wendell's doorway, larger — as board 3 C, seen every
 *  time you walk up") hangs on the door's centre line just outside the lintel batten (z −2.72 … −2.81), 1.25× the model,
 *  its hook up under the porch thatch (the eave skirt's underside is ~3.46 m over the floor there, hut.ts `hip`; the top
 *  of the cord runs into it): its lowest piece ends ~2.2 m over the floor (measured: scripts/e334-look-review-capture.mjs),
 *  clear of the door opening (its top 2.07 m, under the 2.14 m lintel) — no one walks into it — and of the door lantern
 *  (x +0.9) and the trader's stall (x −3.3, z −7.8). Stage 3 hung it left of the door in front of the window shutter. The
 *  plaques on the back wall's inner face, between the shelves (left) and the chest (below right). */
const CHIME = { x: 0, z: -2.95, up: 3.55, scale: 1.25 };
const PLAQUES = { x: 0.3, z: 2.655, up: 1.3, scale: 1.5 };

export interface KeepsakeAnimal { kind: string; variant?: string | undefined; position: THREE.Vector3 }
export interface KeepsakeHost<A extends KeepsakeAnimal> {
  owner?: ShardContext;
  onDeath?: (run: (animal: A) => void, order: number) => void;
  owned: Owned;
  adventure: Adventure;
  sky: Sky;
  game: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: Renderer; onUpdate: (fn: (dt: number, t: number) => void, label?: string) => void };
  player: { position: THREE.Vector3; yaw: number; dodgeCooldownScale: number };
  hud: { toast: (text: string) => void };
  audio: Audio;
  music: { sting: (name: 'pickup' | 'death' | 'chunk') => void };
  /** the island's swords (wooden, iron): the claw's heavy and charm III's glow */
  swords: readonly { heavyMult: number; bladeGlow: number }[];
  /** C5 applies the perks to live attributes once, before these presentation hooks. */
  effectsManaged?: boolean;
  /** the body shadow (ShardManifest.bodyShadow): the worn hat and cape ride on it */
  body: BodyShadow | null;
  registry?: WorldRegistry | undefined;
}
export interface Keepsakes {
  chime: SeaGlassChime | null;
  plaques: TrophyPlaques | null;
}

export function installKeepsakes<A extends KeepsakeAnimal>(h: KeepsakeHost<A>): Keepsakes {
  const { owned, adventure: adv } = h;
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
  const c = adv.place({ poi: 'hut', x: CHIME.x, z: CHIME.z, y: floor + CHIME.up });
  const chimeObj = entered(() => place(seaGlassChime, [{ x: c.x, y: c.y, z: c.z, yaw: c.yaw, scale: CHIME.scale, params: { count: 0 } }], { ctx, draw: 'single', ...registry, piece: { id: 'sea-glass-chime', name: 'Sea glass wind chime' } }).object);
  const chime = chimeObj instanceof SeaGlassChime ? chimeObj : null;
  const p = adv.place({ poi: 'hut', x: PLAQUES.x, z: PLAQUES.z, y: floor + PLAQUES.up, yaw: Math.PI });
  const plaquesObj = entered(() => place(trophyPlaques, [{ x: p.x, y: p.y, z: p.z, yaw: p.yaw, scale: PLAQUES.scale, params: { bear: false, boar: false } }], { ctx, draw: 'single', ...registry, piece: { id: 'trophy-plaques', name: 'Trophy plaques' } }).object);
  const plaques = plaquesObj instanceof TrophyPlaques ? plaquesObj : null;

  // ── the charms: the found count → the chime's pieces and the charms owned ──
  const pending: { text: string; at: number }[] = [];
  let clock = 0;
  const found = (): number => seaGlassFound(flags).filter(Boolean).length;
  const syncGlass = (announce: boolean): void => {
    const n = found();
    chime?.setCount(chimeCount(n));
    for (const id of charmsFor(n)) {
      if (!owned.grant(id) || !announce) continue;
      const last = pending[pending.length - 1]?.at ?? -Infinity;   // two charms at once (a dev jump): one toast after the other
      pending.push({ text: CHARM_TOAST[id], at: Math.max(clock + CHARM_DELAY, last + 2.2) });
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
    if (h.effectsManaged !== true) {
      h.player.dodgeCooldownScale = dodgeCooldownScale(owned);
      for (const s of h.swords) s.heavyMult = heavyMult(owned);
    }
    dress();
  };
  apply();
  const offOwned = owned.onChange(apply);
  scope?.onDispose(offOwned);

  // ── the trophy drops ──
  const drops = new Map<TrophyDropId, ItemPickup>();
  /** taken drops still playing their collapse + shockwave (ItemPickup disposes itself at the end; a few seconds' grace) */
  const fading: { drop: ItemPickup; left: number }[] = [];
  const itemFor = (id: TrophyDropId): THREE.Object3D => (id === 'captain-hat' ? buildCaptainHat(ctx) : buildTrophy(ctx, id === 'bear-claw' ? 'bear' : 'boar'));
  const spawnDrop = (id: TrophyDropId, at: THREE.Vector3, toss: boolean): void => {
    if (owned.has(id) || drops.has(id)) return;
    const item = itemFor(id), d = DROP[id];
    const a = app.rng.stream('loot').next() * Math.PI * 2;
    const drop = new ItemPickup({
      scene: h.game.scene, item, position: at.clone(), tier: d.tier, scale: d.scale, glow: false, tilt: id === 'captain-hat' ? 0.15 : 0.1,
      ...(toss ? { toss: { x: Math.sin(a) * 1.1, y: 3.4, z: Math.cos(a) * 1.1 } } : {}),
    });
    h.owner?.scope.own(drop);
    drop.onPickup = () => {
      drops.delete(id);
      fading.push({ drop, left: 5 });
      item.traverse((o) => { if ((o as Partial<THREE.Mesh>).isMesh === true) (o as THREE.Mesh).geometry.dispose(); }); // hidden at once; the orb's burst plays on
      owned.grant(id);
      if (id === 'captain-hat') owned.wear('captain-hat');
      h.hud.toast(d.toast);
      sfx.interact('chime', undefined, { gain: 0.8 });
      h.music.sting('pickup');
    };
    drops.set(id, drop);
  };
  const killed = (a: A): void => {
    if (practiceRoom.open) return;
    const id = trophyFor(a);
    if (id === null || owned.has(id)) return;
    if (id === 'captain-hat') {
      // he sinks into the spring pool: the hat lands on your side of it, a step and a half toward where he fell
      const pp = h.player.position, d = Math.hypot(a.position.x - pp.x, a.position.z - pp.z), k = d > 1e-3 ? Math.min(1, 1.5 / d) : 0;
      const x = pp.x + (a.position.x - pp.x) * k, z = pp.z + (a.position.z - pp.z) * k;
      spawnDrop(id, new THREE.Vector3(x, adv.floorAt(x, z), z), true);
    } else spawnDrop(id, a.position, true);
  };
  h.onDeath?.(killed, 30);
  // the captain dies once: a hat left lying through a reload waits at the ring's reward spot
  if (flags.has('dead:captain') && !owned.has('captain-hat') && adv.finale) spawnDrop('captain-hat', adv.finale.rewardAt, false);

  // ── per frame: the drops (walk-over), the charm toasts, charm III's glow ──
  h.game.onUpdate((dt, t) => {
    clock += dt;
    if (clock >= (pending[0]?.at ?? Infinity)) {
      const next = pending.shift();
      if (next) { h.hud.toast(next.text); sfx.interact('chime', undefined, { gain: 0.9 }); h.music.sting('pickup'); }
    }
    const pl = h.player.position;
    for (let i = fading.length - 1; i >= 0; i--) {
      const f = fading[i];
      if (f === undefined) continue;
      f.drop.update(dt, t, h.game.renderer, h.game.camera);
      if ((f.left -= dt) <= 0) fading.splice(i, 1);
    }
    for (const [, drop] of drops) {
      drop.update(dt, t, h.game.renderer, h.game.camera);
      const g = drop.group.position;
      if (Math.hypot(g.x - pl.x, g.z - pl.z) < TAKE_R && Math.abs(g.y - pl.y) < TAKE_DY) drop.take();
    }
    const glow = nightGlow(owned, h.sky.night);
    for (const s of h.swords) s.bladeGlow = glow;
  }, 'keepsakes');

  // dev console / capture scripts (not a URL switch)
  const dev = {
    chime, plaques, drops,
    /** set the beach's found sea glass to `n` (flags glass:1 … n on, the rest off) */
    glass: (n: number) => { for (let i = 1; i <= SEA_GLASS_COUNT; i++) flags.set(`${SEA_GLASS_FLAG}${i}`, i <= n); },
    /** drop a keepsake 2.5 m in front of you (the kill's toss) */
    drop: (id: TrophyDropId) => {
      const pl = h.player.position, x = pl.x - Math.sin(h.player.yaw) * 2.5, z = pl.z - Math.cos(h.player.yaw) * 2.5;
      spawnDrop(id, new THREE.Vector3(x, adv.floorAt(x, z), z), true);
    },
  };
  if (h.owner !== undefined) h.owner.debug.expose('driftwood.keepsakes', dev);
  return { chime, plaques };
}
