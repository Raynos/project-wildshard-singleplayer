/**
 * The interactables kit's models (E306 / E315 M1, second pass: models on the contract, ./model.ts) — every thing a quest
 * table puts in the world for you to open, pull, press, light or pick up: the sea chest (banded chest, iron strongbox,
 * treasure chest), the hold key, the flint kit, sea glass, a doubloon, a resin drop, a carved token, a glyph shard, a
 * door (plank, grate, sluice), a lever, a pressure plate, the puzzle barrel, the beacon's brazier, a bench and the
 * shard altar. Shared: Driftwood's table and Pine Hollow's build them (src/world/interact/, the kit's low-poly parts
 * in src/world/interact/models.ts).
 *
 * The kit (src/world/interact/Interactables.ts) draws every row's parts as instances of two BatchedMeshes for the whole
 * shard (lit + glow), posing the moving ones every frame (lids swing, levers throw, plates sink, pickups bob): it places
 * each model `drawnInto` its lit batch, one placement per row, so each card counts its copies and VIEW IN WORLD lands
 * on one. Their collision stays the kit's (moving boxes, the barrel's dynamic body). A specimen is the thing at rest,
 * closed, its parts posed as the kit poses them there; a glowing part is drawn unlit, as in the world.
 */
import * as THREE from 'three';
import * as Mdl from '../world/interact/models';
import { lowPolyMaterial } from '../world/lowpolyKit';
import { defineModel, type ModelContext, type ModelDef, type ModelPart } from './model';

type Look = 'chest' | 'strongbox' | 'treasure';
type DoorLook = 'plank' | 'grate' | 'sluice';
const FILE = 'src/models/interact.ts';
const SEED = 0x1a7e;

/** a lit part (the shared low-poly material) and a glowing one (unlit, as the kit's glow batch), posed at `m` */
const lit = (ctx: ModelContext, g: THREE.BufferGeometry, m?: THREE.Matrix4): ModelPart =>
  ({ geometry: m ? g.applyMatrix4(m) : g, material: lowPolyMaterial(ctx.sky), castShadow: true, receiveShadow: true });
const glow = (ctx: ModelContext, g: THREE.BufferGeometry, m?: THREE.Matrix4): ModelPart =>
  ({ geometry: m ? g.applyMatrix4(m) : g, material: ctx.once('shared/interact:glow', () => new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, toneMapped: true })) });
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

/** a pickup: its part floating at its bob's rest height (the kit spins and bobs it round there) */
function pickup(id: string, name: string, height: number, make: (ctx: ModelContext) => ModelPart[]): ModelDef<Record<string, never>> {
  return defineModel<Record<string, never>>({ id, name, category: 'props', pipeline: 'code', file: FILE, defaults: {}, build: (ctx) => {
    const parts = make(ctx);
    for (const part of parts) part.geometry.translate(0, height, 0);
    return parts;
  } });
}
export const holdKey = pickup('shared/hold-key', 'Key', 0.9, (ctx) => [glow(ctx, Mdl.keyModel(SEED))]);
export const flintKit = pickup('shared/flint-kit', 'Flint & steel', 0, (ctx) => [lit(ctx, Mdl.flintKit(SEED))]);
export const seaGlass = pickup('shared/sea-glass', 'Sea glass', 0.45, (ctx) => [glow(ctx, Mdl.seaGlass(SEED))]);
export const doubloon = pickup('shared/doubloon', 'Doubloon', 0.6, (ctx) => [glow(ctx, Mdl.coinModel(SEED))]);
export const resinDrop = pickup('shared/resin-drop', 'Resin drop', 0, (ctx) => [glow(ctx, Mdl.resinDrop(SEED))]);
export const carvedToken = pickup('shared/carved-token', 'Carved token', 0.55, (ctx) => [lit(ctx, Mdl.carvedToken(SEED)), glow(ctx, Mdl.tokenRim(SEED + 1))]);
export const glyphShard = pickup('shared/glyph-shard', 'Glyph shard', 1.2, (ctx) => [glow(ctx, Mdl.glyphShard(SEED))]);

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
  id: 'shared/shard-altar', name: 'Shard altar', category: 'props', pipeline: 'code', file: FILE, surface: 'stone', defaults: { sockets: 3 },
  // its sockets empty: a shard sits in one once its quest is done
  build: (ctx, p) => [lit(ctx, Mdl.altar(p.sockets, SEED))],
});
