import { BufferAttribute, Float16BufferAttribute, Mesh, type BufferGeometry } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { encodeBuildBytes } from '@wildshard/sdk/bake/byteCodec';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { bakeCreatureBodies, bakeCaptainBody, faceHeadOf } from './creatureBodies';
import publicInputs from '../data/publicInputs.json' with { type: 'json' };

/** The committed Hunyuan sailor head and the captain the bodies are lofted around. */
export const CREATURE_BODY_INPUTS: { readonly head: string; readonly captain: string } = publicInputs.creatureBodies;
/** The packed bodies' product file (GR7: the job wrote a hash-named public copy the hull book named by URL). */
export const CREATURE_BODY_FILE = 'models/creatures/bodies.bin';

type Kind = 'f32' | 'f16' | 'u16' | 'i8' | 'u8';
/** @wildshard/sdk/kit/bakedGeometry's element sizes (its reader decodes these blocks) */
const BAKED_BYTES: Readonly<Record<Kind, number>> = { f32: 4, f16: 2, u16: 2, i8: 1, u8: 1 };
const pad4 = (n: number): number => Math.ceil(n / 4) * 4;
interface PartRow { attrs: [string, Kind, number, boolean][]; count: number; index: 'u16' | 'u32' | null; indexCount: number; box: false }
interface Part { offsets: number[]; row: PartRow }
/** The packed bodies' rows (`look/hull-book`'s body and fauna) and the deflated block bytes they index. */
export interface DriftwoodCreatureBodyBank {
  readonly rows: { readonly file: string; readonly bytes: number; readonly bodies: readonly unknown[];
    readonly fauna: { readonly slug: string; readonly definitions: Record<string, never>; readonly rows: readonly { id: string; species: string; kind: string; base: 'registered'; required: true }[] } };
  readonly bin: Uint8Array;
}

const isMesh = (value: unknown): value is Mesh => value instanceof Mesh;
function kindOf(attr: BufferAttribute, what: string): Kind {
  if (attr instanceof Float16BufferAttribute) return 'f16';
  const a = attr.array;
  if (a instanceof Float32Array) return 'f32';
  if (a instanceof Uint16Array) return 'u16';
  if (a instanceof Int8Array) return 'i8';
  if (a instanceof Uint8Array) return 'u8';
  throw new Error(`${what}: unsupported buffer element storage`);
}

/** Loft every body around the committed head and captain and pack them as the job did: every material group's attributes
 *  as built, each identical block once, deflated (level 9). `read` returns a committed public file's bytes. */
export async function driftwoodCreatureBodyBank(read: (url: string) => Uint8Array): Promise<DriftwoodCreatureBodyBank> {
  const source = await readSourceModel(Uint8Array.from(read(CREATURE_BODY_INPUTS.head)));
  source.gltf.scene.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  source.gltf.scene.traverse(node => { if (isMesh(node)) meshes.push(node); });
  const headMesh = meshes[0];
  if (headMesh === undefined || meshes.length !== 1) throw new Error(`${CREATURE_BODY_INPUTS.head} must hold one mesh`);
  const captain = await readSourceModel(Uint8Array.from(read(CREATURE_BODY_INPUTS.captain)));
  const bodies = [...bakeCreatureBodies(faceHeadOf(headMesh.geometry.clone().applyMatrix4(headMesh.matrixWorld))), bakeCaptainBody(captain.gltf.scene)];
  const blocks: Uint8Array[] = [], written = new Map<string, number>();
  let size = 0;
  const blockAt = (bytes: Uint8Array): number => {
    const digest = hashImmutableBytes(bytes), seen = written.get(digest);
    if (seen !== undefined) return seen;
    const offset = size, block = new Uint8Array(pad4(bytes.length));
    block.set(bytes); blocks.push(block); size += block.length; written.set(digest, offset);
    return offset;
  };
  const write = (g: BufferGeometry | null, what: string): Part | null => {
    if (g === null) return null;
    const attrs: PartRow['attrs'] = [], offsets: number[] = [];
    for (const [name, attr] of Object.entries(g.attributes).sort(([a], [b]) => Number(b === 'position') - Number(a === 'position'))) {
      if (!(attr instanceof BufferAttribute)) throw new Error(`${what}: '${name}' is interleaved`);
      const kind = kindOf(attr, what);
      attrs.push([name, kind, attr.itemSize, attr.normalized]);
      offsets.push(blockAt(new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.count * attr.itemSize * BAKED_BYTES[kind])));
    }
    // the reader computes each group's bounds as it reads the first block
    if (attrs[0]?.[0] !== 'position') throw new Error(`${what}: position must come first`);
    const index = g.index;
    if (index !== null) {
      const deltas = new Int32Array(index.count);
      let last = 0;
      for (let i = 0; i < index.count; i++) { const v = index.getX(i); deltas[i] = v - last; last = v; }
      offsets.push(blockAt(new Uint8Array(deltas.buffer)));
    }
    const count = g.getAttribute('position').count;
    const row: PartRow = { attrs, count, index: index === null ? null : count > 65535 ? 'u32' : 'u16', indexCount: index === null ? 0 : index.count, box: false };
    g.dispose();
    return { offsets, row };
  };
  const rows = bodies.map(b => ({ kind: b.kind, variant: b.variant, bones: b.bones, dims: b.dims,
    fur: write(b.fur, `${b.kind}.${b.variant} fur`), hard: write(b.hard, `${b.kind}.${b.variant} hard`), eye: write(b.eye, `${b.kind}.${b.variant} eye`) }));
  const raw = new Uint8Array(size);
  let at = 0;
  for (const block of blocks) { raw.set(block, at); at += block.length; }
  const fauna = { slug: 'driftwood-isle', definitions: {}, rows: (['boar', 'bear'] as const).map(kind => ({
    id: `driftwood.look.${kind}`, species: `driftwood.creature.${kind}`, kind, base: 'registered' as const, required: true as const })) };
  return { rows: { file: CREATURE_BODY_FILE, bytes: raw.length, bodies: rows, fauna }, bin: encodeBuildBytes(raw, 'deflate', 9, 'native') };
}
