import { BufferAttribute } from 'three';
import type { compileReturnProjectionV2 } from '@wildshard/sdk/returnProjectionV2';
import { encodeBuildBytes } from '@wildshard/sdk/bake/byteCodec';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import speciesRows from '../data/speciesRows.json' with { type: 'json' };
import authoredLooks from '../data/speciesLooks.json' with { type: 'json' };
import { SPECIES_POSES } from './speciesPoses';
import { buildCracks } from './balbalCracks';
import { wireProgram } from './returnProgramRows';
import { actorProjection } from './actorProjection';
import { packNalatiSpeciesBodies, type SpeciesBodySource } from './speciesBodyPacking';
import { prepareNalatiSpeciesLooks } from './speciesLookPreparation';

type Guest = Parameters<typeof actorProjection>[0];

/** Upstream retained producer metadata is explicit input, never imported by this source constructor. */
export interface NalatiSpeciesSourceInputs {
  body: { readonly bytes: number; readonly bodies: readonly (Omit<SpeciesBodySource['bodies'][number], 'bones'> & { readonly bones: readonly { readonly name: string }[] })[] };
  admission: Parameters<typeof wireProgram>[0] & { readonly compiled?: unknown; readonly v2?: unknown };
  strike: unknown;
  kingPose: Parameters<typeof prepareNalatiSpeciesLooks>[1];
}

/** Complete existing species outputs as caller-owned data and binary loans; publication stays with the adapter. */
export interface NalatiSpeciesPreparation {
  data: unknown; boot: unknown;
  body: { file: string; bytes: Uint8Array<ArrayBuffer> };
  selected: Uint8Array<ArrayBuffer>; witness: Uint8Array<ArrayBuffer>;
}

