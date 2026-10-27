// oxlint-disable-next-line import/no-nodejs-modules -- Read only committed, independently pinned predecessor bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The frozen fixture codec preserves the complete original GLB.
import { inflateSync } from 'node:zlib';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import { nameBlob, type NamedBlob } from '../../src/sdk/blobs';
import type { ProjectOutput } from '../../src/sdk/projectOutput';
import pins from './nalati-render-source-files.json' with { type: 'json' };

type Source = NonNullable<ProjectOutput['blobs']>[number];
const originals = new Map<string, Uint8Array>();

/** Preserve predecessor intake without reading a retired source handoff. */
export function originalRenderBlob(row: Source): NamedBlob | undefined {
  if (!row.source.startsWith('assets/world-terrain/ground-l1-')) return undefined;
  const pin = pins.find(file => file.path === row.source);
  const file = row.source.split('/').at(-1);
  if (pin === undefined || file === undefined || row.kind !== 'glb'
    || row.name !== `world/terrain/${file.replace('.generated.glb', '.glb')}`) throw new Error('Invalid original render pair declaration');
  let bytes = originals.get(row.source);
  if (bytes === undefined) {
    bytes = new Uint8Array(inflateSync(readFileSync(`test/fixtures/nalati-render-l1/${file.replace('.generated.glb', '.bin')}`)));
    if (bytes.byteLength !== pin.bytes || hashImmutableBytes(bytes) !== pin.sha256) throw new Error('Original render pair differs');
    originals.set(row.source, bytes);
  }
  return nameBlob(row.name, 'glb', bytes.slice(), row.options);
}
