import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager, AnimalSound } from '@wildshard/engine/entities/AnimalManager';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { Player } from '@wildshard/engine/player/Player';
import { registerPlayerMode } from '@wildshard/sdk/playerModes';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import * as THREE from 'three';
import type { Wildlife } from '../creatures/wildlife';
import type { NalatiPersistence } from '../runtime/persistence';
import { Mount } from './Mount';
import { Bow } from '@wildshard/game/weapons/Bow';
import { Taming } from './Taming';
import { RideHUD } from './RideHUD';
import { HITCH_HORSE_SPOTS, HITCHING_RAIL } from '../world/layout';
import { N_ROAD_PTS, S_ROAD_PTS, W_ROAD_PTS, E_ROAD_PTS, SKY_ROAD, CAMP_SPUR, BOWL_TRACKS, EAGLE_TRAIL, CAVE_TRAIL, ARGYMAQ_TRAIL } from '../layout';
import { Reins } from './Reins';
import { SheepRaid } from '../creatures/sheepRaid';
import { HorseNamePrompt } from './HorseNamePrompt';

/** B1: the roads and tracks a horse keeps to with the stick let go (the chunk's trails: nalati-grasslands.ts `trails`) */
const ROADS = [S_ROAD_PTS, N_ROAD_PTS, E_ROAD_PTS, W_ROAD_PTS, SKY_ROAD, CAMP_SPUR, ...BOWL_TRACKS, EAGLE_TRAIL, CAVE_TRAIL, ARGYMAQ_TRAIL];
/** B1: the NAME prompt at the rail: at the tied horse's head (its reach, from the eye), for a horse within NAME_HORSE of
 *  the rail — at its head, not its flank (MOUNT) and not the rail's far side (Erlan's TALK) */
const NAME_REACH = 1.9, NAME_HORSE = 5, NAME_HEAD = 1.15;
/** B1: lightning within this many metres panics the horse under you (s: nearer, longer) */
const BOLT_PANIC = 35;

/**
 * The riding + taming wiring (Nalati rows B7 / B8) — one call from src/shards/nalati-grasslands/index.ts once the animals exist:
 *
 *   const ride = wireRide({ player, forest, animals, wildlife, camera });
 *   interactables.push(ride.interactable)   // main.ts: ONE prompt that is always the nearest horse action —
 *                                           //   "Mount Camp horse" / "Mount Tulpar" / "Dismount" / "Mount the stallion"
 *   ride.bind({ toast })                     // once the HUD exists; combat owns damage
 *   ride.update(dt)                          // every frame
 *   game.onLate((dt) => ride.late(dt))       // B1: the reins in your hand, from this frame's final horse pose + camera
 *   ride.noteShot(x, z)                      // an arrow / javelin landed (TRUST)
 *   ride.mounted                             // for Wildlife's `extra.mounted` (the pack's two tokens, the herd's stampede)
 *
 * The camp's two saddled horses at the hitching rail are mountable from the start (so riding is testable before any
 * taming); TULPAR joins them once tamed (or on load, if tamed in an earlier session).
 *
 * B1 (N13): the horse under you panics (Mount.panic) at a wolf's bite on the rider (Pack's 'rider-bitten' event) and at
 * lightning within 35 m (Wildlife.scare's 'scare' event, which every storm strike raises, and the Storm Titan's own
 * 'lightning' bolts) — a squeal, a toast for the lightning.
 * Mount keeps to the shard's roads (`ROADS`) when you let go of the stick. At the hitching rail, on foot, a NAME prompt
 * names the horse standing nearest you there (HorseNamePrompt; the name is saved, horseNames.ts).
 */
/** a species' own voice through the manager's sound hook (its names are the species' — AnimalManager's `c.sound` does the same) */
function voice(name: string): AnimalSound { return name; }

export interface RideCtx { persistence?: NalatiPersistence; ctx?: LevelContext; player: Player; forest: Forest; animals: AnimalManager; wildlife: Wildlife; camera: THREE.PerspectiveCamera }
export interface RidePlay { toast: (text: string) => void }

