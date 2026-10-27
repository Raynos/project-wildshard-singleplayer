// oxlint-disable-next-line import/no-nodejs-modules -- Complete original scalar publication captured before retirement.
import { readFileSync } from 'node:fs';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import { nameBlob, type NamedBlob } from '../../src/sdk/blobs';
import type { ProjectOutput } from '../../src/sdk/projectOutput';
import pins from './nalati-geography-files.json' with { type: 'json' };

/** Fresh complete predecessor loans, checked against all fifteen original file pins. */
export function originalGeographyFiles(): ReadonlyMap<string, Uint8Array> {
  const prefix = 'src/shards/nalati-grasslands/', files = new Map<string, Uint8Array>();
  const bank = new Uint8Array(readFileSync('test/fixtures/nalati-geography-original.bin'));
  let offset = 0;
  for (const pin of pins) {
    const file = pin.path.slice(prefix.length);
    if (file.endsWith('.bin')) { files.set(file, bank.slice(offset, offset + pin.bytes)); offset += pin.bytes; }
  }
  if (offset !== bank.length) throw new Error('Original geography bank extent differs');
  files.set('boot/geography.generated.json', new Uint8Array(readFileSync('test/fixtures/nalati-geography-original.json')));
  files.set('data/populationField.generated.json', new Uint8Array(readFileSync('test/fixtures/nalati-population-field-original.json')));
  files.set('boot/geography.generated.d.json.ts', new TextEncoder().encode("import type { GeographyRows } from '../data/geographyTypes';\ndeclare const rows: GeographyRows;\nexport default rows;\n"));
  for (const pin of pins) {
    const bytes = files.get(pin.path.slice(prefix.length));
    if (bytes === undefined || bytes.length !== pin.bytes || hashImmutableBytes(bytes) !== pin.sha256) throw new Error(`Original geography differs ${pin.path}`);
  }
  return files;
}

/** Preserve the raw predecessor's original logical intake order and admission costs. */
export function originalGeographyBlob(row: NonNullable<ProjectOutput['blobs']>[number]): NamedBlob | undefined {
  if (!row.source.startsWith('data/geography-')) return undefined;
  const bytes = originalGeographyFiles().get(row.source);
  if (bytes === undefined || row.kind !== 'bin' || row.name !== row.source) throw new Error('Invalid original geography source');
  return nameBlob(row.name, row.kind, bytes, row.options);
}
