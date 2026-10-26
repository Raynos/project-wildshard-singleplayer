// oxlint-disable-next-line import/no-nodejs-modules -- Cache only a complete immutable test oracle under repository tmp.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep fixture preparation and atomic publication beneath its owned directory.
import { resolve } from 'node:path';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import pins from './nalati-place-wires.json' with { type: 'json' };

const pin = pins.find(row => row.path === 'public/assets/nalati/baked/places.bin');
if (pin === undefined) throw new Error('Missing original Places binary pin');
const original = pin;
function checked(bytes: Uint8Array): Uint8Array {
  if (bytes.byteLength !== original.bytes || hashImmutableBytes(bytes) !== original.hash) throw new Error('Original Places test cache differs');
  return Uint8Array.from(bytes);
}

/** Materialize the immutable original binary once; every hit rechecks its full pin.
 * This caches a frozen test oracle, never the current producer's correctness evidence. */
export async function originalPlaceBinary(directory = 'tmp/nalati-original-place-binary'): Promise<Uint8Array> {
  const root = resolve(directory), file = resolve(root, `${original.hash}.bin`);
  if (existsSync(file)) return checked(readFileSync(file));
  const { nativePlaceFile } = await import('./nalati-native-place-files');
  const bytes = checked(nativePlaceFile('places.bin'));
  mkdirSync(root, { recursive: true });
  // Concurrent first readers publish only the same already-checked bytes.
  const stage = mkdtempSync(resolve(root, 'preparing-'));
  try {
    const temporary = resolve(stage, 'places.bin');
    writeFileSync(temporary, bytes);
    renameSync(temporary, file);
  } finally { rmSync(stage, { recursive: true, force: true }); }
  return bytes;
}
