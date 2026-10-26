import type { BakedProps } from '@wildshard/sdk/bake/props';
import { completeL0Tiles, completeEmptyL1Tiles } from '@wildshard/sdk/bake/tileGrid';
import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import { skyIsleProps } from './isleProps';

/** Refuse an incomplete or foreign tile bank; every declared file owns its exact native bytes. */
export function assertSkyWorldTileFiles(files: ReadonlyMap<string, Uint8Array>): void {
  const metadata = files.get('data/props.json');
  if (metadata === undefined || metadata.byteLength === 0) throw new Error('Sky world tile metadata missing');
  const rows: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadata));
  if (typeof rows !== 'object' || rows === null || !('files' in rows) || !Array.isArray(rows.files) || rows.files.length === 0) {
    throw new Error('Sky world tile file inventory invalid');
  }
  const entries: readonly unknown[] = rows.files, names = new Set(['data/props.json']);
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null || !('hash' in entry) || typeof entry.hash !== 'string'
      || !/^[a-f0-9]{64}$/u.test(entry.hash) || !('compressed' in entry) || typeof entry.compressed !== 'number') {
      throw new Error('Sky world tile file row invalid');
    }
    const name = `assets/${entry.hash}`, bytes = files.get(name);
    if (names.has(name) || bytes === undefined || bytes.byteLength === 0 || bytes.byteLength !== entry.compressed || hashImmutableBytes(bytes) !== entry.hash) {
      throw new Error('Sky world tile asset inventory differs');
    }
    names.add(name);
  }
  if (files.size !== names.size) throw new Error('Sky world tile asset inventory differs');
}

/** Original asset insertion order and canonical metadata; publication stays with the caller. */
export function skyWorldTileFiles(baked: BakedProps): Map<string, Uint8Array> {
  if (baked.far !== null) throw new Error('Sky world tiles cannot include a far proxy');
  const files = [...baked.files].sort((a, b) => a.hash.localeCompare(b.hash));
  const tiles = completeEmptyL1Tiles(completeL0Tiles([...baked.tiles].sort((a, b) => a.lod - b.lod || a.x - b.x || a.z - b.z)));
  const output = new Map([...baked.assets].map(([hash, bytes]) => [`assets/${hash}`, bytes.slice()]));
  output.set('data/props.json', new TextEncoder().encode(encodeCanonicalJson({ props: baked.props, tiles, files, report: baked.report })));
  assertSkyWorldTileFiles(output);
  return output;
}

/** Compile the twelve original static islands without reading or publishing a generated handoff. */
export function skyWorldTileSource(): Map<string, Uint8Array> { return skyWorldTileFiles(skyIsleProps()); }
