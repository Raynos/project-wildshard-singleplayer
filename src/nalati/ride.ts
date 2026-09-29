import * as THREE from 'three';
import type { Player } from '../player/Player';
import type { Forest } from '../world/Forest';
import type { AnimalManager, AnimalSound } from '../entities/AnimalManager';
import type { Wildlife } from '../entities/Wildlife';
import type { Interactable } from '../world/Cabin';
import { Mount, type MountKit } from '../player/Mount';
import { Taming } from '../game/Taming';
import { RideHUD } from '../ui/RideHUD';
import { HITCH_HORSE_SPOTS, HITCHING_RAIL } from '../world/nalati/layout';
import { N_ROAD_PTS, S_ROAD_PTS, W_ROAD_PTS, E_ROAD_PTS, SKY_ROAD, CAMP_SPUR, BOWL_TRACKS, EAGLE_TRAIL, CAVE_TRAIL, ARGYMAQ_TRAIL } from '../chunks/nalatiLayout';
import { wildEnv } from '../entities/wildEnv';

/** B1: the roads and tracks a horse keeps to with the stick let go (the chunk's trails: nalati-grasslands.ts `trails`) */
const ROADS = [S_ROAD_PTS, N_ROAD_PTS, E_ROAD_PTS, W_ROAD_PTS, SKY_ROAD, CAMP_SPUR, ...BOWL_TRACKS, EAGLE_TRAIL, CAVE_TRAIL, ARGYMAQ_TRAIL];
/** B1: lightning within this many metres panics the horse under you (s: nearer, longer) */
const BOLT_PANIC = 35;

/**
 * The riding + taming wiring (Nalati rows B7 / B8) — one call from src/nalati/index.ts once the animals exist:
 *
 *   const ride = wireRide({ player, forest, animals, wildlife, camera });
 *   interactables.push(ride.interactable)   // main.ts: ONE prompt that is always the nearest horse action —
 *                                           //   "Mount Camp horse" / "Mount Tulpar" / "Dismount" / "Mount the stallion"
 *   ride.bind({ kit, toast })                // once the weapon kit + HUD exist (nalati.bindPlay); hurt → animals.onCharge
 *   ride.update(dt)                          // every frame
 *   ride.noteShot(x, z)                      // an arrow / javelin landed (TRUST)
 *   ride.mounted                             // for Wildlife's `extra.mounted` (the pack's two tokens, the herd's stampede)
 *
 * The camp's two saddled horses at the hitching rail are mountable from the start (so riding is testable before any
 * taming); TULPAR joins them once tamed (or on load, if tamed in an earlier session).
 *
 * B1 (N13): the horse under you panics (Mount.panic) at a wolf's bite on the rider (Pack's 'rider-bitten' event) and at
 * lightning within 35 m (Wildlife.scare's 'scare' event, which every strike raises) — a squeal, a toast for the lightning.
 * Mount keeps to the shard's roads (`ROADS`) when you let go of the stick.
 */
/** a species' own voice through the manager's sound hook (its names are the species' — AnimalManager's `c.sound` does the same) */
function voice(name: string): AnimalSound { return name as AnimalSound; }

export interface RideCtx { player: Player; forest: Forest; animals: AnimalManager; wildlife: Wildlife; camera: THREE.PerspectiveCamera }
/** `hurt` defaults to the animals' onCharge (main.ts's damage path); `isDrawing` to the kit bow's DRAW latch / draw */
export interface RidePlay { kit: (MountKit & { bow: { drawing: boolean; adsHeld: boolean } }) | null; toast: (text: string) => void; hurt?: (damage: number) => void; isDrawing?: () => boolean }

export interface Ride {
  mount: Mount;
  taming: Taming;
  hud: RideHUD;
  interactable: Interactable;
  readonly mounted: boolean;
  bind: (p: RidePlay) => void;
  update: (dt: number) => void;
  noteShot: (x: number, z: number) => void;
}

export function wireRide(ctx: RideCtx): Ride {
  let play: RidePlay | null = null;
  const hurt = (d: number): void => {
    if (play?.hurt !== undefined) { play.hurt(d); return; }
    const a = ctx.animals.animals[0];
    if (a !== undefined) ctx.animals.onCharge?.(a, d);   // main.ts's damage path (health, flash, sound)
  };
  const rest = HITCH_HORSE_SPOTS[0] ?? { x: HITCHING_RAIL.x - 1.9, z: HITCHING_RAIL.z, face: { x: 1, z: 0 } };
  const mount = new Mount({
    player: ctx.player, forest: ctx.forest,
    isDrawing: () => { const b = play?.kit?.bow; return play?.isDrawing?.() ?? (b !== undefined && (b.adsHeld || b.drawing)); },
    hurt: (d) => { hurt(d); },
    restAt: { x: rest.x, z: rest.z },
    roads: ROADS,
  });
  for (const h of ctx.wildlife.campHorses) mount.addMountable(h, 'Camp horse');
  const hud = new RideHUD(mount, ctx.camera);
  const taming = new Taming({
    player: ctx.player, mount, animals: ctx.animals, hud, herds: () => ctx.wildlife.herds, rest,
    hurt: (d) => { hurt(d); }, toast: (t) => { play?.toast(t); },
  });
  mount.onBolt = (_a, name) => { play?.toast(`${name} bolts for the camp — it needs a rest`); };
  mount.onThrown = () => { play?.toast('Thrown!'); };
  // B1: the panic — a wolf's bite on the rider, lightning close by (chained after Taming's and the HUD's own listeners)
  mount.onPanic = (h) => { ctx.animals.onSound?.(voice('horse_squeal'), h.position); };
  const prevEvent = wildEnv.onEvent;
  wildEnv.onEvent = (name, x, z) => {
    prevEvent?.(name, x, z);
    const h = mount.horse;
    if (h === null) return;
    if (name === 'rider-bitten') mount.panic(x, z, 0.9);
    else if (name === 'scare') {
      const d = Math.hypot(h.position.x - x, h.position.z - z);
      if (d < BOLT_PANIC && mount.panic(x, z, d < 12 ? 2.2 : 1.5)) play?.toast(`${h.label} panics at the lightning — hold on`);
    }
  };

  // one prompt for main's list: whichever horse action is nearest the camera (it copies that one's position / label)
  const ix: Interactable = { position: new THREE.Vector3(0, -1e4, 0), radius: 0, label: '', onInteract: () => undefined };
  let pick: Interactable | null = null;
  ix.onInteract = () => { pick?.onInteract(); };
  const choose = (): void => {
    const cam = ctx.camera.position;
    let best: Interactable | null = null, bd = Infinity;
    const n = mount.interactables.length;
    for (let i = 0; i <= n; i++) {
      const it = i < n ? mount.interactables[i] : taming.interactable;
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
    mount, taming, hud, interactable: ix,
    get mounted() { return mount.mounted; },
    bind(p) { play = p; mount.setKit(p.kit); },
    update(dt) {
      mount.update(dt);
      taming.update(dt);
      hud.update(taming.view);
      choose();
    },
    noteShot(x, z) { taming.noteShot(x, z); },
  };
}
