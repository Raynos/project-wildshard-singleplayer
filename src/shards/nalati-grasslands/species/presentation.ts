import { CreatureFrame } from '@wildshard/game/population/creatureFrame';
import { parseClientChannels } from '@wildshard/format/clientChannels';
import speciesRows from '../boot/speciesRows.generated.json' with { type:'json' };
import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';
import { SpeciesLookBook } from '@wildshard/game/looks/speciesBook';
import type * as THREE from 'three';
import * as schema from 'valibot';

let crackGeometry: THREE.BufferGeometry | null = null;
let book:SpeciesLookBook|null=null;
let speciesData: { packedBodies: unknown; program: unknown; strike: unknown } | null = null;
/** Product JSON is admitted before the first creature build or frame. */
export async function prepareNalatiSpecies(input: unknown, programs: readonly { readonly id: string }[], bytes: Uint8Array): Promise<void> {
  const data = schema.parse(schema.object({ poses: schema.record(schema.string(), schema.object({ prefix: schema.string(), group: schema.string(), scalars: schema.array(schema.unknown()), look: schema.exactOptional(schema.unknown()), alive: schema.exactOptional(schema.boolean()) })), packedBodies: schema.unknown(), program: schema.unknown(), strike: schema.unknown(),lookBook:schema.object({slug:schema.string(),rows:schema.unknown(),program:schema.optional(schema.unknown())}), cracks: schema.unknown() }), input);
  const poses = Object.entries(data.poses).map(([key, { prefix, ...row }]) => [key, { ...row, programs: programs.filter(program => program.id.startsWith(prefix)) }] as const);
  const row = schema.parse(schema.object({ attrs: schema.array(schema.tuple([schema.string(), schema.picklist(['f32', 'u16']), schema.number(), schema.boolean()])), count: schema.number(), index: schema.literal('u32'), indexCount: schema.number(), box: schema.boolean() }), data.cracks);
  const { readBakedGeometry } = await import('@wildshard/game/plugin/geometry');
  const geometry = readBakedGeometry(bytes, 0, row);
  if (crackGeometry === null) crackGeometry = geometry; else geometry.dispose();
  speciesData = data;
  book ??= new SpeciesLookBook({...data.lookBook,body:data.packedBodies,poses:Object.fromEntries(poses)});
}
/** Borrow a species' admitted channels over its existing quadruped or custom joints. */
export function poseNalatiCreature(kind: string, c: AnimalRigContext): void {
  speciesLookBook().pose(kind, c);
}
/** The page and specimens share the same data-owned packed body cache. */
export function speciesLookBook():SpeciesLookBook{if(book===null)throw new Error('Species look book is not prepared');return book;}
export async function preloadNalatiBodies():Promise<void>{await speciesLookBook().preloadBodies();}

/** The crack mesh is generated once against the original skeleton at build time. */
export function balbalCrackGeometry(): THREE.BufferGeometry { if (crackGeometry === null) throw new Error('Missing balbal crack geometry'); return crackGeometry; }
export function speciesGuestRows(): { program: unknown; strike: unknown } { if (speciesData === null) throw new Error('Missing species guest program'); return { program: speciesData.program,strike: speciesData.strike }; }

let clips: CreatureFrame | null = null;
/** Bind the admitted visual state and numeric channels before any body pose. */
export function prepareGoldenKing(input: unknown): void {
  const programs = parseClientChannels(input);
  clips = new CreatureFrame({ ...speciesRows.kingFrame,defaults: speciesRows.kingPoseDefaults,
    observations: programs.filter(row => row.numeric?.group === 'king.observe'),
    pose: { group: 'creature.pose',programs: programs.filter(row => row.numeric?.group === 'creature.pose') } });
}
export function animateGoldenKing(c: AnimalRigContext): void {
  if (clips === null) throw new Error('Golden King pose rows are not prepared');
  clips.animate(c);
}
