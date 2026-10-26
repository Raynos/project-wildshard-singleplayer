// oxlint-disable-next-line import/no-nodejs-modules -- Read only the authored raw body and immutable original output pins.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { unzlibSync } from 'fflate';
import { CreatureGuestSchema } from '../src/format/speciesBookRows';
import { unshuffleLanes } from '../src/engine/core/deflate';
import { readDecisionSources } from '../src/sdk/buildDecisionScripts';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { prepareNalatiSpecies, type NalatiSpeciesPreparation, type NalatiSpeciesSourceInputs } from '../src/shards/nalati-grasslands/generators/speciesPreparation';
import originals from './fixtures/nalati-species-files.json' with { type: 'json' };

const authored = readDecisionSources('src/shards/nalati-grasslands');
const raw = unshuffleLanes(unzlibSync(readFileSync('public/assets/nalati/baked/bodies.bin')));
function readJson(path: string): unknown {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return value;
}
const inputSchema = v.object({
  body: v.object({ bytes: v.number(), bodies: v.array(v.object({ key: v.string(), bones: v.array(v.looseObject({ name: v.string() })),
    dims: v.unknown(), fur: v.array(v.array(v.number())), hard: v.array(v.array(v.number())), eye: v.array(v.array(v.number())) })) }),
  admission: v.looseObject({ script: v.record(v.string(), v.unknown()), bytes: v.string(), compiled: v.optional(v.unknown()), v2: v.optional(v.unknown()) }),
  strike: v.unknown(), kingPose: v.object({ programs: v.unknown(), group: v.string() }),
});
const strikes = v.parse(v.object({ balbal: v.unknown() }), readJson('src/shards/nalati-grasslands/data/strikeProfiles.generated.json'));
const metadata: unknown = { body: readJson('src/shards/nalati-grasslands/data/bodies.json'),
  admission: readJson('src/shards/nalati-grasslands/behaviour/admission.generated.json'),
  strike: strikes.balbal, kingPose: readJson('src/shards/nalati-grasslands/data/goldenKingPose.generated.json') };
if (!v.is(inputSchema, metadata)) throw new Error('Invalid original species source metadata');
const input: NalatiSpeciesSourceInputs = metadata;

const admitGuest = (candidate: unknown): v.InferOutput<typeof CreatureGuestSchema> => v.parse(CreatureGuestSchema, candidate);
const bodyFile = (hash: string): string => `/assets/nalati/baked/bodies-${hash}.bin`;
const json = (value: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);

function files(made: NalatiSpeciesPreparation): Map<string, Uint8Array> {
  return new Map([
    ['src/shards/nalati-grasslands/data/species.generated.json', json(made.data)],
    [`public${made.body.file}`, made.body.bytes],
    ['src/shards/nalati-grasslands/boot/speciesRows.generated.json', json(made.boot)],
    ['src/shards/nalati-grasslands/behaviour/held-weapons.generated.wasm', made.selected],
    ['src/shards/nalati-grasslands/behaviour/held-witness.generated.bin', made.witness],
  ]);
}

function originalFiles(made: NalatiSpeciesPreparation): void {
  const actual = files(made);
  expect(actual.size).toBe(originals.length);
  for (const pin of originals) {
    const bytes = actual.get(pin.path); if (bytes === undefined) throw new Error(`Missing original species output ${pin.path}`);
    expect(bytes.length, pin.path).toBe(pin.bytes); expect(hashImmutableBytes(bytes), pin.path).toBe(pin.sha256);
    expect(Buffer.compare(bytes, readFileSync(pin.path)), pin.path).toBe(0);
  }
}

test('explicit source composition reproduces all five complete original files and both original modules', async () => {
  const before = JSON.stringify([...authored]), beforeInput = JSON.stringify(input), rawHash = hashImmutableBytes(raw);
  const made = await prepareNalatiSpecies(raw, authored, input, admitGuest, bodyFile);
  originalFiles(made);
  expect(WebAssembly.validate(made.selected)).toBe(true); expect(WebAssembly.validate(made.witness)).toBe(true);
  expect(JSON.stringify([...authored])).toBe(before); expect(JSON.stringify(input)).toBe(beforeInput); expect(hashImmutableBytes(raw)).toBe(rawHash);
  expect(authored.has('behaviour/weakPoints.generated.as')).toBe(false);
});

test('rebuilding has no shared byte or metadata loan after a prior result is mutated', async () => {
  const made = await prepareNalatiSpecies(raw, authored, input, admitGuest, bodyFile);
  made.selected.fill(0); made.witness.fill(0); made.body.bytes.fill(0);
  const data = v.parse(v.object({ poses: v.unknown() }), made.data);
  // The actual object is preserved by unknown admission; mutating its top-level
  // programme table must never affect the authored module or the next build.
  if (typeof data.poses !== 'object' || data.poses === null) throw new Error('Missing authored poses');
  Reflect.set(data.poses, 'horse', { changed: true });
  originalFiles(await prepareNalatiSpecies(raw, authored, input, admitGuest, bodyFile));
});

test('missing supplied AS refuses before a guest can be admitted despite complete original files on disk', async () => {
  for (const name of ['heldWeapons', 'balbal']) {
    const missing = new Map(authored); missing.delete(`behaviour/${name}.as`);
    await expect(prepareNalatiSpecies(raw, missing, input, () => { throw new Error('Unexpected guest admission'); }, bodyFile))
      .rejects.toThrow(`Missing authored species source: ${name}`);
  }
});

test('guest admission refusal remains fatal and cannot borrow an already generated species document', async () => {
  await expect(prepareNalatiSpecies(raw, authored, input, () => { throw new Error('Original guest refuses'); }, bodyFile)).rejects.toThrow('Original guest refuses');
  for (const pin of originals) expect(hashImmutableBytes(readFileSync(pin.path)), pin.path).toBe(pin.sha256);
});

test('missing supplied raw bodies refuses despite the complete retained packed bank on disk', async () => {
  await expect(prepareNalatiSpecies(new Uint8Array(), authored, input, admitGuest, bodyFile)).rejects.toThrow('Creature body source byte length differs');
  for (const pin of originals) expect(hashImmutableBytes(readFileSync(pin.path)), pin.path).toBe(pin.sha256);
});
