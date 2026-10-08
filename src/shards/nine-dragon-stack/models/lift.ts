/**
 * The lantern lift's parts (SF51-p, G184; ../world/lifts.ts places them): the bronze lattice cage (one object per lift,
 * moved every frame to its mover's published pose; it collides as its mover's boxes, not as a model), one red timber
 * frame of the shaft and one iron chain link (each ONE InstancedMesh over every lift, culled per copy by the fragment's
 * culler). Kit geometry in its own frame, drawn by the Jiehua program.
 */
import type { BufferGeometry } from 'three';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { cageKit, chainLinkKit, frameKit, roadGateKit } from '../world/lifts';
import { ndLook, need } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/lift.ts';

/** the set's geometry as the world built it (`set:<name>` in the look), else built here once */
function set(ctx: ModelContext, name: string, make: () => BufferGeometry): readonly ModelPart[] {
  const look = ndLook(ctx);
  return [{ geometry: look.geo.get(`set:${name}`) ?? ctx.once(`nds:set:${name}`, make), material: need(look.mat, 'the Jiehua program') }];
}

export const liftCage = defineModel({
  id: 'nine-dragon-stack/lift-cage', name: 'Lantern lift cage', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => [{ geometry: ctx.once('nds:lift:cage', () => cageKit().build()), material: need(ndLook(ctx).mat, 'the Jiehua program') }],
});

export const liftFrame = defineModel({
  id: 'nine-dragon-stack/lift-frame', name: 'Lantern lift shaft frame', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => set(ctx, 'lift-frame', () => frameKit().build()),
});

export const liftChain = defineModel({
  id: 'nine-dragon-stack/lift-chain', name: 'Lantern lift chain link', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => set(ctx, 'lift-chain', () => chainLinkKit().build()),
});

/** SF8c: the stationary road gate (one object per lift, shown while its mover collides: the cage is away from the deck) */
export const liftRoadGate = defineModel({
  id: 'nine-dragon-stack/lift-road-gate', name: 'Lantern lift road gate', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => [{ geometry: ctx.once('nds:lift:road-gate', () => roadGateKit().build()), material: need(ndLook(ctx).mat, 'the Jiehua program') }],
});
