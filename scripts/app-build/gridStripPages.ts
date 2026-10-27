/// <reference types="node" />
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { BufferAttribute, BufferGeometry } from 'three';
import { GeometryPackWriter } from '../../src/sdk/kit/geometryPack';
import type { GeneratedStrip } from '../../src/engine/sim/strips';
import { decodeCompiledGridStrips, parseCompiledGridHeader, type CompiledGridAddress, type CompiledGridHeader, type CompiledGridPage, type CompiledGridSelector } from '../../src/game/grid/compiledStrips';
import { servedBytes } from '../phone-wire.mjs';

export interface CompiledGridArtifact { readonly address: CompiledGridAddress; readonly bytes: Uint8Array }
export interface CompiledGridCandidate { readonly page: CompiledGridPage; readonly slug: string; readonly header: CompiledGridArtifact; readonly body: CompiledGridArtifact }
export interface GridStripWireRow { readonly source: string; readonly home: string; readonly slug: string; readonly added: number; readonly product: number | null; readonly ceiling: number | null; readonly included: boolean }
export interface CompiledGridBuild {
  readonly geometry?: CompiledGridSelector; readonly files: readonly CompiledGridAddress[]; readonly rows: readonly GridStripWireRow[];
}
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value, (_key, item: unknown) => typeof item === 'number' && Object.is(item, -0) ? '-0' : item));
function artifact(bytes: Uint8Array, extension: 'json' | 'bin', kind: 'book' | 'page' | 'mesh'): CompiledGridArtifact {
  const sha256 = hash(bytes);
  if (bytes.length === 0 || bytes.length > 16 * 1024 * 1024) throw new Error('Grid strip artifact exceeds its transport cap');
  return { bytes, address: { url: `/assets/grid-strip-${kind}-${sha256.slice(0, 8)}.${extension}`, bytes: bytes.length, sha256 } };
}

/** Store the original indexed words, never deduplicate vertices or quantize them. */
export function encodeGridStripPage(source: string, home: string, slug: string, strips: readonly GeneratedStrip[]): CompiledGridCandidate {
  const writer = new GeometryPackWriter('Grid strips'), indices = new Map<string, number>(), shapes: CompiledGridHeader['shapes'][number][] = [];
  const rows: CompiledGridHeader['strips'][number][] = [];
  for (const strip of strips) {
    const { mesh, features, turnIn } = strip;
    const digest = createHash('sha256');
    digest.update(json([mesh.positions.length, mesh.colours.length, mesh.indices.length]));
    for (const array of [mesh.positions, mesh.colours, mesh.indices]) digest.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
    digest.update(json({ features, ...(turnIn === undefined ? {} : { turnIn }) }));
    const key = digest.digest('hex'); let shape = indices.get(key);
    if (shape === undefined) {
      const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(mesh.positions, 3)).setAttribute('color', new BufferAttribute(mesh.colours, 3))
        .setIndex(new BufferAttribute(mesh.indices, 1));
      try { shape = writer.add(geometry); } finally { geometry.dispose(); }
      indices.set(key, shape); shapes.push({ features, ...(turnIn === undefined ? {} : { turnIn }) });
    }
    const duplicates: CompiledGridHeader['strips'][number]['duplicates'][number][] = [];
    for (const duplicate of strip.duplicates) {
      for (const field of ['positions', 'colours', 'indices'] as const) {
        const a = mesh[field], b = duplicate.mesh[field];
        if (!Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength))) throw new Error('Grid strip duplicate changed native words');
      }
      duplicates.push({ instance: duplicate.instance, origin: { ...duplicate.mesh.origin } });
    }
    rows.push({ id: strip.id, shape, origin: { ...mesh.origin }, duplicates });
  }
  const header = artifact(json({ version: 1, source, home, rows: writer.rows(), shapes, strips: rows } satisfies CompiledGridHeader), 'json', 'page');
  // Exercise the same valibot grammar the runtime admits, including signed zero.
  parseCompiledGridHeader(JSON.parse(new TextDecoder().decode(header.bytes)));
  const body = artifact(writer.bytes(), 'bin', 'mesh');
  // Certify the bytes that will ship against this build's actual native output.
  const decoded = decodeCompiledGridStrips(JSON.parse(new TextDecoder().decode(header.bytes)), body.bytes, source, home);
  for (const [index, original] of strips.entries()) {
    const copy = decoded[index]; if (copy === undefined || copy.id !== original.id) throw new Error('Grid strip bake changed its order');
    for (const field of ['positions', 'colours', 'indices'] as const) {
      const a = original.mesh[field], b = copy.mesh[field];
      if (!Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength))) throw new Error('Grid strip bake changed native words');
    }
    const facts = (strip: GeneratedStrip): unknown => JSON.parse(new TextDecoder().decode(json({ origin: strip.mesh.origin, features: strip.features,
      turnIn: strip.turnIn ?? null, duplicates: strip.duplicates.map(row => ({ instance: row.instance, origin: row.mesh.origin })) })));
    if (!isDeepStrictEqual(facts(original), facts(copy))) throw new Error('Grid strip bake changed physical placement or features');
  }
  return { slug, page: { source, home, header: header.address, body: body.address }, header, body };
}

