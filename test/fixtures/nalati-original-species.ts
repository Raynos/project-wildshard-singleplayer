// oxlint-disable-next-line import/no-nodejs-modules -- Native compilation stays outside DOM workers and their globals.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Every immutable test cache loan is checked against complete original pins.
import { existsSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the frozen oracle beneath repository tmp.
import { resolve } from 'node:path';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import pins from './nalati-species-files.json' with { type: 'json' };

const names = ['species.json', 'bodies.bin', 'boot.json', 'held-weapons.wasm', 'held-witness.bin'];
const metadata = pins[0];
if (metadata === undefined || pins.length !== names.length) throw new Error('Missing original species file inventory');
const original = metadata;

/** Source-built immutable predecessor oracle; never evidence for the current producer's correctness.
 * The cold construction uses the real compiler in Node. Every hit checks all five complete original pins. */
export function originalSpeciesFiles(directory = `tmp/nalati-original-species/${original.sha256}`): ReadonlyMap<string, Uint8Array<ArrayBuffer>> {
  const root = resolve(directory);
  if (!existsSync(root)) execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs',
    'test/fixtures/prepare-nalati-original-species.ts', root], { stdio: ['ignore', 'pipe', 'pipe'] });
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  for (const [index, pin] of pins.entries()) {
    const name = names[index];
    if (name === undefined) throw new Error('Unknown original species file');
    const bytes = Uint8Array.from(readFileSync(resolve(root, name)));
    if (bytes.length !== pin.bytes || hashImmutableBytes(bytes) !== pin.sha256) throw new Error(`Original species test cache differs: ${name}`);
    files.set(name, bytes);
  }
  return files;
}

let prepared: ReadonlyMap<string, Uint8Array<ArrayBuffer>> | undefined;
/** Each legacy fixture borrows detached bytes from the same full pinned source oracle. */
export function originalSpeciesFile(name: string): Uint8Array<ArrayBuffer> {
  prepared ??= originalSpeciesFiles();
  const bytes = prepared.get(name);
  if (bytes === undefined) throw new Error(`Unknown original species file: ${name}`);
  return bytes.slice();
}

/** Admit the full original JSON at each existing fixture's own schema boundary. */
export function originalSpeciesJson(name: 'species.json' | 'boot.json'): unknown {
  const value: unknown = JSON.parse(new TextDecoder().decode(originalSpeciesFile(name)));
  return value;
}

/** Historical output identities select pinned bytes without reopening retired publications. */
export function originalSpeciesOutput(path: string): Uint8Array<ArrayBuffer> {
  const name = names[pins.findIndex(pin => pin.path === path)];
  if (name === undefined) throw new Error(`Unknown original species output: ${path}`);
  return originalSpeciesFile(name);
}
