// oxlint-disable-next-line import/no-nodejs-modules -- Read only the independently authored model inputs for the frozen oracle.
import { readFileSync } from 'node:fs';
import { bakeModelPaint } from '../../src/shards/nalati-grasslands/generators/modelPaint.mjs';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import originals from './nalati-model-paint.json' with { type: 'json' };

const prepared = new Map<string, Promise<Uint8Array>>();

/** Rebuild the original painter output from authored inputs, checking its complete historical pin before every loan. */
export async function originalPaintedModel(file: string): Promise<Uint8Array> {
  const pin = originals.find(row => row.file === file), name = file.split('.')[0];
  if (pin === undefined || name === undefined) throw new Error('Missing original painted model pin');
  let pending = prepared.get(file);
  if (pending === undefined) {
    pending = bakeModelPaint(readFileSync(`public/assets/nalati/models/${file}`), name);
    prepared.set(file, pending);
  }
  const bytes = await pending;
  if (bytes.length !== pin.bytes || hashImmutableBytes(bytes) !== pin.sha256) throw new Error(`Original painted model differs: ${file}`);
  return Uint8Array.from(bytes);
}
