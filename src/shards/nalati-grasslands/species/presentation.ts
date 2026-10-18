import { bodyKey, type BodyFamily } from './bodyKey';
import type { AnimalSpecies, VariantDef } from '@wildshard/engine/entities/species/registry';
import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';
import type { BakedGeometryRow, PackedCreatureBodies } from '@wildshard/game/plugin/geometry';
import { numericCreaturePose } from '@wildshard/game/plugin/channelPrograms';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { app } from '@wildshard/engine/app/runtime';
import type * as THREE from 'three';
import * as schema from 'valibot';

let crackGeometry: THREE.BufferGeometry | null = null;
let speciesData: { packedBodies: unknown; program: unknown } | null = null;
const speciesPoses = new Map<string, (c: AnimalRigContext) => void>();
/** Product JSON is admitted before the first creature build or frame. */
export async function prepareNalatiSpecies(input: unknown, programs: readonly { readonly id: string }[], bytes: Uint8Array): Promise<void> {
  const data = schema.parse(schema.object({ poses: schema.record(schema.string(), schema.object({ prefix: schema.string(), group: schema.string(), scalars: schema.array(schema.unknown()), look: schema.exactOptional(schema.unknown()), alive: schema.exactOptional(schema.boolean()) })), packedBodies: schema.unknown(), program: schema.unknown(), cracks: schema.unknown() }), input);
  const poses = Object.entries(data.poses).map(([key, { prefix, ...row }]) => [key, numericCreaturePose({ ...row, programs: programs.filter(program => program.id.startsWith(prefix)) })] as const);
  const row = schema.parse(schema.object({ attrs: schema.array(schema.tuple([schema.string(), schema.picklist(['f32', 'u16']), schema.number(), schema.boolean()])), count: schema.number(), index: schema.literal('u32'), indexCount: schema.number(), box: schema.boolean() }), data.cracks);
  const { readBakedGeometry } = await import('@wildshard/game/plugin/geometry');
  const geometry = readBakedGeometry(bytes, 0, row);
  for (const [key, pose] of poses) speciesPoses.set(key, pose);
  if (crackGeometry === null) crackGeometry = geometry; else geometry.dispose();
  speciesData = data;
}
function packedRows(input: unknown): unknown {
  const part = schema.tuple([schema.number(), schema.number(), schema.number(), schema.array(schema.tuple([schema.number(), schema.number(), schema.number()])), schema.picklist(['u16', 'u32'])]);
  const data = schema.parse(schema.object({ file: schema.string(), bytes: schema.number(), attrs: schema.array(schema.tuple([schema.string(), schema.picklist(['f32', 'u16']), schema.number(), schema.boolean()])), skeletons: schema.array(schema.object({ bones: schema.unknown(), dims: schema.unknown() })),
    rows: schema.array(schema.object({ kind: schema.string(), variant: schema.string(), skeleton: schema.number(), fur: schema.array(part), hard: schema.array(part), eye: schema.array(part) })) }), input);
  const parts = (rows: schema.InferOutput<typeof part>[]) => rows.map(([count, indexCount, start, groups, index]) => {
    let at = start;
    const offsets = data.attrs.map(([, type, width]) => { const offset = at, length = count * width * (type === 'u16' ? 2 : 4); at += length + (4 - length % 4) % 4; return offset; });
    offsets.push(at); const row: BakedGeometryRow = { attrs: data.attrs, count, index, indexCount, box: false };
    return { offsets, groups, indexEncoding: 'raw', row };
  });
  return { file: data.file, bytes: data.bytes, bodies: data.rows.map(body => {
    const skeleton = data.skeletons[body.skeleton]; if (skeleton === undefined) throw new Error('Missing creature body skeleton');
    return { kind: body.kind, variant: body.variant, bones: skeleton.bones, dims: skeleton.dims, fur: parts(body.fur), hard: parts(body.hard), eye: parts(body.eye) };
  }) };
}
/** Borrow a species' admitted channels over its existing quadruped or custom joints. */
export function poseNalatiCreature(kind: string, c: AnimalRigContext): void {
  const pose = speciesPoses.get(kind); if (pose === undefined) throw new Error('Nalati species pose rows are not prepared'); pose(c);
}
let packedBodies: PackedCreatureBodies | null = null, bodyLoading: Promise<void> | null = null;
/** Load the original packed loft bytes once; the shared host lends fresh geometry per spawn. */
export function preloadNalatiBodies(): Promise<void> {
  bodyLoading ??= (async () => {
    if (speciesData === null) {
      const { loadFirstPartyProduct } = await import('@wildshard/game/shardfile/runtimeProduct');
      const product = await loadFirstPartyProduct('nalati-grasslands');
      const actorRows = await product.json<{ species: unknown }>('actors/sheep.json');
      await prepareNalatiSpecies(actorRows.species, product.shardfile.clientChannels ?? [], await product.file('actors/balbal-cracks.bin'));
    }
    const data = speciesData; if (data === null) throw new Error('Missing Nalati species product');
    const { packedCreatureBodies } = await import('@wildshard/game/plugin/geometry');
    packedBodies = packedCreatureBodies(packedRows(data.packedBodies));
    await packedBodies.preload();
  })();
  return bodyLoading;
}
export function nalatiBody(family: BodyFamily, variant: VariantDef): AnimalSpecies {
  if (packedBodies === null) throw new Error('Nalati bodies are not loaded');
  return packedBodies.copy(family, bodyKey(family, variant));
}

/** The crack mesh is generated once against the original skeleton at build time. */
export function balbalCrackGeometry(): THREE.BufferGeometry { if (crackGeometry === null) throw new Error('Missing balbal crack geometry'); return crackGeometry; }
export function balbalProgram(): ReturnProgram { if (speciesData === null) throw new Error('Missing Nalati species program'); return ReturnProgram.page(speciesData.program, app.levelScope ?? undefined); }
