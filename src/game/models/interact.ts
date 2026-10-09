/**
 * The interactables' models (E306 / E315 M1; the kit's since E405 E417): every thing a quest table puts in the world
 * for you to open, pull, press, light or sit on — the sea chest (banded chest, iron strongbox, treasure chest), the
 * hold key, a door (plank, grate, sluice), a lever, a pressure plate, the puzzle barrel, the beacon's brazier, a bench
 * and the glyph altar — built from the shared props (../systems/props/interact.ts). The engine's interaction runtime
 * (src/engine/world/interact/Interactables.ts) places each kind's rows as these models, drawn into its lit / glow
 * batches; `installKitProps` hands it both. A specimen is the thing at rest, closed, its parts posed as the runtime
 * poses them there; a glowing part is drawn unlit, as in the world.
 */
import * as THREE from 'three';
import { pickup } from '@wildshard/engine/models/interact';
import { defineModel } from '@wildshard/engine/models/model';
import { interactParts } from '@wildshard/engine/world/interact/kit';
import { registerInteractProps, type ChestLook, type DoorLook, type InteractProps } from '@wildshard/engine/world/interact/types';
import * as Mdl from '../systems/props/interact';

const { lit, glow } = interactParts;
const FILE = 'src/game/models/interact.ts';
const SEED = 0x1a7e;
type Look = ChestLook;
const at = (x: number, y: number, z: number, rx = 0): THREE.Matrix4 =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(1, 1, 1));

export interface ChestParams { readonly look: Look; readonly locked: boolean }
export const seaChest = defineModel<ChestParams>({
  id: 'shared/sea-chest', name: 'Sea chest', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: { look: 'chest', locked: false },
  variants: [
    { id: 'chest', label: 'Chest', params: {} }, { id: 'strongbox', label: 'Strongbox', params: { look: 'strongbox', locked: true } },
    { id: 'treasure', label: 'Treasure', params: { look: 'treasure' } },
  ],
  build: (ctx, p) => {
    const D = Mdl.CHEST_DIMS[p.look];
    const parts = [lit(ctx, Mdl.chestBase(p.look, SEED)), lit(ctx, Mdl.chestLid(p.look, SEED + 1), at(0, D.h, -D.d / 2))];
    if (p.locked) parts.push(lit(ctx, Mdl.padlock(SEED + 2), at(0, D.h - 0.12, D.d / 2 + 0.05)));
    return parts;
  },
});

export const holdKey = pickup('shared/hold-key', 'Key', 0.9, (ctx) => [glow(ctx, Mdl.keyModel(SEED))], FILE);

export interface DoorParams { readonly look: DoorLook; readonly w: number; readonly h: number }
export const door = defineModel<DoorParams>({
  id: 'shared/door', name: 'Door', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: { look: 'plank', w: 1.1, h: 2 },
  variants: [
    { id: 'plank', label: 'Plank', params: {} }, { id: 'grate', label: 'Grate', params: { look: 'grate', w: 1.4, h: 1.9 } },
    { id: 'sluice', label: 'Sluice', params: { look: 'sluice', w: 2.5, h: 2.2 } },
  ],
  // closed: a plank door's panel hangs from its hinge edge, a grate / sluice leaf stands in its frame
  build: (ctx, p) => [lit(ctx, Mdl.doorFrame(p.look, p.w, p.h, SEED)), lit(ctx, Mdl.doorPanel(p.look, p.w, p.h, SEED + 1), p.look === 'plank' ? at(-p.w / 2, 0, 0) : undefined)],
});

export const lever = defineModel<Record<string, never>>({
  id: 'shared/lever', name: 'Lever', category: 'props', pipeline: 'code', file: FILE, surface: 'wood', defaults: {},
  build: (ctx) => [lit(ctx, Mdl.leverBase(SEED)), lit(ctx, Mdl.leverHandle(SEED + 1), at(0, 0.34, 0, 0.7))],
});

export interface PlateParams { readonly size: number }
export const pressurePlate = defineModel<PlateParams>({
  id: 'shared/pressure-plate', name: 'Pressure plate', category: 'props', pipeline: 'code', file: FILE, surface: 'stone', defaults: { size: 1.4 },
  build: (ctx, p) => [lit(ctx, Mdl.plateRim(p.size, SEED)), lit(ctx, Mdl.plateSlab(p.size, SEED + 1))],
});

export const puzzleBarrel = defineModel<Record<string, never>>({
  id: 'shared/puzzle-barrel', name: 'Puzzle barrel', category: 'props', pipeline: 'code', file: FILE, surface: 'wood', defaults: {},
  build: (ctx) => [lit(ctx, Mdl.barrel(SEED))],
});

export const beacon = defineModel<Record<string, never>>({
  id: 'shared/beacon', name: 'Beacon', category: 'props', pipeline: 'code', file: FILE, surface: 'stone', defaults: {},
  // unlit: its flame shows once it is lit
  build: (ctx) => [lit(ctx, Mdl.brazier(SEED))],
});

export const bench = defineModel<Record<string, never>>({
  id: 'shared/bench', name: 'Bench', category: 'props', pipeline: 'code', file: FILE, surface: 'wood', defaults: {},
  build: (ctx) => [lit(ctx, Mdl.bench(SEED))],
});

export interface AltarParams { readonly sockets: number }
export const shardAltar = defineModel<AltarParams>({
  id: 'shared/shard-altar', name: 'Glyph altar', category: 'props', pipeline: 'code', file: FILE, surface: 'stone', defaults: { sockets: 3 },
  // its sockets empty: a shard sits in one once its quest is done
  build: (ctx, p) => [lit(ctx, Mdl.altar(p.sockets, SEED))],
});

/** the props and models the engine's interaction runtime draws */
export const INTERACT_PROPS: InteractProps = {
  ...Mdl,
  models: { seaChest, holdKey, door, lever, pressurePlate, puzzleBarrel, beacon, bench, shardAltar },
};
/** hands the kit's props to the engine's interaction runtime (the composition root calls it at boot) */
export function installKitProps(): void { registerInteractProps(INTERACT_PROPS); }