/** Choose only pages whose added directory/header/body wire fits the original I12 ceiling. */
export function writeGridStripPages(root: string, seams: string, candidates: readonly CompiledGridCandidate[], products: readonly { readonly name: string; readonly bytes: number; readonly ceiling: number | undefined }[]): CompiledGridBuild {
  const unique = new Map<string, CompiledGridCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.page.source}/${candidate.page.home}`, previous = unique.get(key);
    if (previous !== undefined && (previous.page.body.sha256 !== candidate.page.body.sha256 || previous.page.header.sha256 !== candidate.page.header.sha256)) throw new Error('Grid strip page is not deterministic');
    unique.set(key, candidate);
  }
  const all = [...unique.values()].sort((a, b) => `${a.page.source}/${a.page.home}`.localeCompare(`${b.page.source}/${b.page.home}`));
  const product = new Map(products.map(row => [row.name, row]));
  const measured = new Map<string, number>();
  const wireOf = (file: CompiledGridArtifact): number => {
    let wire = measured.get(file.address.sha256);
    if (wire === undefined) { wire = servedBytes(file.bytes); measured.set(file.address.sha256, wire); }
    return wire;
  };
  const ownWire = new Map(all.map(candidate => [candidate, wireOf(candidate.header) + wireOf(candidate.body)]));
  let selected = all.filter(candidate => { const row = product.get(candidate.slug); return row?.ceiling !== undefined && row.bytes + (ownWire.get(candidate) ?? 0) <= row.ceiling; });
  let directory = artifact(json({ version: 1, pages: selected.map(candidate => candidate.page) }), 'json', 'book');
  for (;;) {
    const wire = servedBytes(directory.bytes), blockedHomes = new Set(all.filter(candidate => {
      const row = product.get(candidate.slug); return row?.ceiling === undefined || row.bytes + wire > row.ceiling;
    }).map(candidate => candidate.page.home));
    const next = selected.filter(candidate => {
      const row = product.get(candidate.slug);
      return !blockedHomes.has(candidate.page.home) && row?.ceiling !== undefined && row.bytes + (ownWire.get(candidate) ?? 0) + wire <= row.ceiling;
    });
    if (next.length === selected.length) break;
    selected = next; directory = artifact(json({ version: 1, pages: selected.map(candidate => candidate.page) }), 'json', 'book');
  }
  const homes = [...new Set(selected.map(candidate => candidate.page.home))].sort();
  const directoryWire = servedBytes(directory.bytes);
  // A directory may be fetched on another mode of an eligible home even if that mode has no body entry.
  for (const candidate of all) if (homes.includes(candidate.page.home)) {
    const row = product.get(candidate.slug);
    if (row?.ceiling === undefined || row.bytes + directoryWire > row.ceiling) throw new Error(`Grid strip directory exceeds ${candidate.slug}'s I12 ceiling`);
  }
  const chosen = new Set(selected), artifacts = selected.flatMap(candidate => [candidate.header, candidate.body]);
  if (selected.length > 0) artifacts.push(directory);
  const files = new Map<string, CompiledGridAddress>();
  const folder = join(root, 'out/.app/grid-strip-pages'); rmSync(folder, { recursive: true, force: true }); mkdirSync(folder, { recursive: true });
  for (const file of artifacts) {
    const previous = files.get(file.address.url);
    if (previous !== undefined && previous.sha256 !== file.address.sha256) throw new Error('Grid strip content URL collision');
    files.set(file.address.url, file.address);
    writeFileSync(join(folder, basename(file.address.url)), file.bytes);
  }
  const rows: GridStripWireRow[] = all.map(candidate => {
    const row = product.get(candidate.slug), included = chosen.has(candidate);
    return { source: candidate.page.source, home: candidate.page.home, slug: candidate.slug, included,
      product: row?.bytes ?? null, ceiling: row?.ceiling ?? null,
      added: included ? (ownWire.get(candidate) ?? 0) + directoryWire : homes.includes(candidate.page.home) ? directoryWire : 0 };
  });
  const result: CompiledGridBuild = { ...(selected.length === 0 ? {} : { geometry: { directory: directory.address, homes } }), files: [...files.values()], rows };
  writeFileSync(join(root, 'out/.app/grid-strip-index.json'), JSON.stringify({ seams, ...result }));
  return result;
}