export interface Ride {
  mount: Mount;
  taming: Taming;
  hud: RideHUD;
  interactable: Interactable;
  readonly mounted: boolean;
  bind: (p: RidePlay) => void;
  update: (dt: number) => void;
  /** after every updater (Game.onLate): the reins (Reins.ts) from the horse's final pose and the saddle's camera */
  late: (dt: number) => void;
  reins: Reins;
  /** B1: the wolves' raids on the flock and the mounted shepherd who defends it (sheepRaid.ts) */
  raid: SheepRaid;
  noteShot: (x: number, z: number) => void;
}

export function wireRide(ctx: RideCtx): Ride {
  let play: RidePlay | null = null;
  const hurt = (d: number): void => {
    const player = ctx.ctx?.app.player;
    if (player && ctx.ctx) ctx.ctx.app.combat.hit({ source: 'env', sourceTags: ['env.ride'], target: player, amount: d, throughWalls: true,
      point: ctx.player.position, dir: new THREE.Vector3(),
      cause: { kind: 'env.ride', label: ctx.ctx.app.levelRegistrations.text('cause.ride', ctx.ctx.scope),
        text: ctx.ctx.app.levelRegistrations.text('cause.ride.text', ctx.ctx.scope) } });

  };
  const isDrawing = (): boolean => { const weapon = ctx.ctx?.app.equipment?.current; return weapon instanceof Bow && (weapon.adsHeld || weapon.drawing); };
  const rest = HITCH_HORSE_SPOTS[0] ?? { x: HITCHING_RAIL.x - 1.9, z: HITCHING_RAIL.z, face: { x: 1, z: 0 } };
  const mount = new Mount({
    player: ctx.player, forest: ctx.forest,
    ...(ctx.persistence === undefined ? {} : { names: ctx.persistence.horseNames }),
    isDrawing,
    hurt: (d) => { hurt(d); },
    restAt: { x: rest.x, z: rest.z },
    roads: ROADS,
  });
  for (const h of ctx.wildlife.campHorses) mount.addMountable(h, 'Camp horse');
  const hud = new RideHUD(mount, ctx.camera, ctx.ctx);
  // SF34: the saddle is the platform's ride mode, shown on RideHUD's band (Mount enters and exits it)
  if (ctx.ctx !== undefined) registerPlayerMode({ player: ctx.player }, { id: 'ride', hud: 'ride' }, ctx.ctx.scope);
  const taming = new Taming({
    ...(ctx.persistence === undefined ? {} : { bond: ctx.persistence.bond }),
    player: ctx.player, mount, animals: ctx.animals, hud, herds: () => ctx.wildlife.herds, rest,
    hurt: (d) => { hurt(d); }, toast: (t) => { play?.toast(t); },
  });
  mount.onBolt = (_a, name) => { play?.toast(`${name} bolts for the camp — it needs a rest`); };
  mount.onThrown = () => { play?.toast('Thrown!'); };
  // B1: the panic — a wolf's bite on the rider, lightning close by (chained after Taming's and the HUD's own listeners)
  mount.onPanic = (h) => { ctx.animals.onSound?.(voice('horse_squeal'), h.position); };
  ctx.ctx?.on('creature.signal', ({ name, x, z }) => {
    taming.noteEvent(name, x, z);
    const h = mount.horse;
    if (h === null) return;
    if (name === 'rider-bitten') mount.panic(x, z, 0.9);
    else if (name === 'scare' || name === 'lightning') {   // a strike (Wildlife.scare) · the Storm Titan's bolts (stormTitan.ts)
      // the steppe's storm strikes the grass 3 km under a practice room (the horse track rides over the same x / z): not near (E353)
      if (practiceRoom.open) return;
      const d = Math.hypot(h.position.x - x, h.position.z - z);
      if (d < BOLT_PANIC && mount.panic(x, z, d < 12 ? 2.2 : 1.5)) play?.toast(`${h.label} panics at the lightning — hold on`);
    }
  });

  // B1: the reins (from the hands just under the frame along the neck to the bit, E320); they drop while the bow draws or the stallion bucks
  const reins = new Reins(ctx.camera, ctx.ctx?.scope);
  // B1: wolves raiding the flock, the mounted shepherd
  const raid = new SheepRaid({ animals: ctx.animals, wildlife: ctx.wildlife, toast: (t) => { play?.toast(t); } });

  // B1: NAME at the hitching rail — the horse standing nearest you by the rail, on foot
  const namer = new HorseNamePrompt();
  ctx.ctx?.scope.onDispose(() => { namer.close(); });
  let naming: Animal | null = null;
  const nameIt: Interactable = {
    position: new THREE.Vector3(HITCHING_RAIL.x, 0, HITCHING_RAIL.z), radius: 0, label: 'Name',
    onInteract: () => { const a = naming; if (a !== null) namer.open(mount.nameOf(a) ?? a.label, (n) => { mount.rename(a, n); play?.toast(`Your horse is ${n}`); }); },
  };
  const nameUpdate = (): void => {
    naming = null;
    nameIt.radius = 0;
    if (mount.mounted || namer.isOpen) return;
    const p = ctx.player.position;
    let bd = Infinity;
    for (const m of mount.mountables) {
      if (!m.a.alive || Math.hypot(m.a.position.x - HITCHING_RAIL.x, m.a.position.z - HITCHING_RAIL.z) > NAME_HORSE) continue;
      const d = Math.hypot(m.a.position.x - p.x, m.a.position.z - p.z);
      if (d < bd) { bd = d; naming = m.a; }
    }
    if (naming === null) return;
    const a = naming, hx = a.position.x + Math.sin(a.yaw) * NAME_HEAD * a.scale, hz = a.position.z + Math.cos(a.yaw) * NAME_HEAD * a.scale;
    nameIt.position.set(hx, heightAt(hx, hz) + 1.5, hz);
    nameIt.radius = NAME_REACH;
    nameIt.label = `Name ${mount.nameOf(naming) ?? naming.label}`;
  };

  // one prompt for main's list: whichever horse action is nearest the camera (it copies that one's position / label)
  const ix: Interactable = { position: new THREE.Vector3(0, -1e4, 0), radius: 0, label: '', onInteract: () => undefined };
  let pick: Interactable | null = null;
  ix.onInteract = () => { pick?.onInteract(); };
  const choose = (): void => {
    const cam = ctx.camera.position;
    let best: Interactable | null = null, bd = Infinity;
    const n = mount.interactables.length;
    for (let i = 0; i <= n + 1; i++) {
      const it = i < n ? mount.interactables[i] : i === n ? taming.interactable : nameIt;
      if (it === undefined || it.radius <= 0) continue;
      const d = it.position.distanceTo(cam);
      if (d < it.radius && d < bd) { bd = d; best = it; }
    }
    pick = best;
    if (best === null) { ix.radius = 0; ix.position.set(0, -1e4, 0); return; }
    ix.position.copy(best.position); ix.radius = best.radius; ix.label = best.label;
    // in the saddle the horse prompts (Dismount) give way to any other prompt in reach — the Wind Cairn's tie (E288)
    ix.weak = mount.mounted && best !== taming.interactable;
  };

  return {
    mount, taming, hud, interactable: ix, reins, raid,
    get mounted() { return mount.mounted; },
    bind(p) { play = p; },
    update(dt) {
      mount.update(dt);
      taming.update(dt);
      hud.update(taming.view);
      raid.update(dt, ctx.player.position);
      nameUpdate();
      choose();
    },
    late(dt) {
      const busy = mount.breaking || isDrawing();
      reins.update(dt, mount.horse, mount.mounted, busy);
    },
    noteShot(x, z) { taming.noteShot(x, z); },
  };
}
