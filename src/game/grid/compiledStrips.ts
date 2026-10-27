import * as v from 'valibot';
import { GeometryPackData, PackedGeometryRowsSchema, type PackedGeometryRows } from '@wildshard/format/geometryPack';
import type { Scope } from '@wildshard/engine/app/scope';
import { declareDownloadFile } from '@wildshard/engine/boot/download';
import type { GeneratedStrip, PlatformCell, StripMesh, StripProfile } from '@wildshard/engine/sim/strips';
import type { ResidencyAllocator } from './allocator';
import { readGridAssetBytes } from './gridAssetBytes';

type SeamFeature = GeneratedStrip['features'][number];
type SeamFeatureKind = SeamFeature['kind'];
type SeamTurnIn = NonNullable<GeneratedStrip['turnIn']>;

export interface CompiledGridAddress { readonly url: string; readonly bytes: number; readonly sha256: string }
export type GridStripPhase = 'initial' | 'outer';
/** The outer capability has a distinct address and is never read by initial admission. */
export function gridStripPageKey(home: string, phase: GridStripPhase): string { return phase === 'outer' ? `${home}:outer` : home; }
/** Only eligible homes fetch the optional directory; other pages add no data requests. */
export interface CompiledGridSelector { readonly directory: CompiledGridAddress; readonly homes: readonly string[] }
export interface CompiledGridPage { readonly source: string; readonly home: string; readonly header: CompiledGridAddress; readonly body: CompiledGridAddress }
export interface CompiledGridHeader {
  readonly version: 1; readonly source: string; readonly home: string; readonly rows: PackedGeometryRows;
  readonly surfaces: readonly string[];
  readonly shapes: readonly { readonly features: { readonly offset: number; readonly count: number }; readonly turnIn?: SeamTurnIn }[];
  readonly strips: readonly { readonly id: string; readonly shape: number; readonly origin: { readonly x: number; readonly z: number };
    readonly duplicates: readonly { readonly instance: string; readonly origin: { readonly x: number; readonly z: number } }[] }[];
}
const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const natural = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(16 * 1024 * 1024));
// JSON cannot carry signed zero. Only numerical fields accept its wire token.
const finite = v.pipe(v.union([v.pipe(v.number(), v.finite()), v.literal('-0')]), v.transform(value => value === '-0' ? -0 : value));
const point = v.strictObject({ x: finite, z: finite });
const address = (extension: 'json' | 'bin') => v.strictObject({ url: v.pipe(v.string(), v.regex(new RegExp(`^/assets/grid-strip-${extension === 'json' ? '(?:book|page)' : 'mesh'}-[a-f0-9]{8}\\.${extension}$`, 'u'))),
  bytes: v.pipe(natural, v.minValue(1)), sha256: hash });
const directorySchema = v.strictObject({ version: v.literal(1), pages: v.pipe(v.array(v.strictObject({ source: hash, home: text, header: address('json'), body: address('bin') })), v.maxLength(512)) });
/** Stable binary feature codes; numeric records retain their exact Float64 words. */
export const GRID_STRIP_FEATURE_KINDS: readonly SeamFeatureKind[] = ['deck', 'neutral-buffer', 'gradient', 'overlap', 'retaining-wall', 'cliff', 'talus', 'parapet', 'dike', 'culvert', 'guard-rail', 'road-wall', 'turn-in', 'revetment'];
const headerSchema = v.strictObject({ version: v.literal(1), source: hash, home: text, rows: PackedGeometryRowsSchema,
  surfaces: v.pipe(v.array(text), v.maxLength(2048)),
  shapes: v.pipe(v.array(v.strictObject({ features: v.strictObject({ offset: natural, count: v.pipe(natural, v.maxValue(100_000)) }), turnIn: v.exactOptional(v.strictObject({ at: v.literal(0), widths: v.tuple([finite, finite]) })) })), v.minLength(1), v.maxLength(128)),
  strips: v.pipe(v.array(v.strictObject({ id: text, shape: natural, origin: point, duplicates: v.pipe(v.array(v.strictObject({ instance: text, origin: point })), v.maxLength(4)) })), v.minLength(1), v.maxLength(256)) });

