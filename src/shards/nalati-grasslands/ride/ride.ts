import { RidingActions } from '@wildshard/game/riding/client';
import type { TamingPrograms as RidingPrograms } from '@wildshard/game/riding/taming';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { Player } from '@wildshard/engine/player/Player';
import { registerPlayerMode } from '../runtime/playerModes';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type * as THREE from 'three';
import type { Wildlife } from '../creatures/wildlife';
import type { AdventurePersistence as NalatiPersistence } from '@wildshard/game/quest/persistence';
import { Mount as RidingMount } from '@wildshard/game/riding/mount';
import { HORSE_SPEED } from '../species/horse';
import { wildEnv } from '../creatures/env';
import { Sabre, Spear } from '../weapons/nativeMelee';

import { Bow } from '@wildshard/game/weapons/Bow';
import { Taming } from './Taming';
import type { RideHUD } from '@wildshard/game/riding/hud';
import poiLayoutRows from '../boot/poiLayout.generated.json' with { type: 'json' };
import layoutRows from '../boot/layout.generated.json' with { type: 'json' };
import { Reins } from './Reins';
import { SheepRaid } from '../creatures/shepherdView';
import { DataPanel } from '@wildshard/sdk/dataPanels';
import type { PanelDefinition } from '@wildshard/format/panelTemplate';
import { cleanHorseName } from './horseNames';
import '@wildshard/game/riding/ride.css';

export type Mount = RidingMount;

const { HITCH_HORSE_SPOTS, HITCHING_RAIL } = poiLayoutRows;
const { N_ROAD_PTS, S_ROAD_PTS, W_ROAD_PTS, E_ROAD_PTS, SKY_ROAD, CAMP_SPUR, BOWL_TRACKS, EAGLE_TRAIL, CAVE_TRAIL, ARGYMAQ_TRAIL } = layoutRows;

/** B1: the roads and tracks a horse keeps to with the stick let go (the chunk's trails: nalati-grasslands.ts `trails`) */
const ROADS = [S_ROAD_PTS, N_ROAD_PTS, E_ROAD_PTS, W_ROAD_PTS, SKY_ROAD, CAMP_SPUR, ...BOWL_TRACKS, EAGLE_TRAIL, CAVE_TRAIL, ARGYMAQ_TRAIL];
export interface RideCtx { tamingBinding: unknown; programs: RidingPrograms; namePanel: PanelDefinition; persistence?: NalatiPersistence; ctx?: LevelContext; player: Player; forest: Forest; animals: AnimalManager; wildlife: Wildlife; camera: THREE.PerspectiveCamera }
export interface RidePlay { toast: (text: string) => void }

export interface Ride {
  refuse: ((x: number, z: number) => boolean) | null;
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
  const isDrawing = (): boolean => { const weapon = ctx.ctx?.app.equipment?.current; return weapon instanceof Bow && (weapon.adsHeld || weapon.drawing); };
  const rest = HITCH_HORSE_SPOTS[0] ?? { x: HITCHING_RAIL.x - 1.9, z: HITCHING_RAIL.z, face: { x: 1, z: 0 } };
  if (ctx.ctx === undefined) throw new Error('Riding requires its level context');
  const names = ctx.persistence?.names.read() ?? {};
  const mount: Mount = new RidingMount(ctx.ctx, ctx.player, ctx.animals, { names, speeds: HORSE_SPEED, thrownDamage: 10, thrownLabel: 'Thrown from the saddle', restAt: { x: rest.x, z: rest.z }, roads: ROADS });
  for (const h of ctx.wildlife.campHorses) mount.addMountable(h.entityId, 'Camp horse');
  // SF34: the saddle is the platform's ride mode, shown on RideHUD's band (Mount enters and exits it)
  registerPlayerMode({ player: ctx.player }, { id: 'ride', hud: 'ride' }, ctx.ctx.scope);
  const taming = new Taming({
    ctx: ctx.ctx, binding: ctx.tamingBinding, programs: ctx.programs,
    ...(ctx.persistence === undefined ? {} : { bond: ctx.persistence.bond }),
    player: ctx.player, mount, animals: ctx.animals, herds: ctx.wildlife.herds, rest,
    toast: (t) => { play?.toast(t); },
  });
  const controls = new RidingActions(ctx.ctx, mount, taming.owner, ctx.player, ctx.camera, ctx.animals, {
    herds: 'nalati.herds', program: ctx.programs.riding, rail: HITCHING_RAIL, tagRange: 30, tagHeight: 2.35,
    labels: { name: 'Name', panic: ' panics at the lightning — hold on', thrown: 'Thrown!', bolt: ' bolts for the camp — it needs a rest' }, squeal: 'horse_squeal' });
  const hud = controls.hud;
  // B1: the reins (from the hands just under the frame along the neck to the bit, E320); they drop while the bow draws or the stallion bucks
  const reins = new Reins(ctx.camera, ctx.ctx.scope);
  // B1: wolves raiding the flock, the mounted shepherd
  const raid = new SheepRaid({ animals: ctx.animals, wildlife: ctx.wildlife, toast: (t) => { play?.toast(t); } });

  // B1: NAME at the hitching rail — the horse standing nearest you by the rail, on foot
  const namer = new DataPanel(ctx.namePanel);
  ctx.ctx.scope.onDispose(() => { namer.close(); });
  const ride: Ride = {
    refuse: null, mount, taming, hud, interactable: controls.interactable, reins, raid,
    get mounted() { return mount.mounted; },
    bind(p) { play = p; },
    update(dt) {
      const ahead = 2 + mount.speed * 0.4;
      controls.advanceMount(dt, wildEnv.wetAt?.(mount.feet.x, mount.feet.z) === true,
        ride.refuse?.(mount.feet.x + Math.sin(mount.heading) * ahead, mount.feet.z + Math.cos(mount.heading) * ahead) === true);
      wildEnv.playerMounted = mount.mounted;
      taming.update(dt);
      controls.observe(dt, namer.isOpen);
      for (const event of controls.drainEvents()) {
        if (event.kind === 'notice') play?.toast(event.text);
        else namer.open({ current: event.current }, new Map([['save', value => {
          if (typeof value !== 'string') throw new Error('Name input requires text');
          const name = cleanHorseName(value); if (name.length > 0) { mount.rename(event.actor, name); ctx.persistence?.names.write(names); play?.toast(`Your horse is ${name}`); }
        }]]));
      }
      raid.update(dt, ctx.player.position);
    },
    late(dt) {
      const state = mount.mounted ? { speed: mount.speed, yaw: mount.heading - Math.PI } : null;
      for (const weapon of ctx.ctx?.app.equipment?.available ?? []) { if (weapon instanceof Bow) { weapon.setMount(state); if (mount.gallopFloat) weapon.extraSpreadDeg *= 0.5; } else if (weapon instanceof Sabre || weapon instanceof Spear) weapon.mount = state; }
      const busy = mount.breaking || isDrawing();
      reins.update(dt, mount.horse, mount.mounted, busy);
    },
    noteShot(x, z) { taming.noteShot(x, z); },
  };
  return ride;
}