/** Construct from explicit source inputs. The adapter owns guest admission and publication naming. */
export async function prepareNalatiSpecies(raw: Uint8Array, sources: ReadonlyMap<string, string>, input: NalatiSpeciesSourceInputs, admitGuest: (candidate: unknown) => Guest, bodyFile: (hash: string) => string, compileProjection: typeof compileReturnProjectionV2): Promise<NalatiSpeciesPreparation> {
  const authored = new Map(sources), weak = speciesRows.weak, radius = speciesRows.balbalGuest.radius;
  // Preserve the original finite triplets, 32-point ceiling and nonnegative radius before compiling.
  if (weak.length > 32 || weak.some(row => row.length !== 3 || row.some(value => !Number.isFinite(value)))
    || !Number.isFinite(radius) || radius < 0) throw new Error('Invalid authored species weak points');
  const tests = weak.map(([x, y, z]) => `Math.sqrt((x-(${x}))*(x-(${x}))+(y-(${y}))*(y-(${y}))+(z-(${z}))*(z-(${z})))<${radius}`);
  authored.set('behaviour/weakPoints.generated.as', `export function weakPoint(x:f64,y:f64,z:f64):bool{\n  return ${tests.join('\n    || ') || 'false'};\n}\n`);
  const programs = ['heldWeapons', 'balbal'].map(name => {
    const text = authored.get(`behaviour/${name}.as`);
    if (text === undefined) throw new Error(`Missing authored species source: ${name}`);
    return text;
  }).join('\n');
  const names = (prefix: string): string[] => [...new Set([...programs.matchAll(new RegExp(`${prefix}\\.([A-Za-z0-9_]+)`, 'g'))].map(match => match[1] ?? ''))];
  const fields = names('Field'), channels = names('Channel'), signals = names('Signal');
  const aliases = (values: readonly string[]): Record<string, string> => Object.fromEntries(values.map(name => [name, name]));
  const registry = (values: readonly string[]): Map<string, number> => new Map([...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0).map((name, index) => [name, index + 1]));
  const source = { id: 'nalati.held-weapons', abi: '1.0', side: 'sim', module: `blobs/wasm/${'0'.repeat(64)}.wasm`, source: 'behaviour/heldWeapons.as',
    binding: { shard: true }, pages: 1, onFail: 'hold', on: ['signal'], tick: null, stateVersion: 1, state: [], params: {}, reads: ['field'], commands: ['channel'],
    fields: aliases(fields), channels: aliases(channels), signals: aliases(signals) };
  // 3,184 checked-in lines plus the same five generated weak-point lines.
  const dual = await compileProjection(source, { fields: registry(fields), channels: registry(channels), signals: registry(signals) }, authored, { asLineCeiling: 3189 });
  const crackBody = input.body.bodies.find(row => row.key.startsWith('balbal:'));
  if (crackBody === undefined) throw new Error('Missing species program or skeleton');
  const cracks = buildCracks(crackBody.bones);
  try {
    const { bytes: packedBytes, attrs, bodies, skeletons, rows } = packNalatiSpeciesBodies(input.body, raw);
    const compressed = encodeBuildBytes(packedBytes, 'deflate', 9, 'native');
    const file = bodyFile(hashImmutableBytes(compressed));
    const packedBodies = { file, bytes: packedBytes.length, bodies };
    const compactBodies = { file, bytes: packedBytes.length, attrs, skeletons, rows };
    const poseConfigs: Record<string, unknown> = {};
    for (const [key, { programs: _programs, ...config }] of Object.entries(SPECIES_POSES)) {
      poseConfigs[key] = { ...config, prefix: `pose.${key === 'canidDead' ? 'canid-dead' : key}.` };
    }
    const blocks: Uint8Array[] = [], crackAttrs: [string, 'u16' | 'f32', number, boolean][] = [];
    let size = 0;
    for (const [name, attr] of Object.entries(cracks.attributes)) {
      if (!(attr instanceof BufferAttribute)) throw new Error('Interleaved crack attributes are not authored');
      const type = attr.array instanceof Uint16Array ? 'u16' : 'f32'; crackAttrs.push([name, type, attr.itemSize, false]);
      const bytes = new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength); blocks.push(bytes); size += bytes.length;
    }
    const index = cracks.index; if (index === null) throw new Error('Missing crack triangles');
    let last = 0;
    const deltas = Int32Array.from(index.array, value => { const delta = value - last; last = value; return delta; });
    blocks.push(new Uint8Array(deltas.buffer)); size += deltas.byteLength;
    const crackBytes = new Uint8Array(size); let at = 0;
    for (const bytes of blocks) { crackBytes.set(bytes, at); at += bytes.length; }
    const crackRow = { attrs: crackAttrs, count: cracks.getAttribute('position').count, index: 'u32', indexCount: index.count, box: false };
    const compiled = { source: 'behaviour/held-weapons.generated.wasm', bytes: dual.binary.length, hash: dual.candidate.artifact.hash };
    const projection = { ...dual.legacy, bytes: '', v2: { ...dual.candidate, bytes: '' } };
    const program = wireProgram(projection);
    const guest = admitGuest({ ...speciesRows.balbalGuest, program, strike: input.strike });
    const lookBookRows = [];
    for (const row of authoredLooks) lookBookRows.push(row.metadata.kind === speciesRows.balbal.kind ? { ...row, projection: actorProjection(guest) } : row);
    const { compiled: _admissionCompiled, ...admission } = input.admission;
    const presentation = { packedBodies: compactBodies, poses: poseConfigs, guest, lookBook: { slug: 'nalati-grasslands', rows: lookBookRows, program: wireProgram(admission) } };
    const { hullBook, looks } = prepareNalatiSpeciesLooks(compactBodies, input.kingPose, crackRow);
    const data = { packedBodies, poses: SPECIES_POSES, presentation, hullBook, looks, crackBytes: Array.from(crackBytes), program, compiled, witnessBytes: dual.witness.length };
    const { balbal, king, slam } = speciesRows;
    return { data: structuredClone(data), boot: structuredClone({ balbal: { kind: balbal.kind }, king: { kind: king.kind }, slam }),
      body: { file, bytes: Uint8Array.from(compressed) }, selected: Uint8Array.from(dual.binary), witness: Uint8Array.from(dual.witness) };
  } finally { cracks.dispose(); }
}