/** Exact source identity, independent of object property order and preserving -0. */
export async function platformGeometrySource(cells: readonly PlatformCell[], empty: StripProfile): Promise<string> {
  const zero = (_key: string, value: unknown): unknown => typeof value === 'number' && Object.is(value, -0) ? '-0' : value;
  const byObject = new Map<StripProfile, number>(), byValue = new Map<string, number>(), profiles: string[] = [];
  const profile = (row: StripProfile): number => {
    const previous = byObject.get(row); if (previous !== undefined) return previous;
    const encoded = JSON.stringify([row.roadHeight, row.heights, row.colours], zero);
    let index = byValue.get(encoded);
    if (index === undefined) { index = profiles.length; profiles.push(encoded); byValue.set(encoded, index); }
    byObject.set(row, index); return index;
  };
  const sides = ['north', 'east', 'south', 'west'] as const;
  const source = [cells.map(cell => [cell.instance, cell.cell, cell.origin.x, cell.origin.z, sides.map(side => {
    const observation = cell.observations?.[side];
    return [profile(cell.edges[side]), observation === undefined ? null : [observation.entryWidth, observation.geometry ?? null,
      observation.waterSurface ?? null, observation.sourceSurface ?? null, observation.outflows?.map(row => [row.from, row.to]) ?? null]];
  })]), profile(empty)];
  const wire = new TextEncoder().encode(`${JSON.stringify(source, zero)}\n${profiles.map(row => `${row.length}:${row}`).join('')}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', wire));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

/** The runtime admits the small header before decoding the existing typed pack. */
export function parseCompiledGridHeader(input: unknown): CompiledGridHeader { return v.parse(headerSchema, input); }

// The codec returns real Float32 arrays. IEEE-754's all-one exponent is
// exactly NaN or infinity; scan the same words without a callback per scalar.
function finiteWords(values: Float32Array): boolean {
  const words = new Uint32Array(values.buffer, values.byteOffset, values.length);
  for (let index = 0; index < words.length; index++) if (((words[index] ?? 0) & 0x7f800000) === 0x7f800000) return false;
  return true;
}

function* stripSteps(input: unknown, bytes: Uint8Array, source: string, home: string): Generator<void, readonly GeneratedStrip[]> {
  const header = parseCompiledGridHeader(input);
  if (header.source !== source || header.home !== home || header.rows.geometries.length !== header.shapes.length) throw new Error('Grid strip source differs from this page');
  const featureStart = Math.ceil(header.rows.bytes / 8) * 8;
  if (featureStart > bytes.length || (bytes.length - featureStart) % 72 !== 0 || new Set(header.surfaces).size !== header.surfaces.length) throw new Error('Grid strip feature layout differs');
  const pack = new GeometryPackData(bytes.subarray(0, header.rows.bytes), header.rows, 'Grid strips');
  const featureWords = new DataView(bytes.buffer, bytes.byteOffset + featureStart, bytes.length - featureStart);
  const shapes: { readonly mesh: Omit<StripMesh, 'origin'>; readonly features: readonly SeamFeature[] }[] = [];
  let featureOffset = 0;
  for (const [index, row] of header.rows.geometries.entries()) {
    if (row.own !== 'u32' || row.count !== row.unique || row.attrs.length !== 2 || row.attrs[0]?.[0] !== 'position' || row.attrs[0][1] !== 3
      || row.attrs[1]?.[0] !== 'color' || row.attrs[1][1] !== 3 || (row.groups?.length ?? 0) !== 0 || row.indexCount % 3 !== 0) throw new Error('Grid strip channels differ');
    const data = pack.read(index), positions = data.attributes[0]?.array, colours = data.attributes[1]?.array, indices = data.index;
    if (positions === undefined || colours === undefined || positions.length !== colours.length || !(indices instanceof Uint32Array)
      || !finiteWords(positions) || !finiteWords(colours) || indices.some(vertex => vertex >= row.unique)) throw new Error('Invalid grid strip geometry');
    const shape = header.shapes[index];
    if (shape === undefined || shape.features.offset !== featureOffset || (featureOffset + shape.features.count) * 72 > featureWords.byteLength) throw new Error('Grid strip feature range differs');
    const features: SeamFeature[] = [];
    for (let i = 0; i < shape.features.count; i++, featureOffset++) {
      const at = featureOffset * 72, word = (column: number): number => featureWords.getFloat64(at + column * 8, true);
      const code = word(0), firstIndex = word(1), indexCount = word(2), side = word(3), from = word(4), to = word(5), bottom = word(6), top = word(7), surface = word(8);
      const kind = GRID_STRIP_FEATURE_KINDS[code], sourceSurface = header.surfaces[surface];
      if (!Number.isSafeInteger(code) || kind === undefined || !Number.isSafeInteger(firstIndex) || firstIndex < 0 || firstIndex % 3 !== 0
        || !Number.isSafeInteger(indexCount) || indexCount < 0 || indexCount % 3 !== 0 || firstIndex + indexCount > indices.length
        || side !== -1 && side !== 0 && side !== 1 || !Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(bottom) || !Number.isFinite(top)
        || !Number.isSafeInteger(surface) || surface < -1 || surface !== -1 && sourceSurface === undefined) throw new Error('Grid strip feature range differs');
      features.push({ kind, firstIndex, indexCount, side, from, to, bottom, top, ...(sourceSurface === undefined ? {} : { sourceSurface }) });
    }
    shapes.push({ mesh: { positions, colours, indices }, features }); yield;
  }
  if (featureOffset * 72 !== featureWords.byteLength) throw new Error('Grid strip feature body differs');
  if (new Set(header.strips.map(strip => strip.id)).size !== header.strips.length) throw new Error('Duplicate grid strip');
  const result: GeneratedStrip[] = [];
  for (const strip of header.strips) {
    const shape = shapes[strip.shape], metadata = header.shapes[strip.shape];
    if (shape === undefined || metadata === undefined || new Set(strip.duplicates.map(row => row.instance)).size !== strip.duplicates.length) throw new Error('Invalid grid strip placement');
    const mesh = { ...shape.mesh, origin: strip.origin };
    const duplicates: GeneratedStrip['duplicates'][number][] = [];
    for (const row of strip.duplicates) duplicates.push({ instance: row.instance, mesh: { ...shape.mesh, origin: row.origin } });
    result.push({ id: strip.id, mesh, features: shape.features, ...(metadata.turnIn === undefined ? {} : { turnIn: metadata.turnIn }), duplicates });
  }
  return result;
}

/** Renderer-free exact decoder for authoring and byte-parity qualification. */
export function decodeCompiledGridStrips(input: unknown, bytes: Uint8Array, source: string, home: string): readonly GeneratedStrip[] {
  const steps = stripSteps(input, bytes, source, home);
  for (;;) { const step = steps.next(); if (step.done) return step.value; }
}

/** Optional exact-input baked initial ring. Missing entries use native construction;
 * a declared entry's corrupt bytes or header always refuse. */
export async function readCompiledGridStrips(selector: CompiledGridSelector | undefined, input: { readonly cells: readonly PlatformCell[]; readonly empty: StripProfile }, home: string,
  owner: { readonly scope: Scope; readonly allocator: ResidencyAllocator }, read: (url: string, signal: AbortSignal) => Promise<Response>, pause: () => Promise<void>, phase: GridStripPhase = 'initial'): Promise<readonly GeneratedStrip[] | null> {
  const key = gridStripPageKey(home, phase);
  if (selector === undefined || !selector.homes.includes(key)) return null;
  const live = (): void => { if (owner.scope.disposed || owner.scope.disposing) throw new Error('Grid admission scope disposed'); };
  live();
  const abort = new AbortController(), forget = owner.scope.capture('disposers', () => { abort.abort(); });
  const reservations: { readonly release: () => void }[] = [];
  let releaseSource: (() => void) | undefined, forgetSource: (() => void) | undefined, published = false;
  const reserve = (id: string, bytes: number): { readonly release: () => void } => {
    const claim = owner.allocator.reserve({ id: `product:grid:seams:${key}:${id}`, category: 'product', owner: home, bytes, distance: 0, needed: true });
    if (claim === null) throw new Error('Grid strip metadata residency deferred');
    return claim;
  };
  const fetchAsset = async (asset: CompiledGridAddress): Promise<Uint8Array<ArrayBuffer>> => {
    live(); declareDownloadFile(asset.url, asset.bytes);
    const bytes = await readGridAssetBytes(asset, url => read(url, abort.signal), 'strips'); live(); return bytes;
  };
  try {
    reservations.push(reserve('directory', selector.directory.bytes * 2));
    const [directory, source] = await Promise.all([fetchAsset(selector.directory), platformGeometrySource(input.cells, input.empty)]); live();
    const book = v.parse(directorySchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(directory)));
    if (new Set(book.pages.map(page => `${page.source}/${page.home}`)).size !== book.pages.length) throw new Error('Duplicate grid strip page');
    const page = book.pages.find(row => row.source === source && row.home === key); if (page === undefined) return null;
    reservations.push(reserve('decode', page.header.bytes * 2 + page.body.bytes * 2));
    const sourceLease = reserve('source', page.body.bytes * 2 + page.header.bytes * 4);
    let released = false;
    releaseSource = (): void => { if (!released) { released = true; sourceLease.release(); } };
    forgetSource = owner.scope.capture('disposers', releaseSource);
    const [header, body] = await Promise.all([fetchAsset(page.header), fetchAsset(page.body)]); live();
    const steps = stripSteps(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(header)), body, source, key);
    try {
      for (;;) {
        live(); const step = steps.next();
        if (step.done) { published = true; return step.value; }
        await pause();
      }
    } finally { steps.return([]); }
  } finally {
    abort.abort(); forget(); for (const reservation of reservations) reservation.release();
    if (!published) { forgetSource?.(); releaseSource?.(); }
  }
}
