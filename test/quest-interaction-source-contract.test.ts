// oxlint-disable-next-line import/no-nodejs-modules -- Node-only contract test hashes the exact original emitted wire.
import {createHash} from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only contract test reads its immutable emitted-body fixture.
import {readFileSync} from 'node:fs';
import {expect, test} from 'vitest';
import * as v from 'valibot';
import {QuestInteractionSourceSchema} from '@wildshard/format/questInteractionSource';
import {REGISTERED_JSON, validateRegisteredJson} from '@wildshard/format/registeredJson';
import {platformFileFamily, validatePlatformFile} from '@wildshard/format/platformFileFamilies';
import {bindInteractPlacements} from '@wildshard/engine/world/interact/types';
import {validateTable} from '@wildshard/engine/world/interact/validate';
import {registeredJsonSchema, namedJsonSchema} from '@wildshard/sdk/formatJsonSchema';
import {encodeCanonicalJson} from '@wildshard/sdk/immutable';
import {nameBlob} from '@wildshard/sdk/blobs';
import {emptyShardfile} from '@wildshard/sdk/author';
import {createShardProduct} from '@wildshard/game/shardfile/shardProduct';
import {DRIFTWOOD_INTERACT} from '../src/shards/driftwood-isle/generators/interactables';
import spots from '../src/shards/driftwood-isle/data/spotsRows.json';
import {fixtureJsonCheck} from './fixtures/productFile';

const name = 'quests/interaction-source.json';
const source = '@wildshard/format/questInteractionSource#QuestInteractionSourceSchema';
const hash = '256fcf3032ace6fb1f52d72ce3e0c0d2ab2c0e9dc94bbd1620b4cb2e4166a936';
const body = readFileSync(new URL('fixtures/driftwood-interaction-source.json', import.meta.url));
const raw: unknown = JSON.parse(body.toString('utf8'));
const input = () => v.parse(QuestInteractionSourceSchema, structuredClone(raw));
const encode = (value: unknown): Uint8Array => new TextEncoder().encode(encodeCanonicalJson(value));
const identity = {slug: 'interaction-contract', name: 'Interaction contract', author: 'Test', revision: 1, seed: 1};

test('the complete original authoring, native table and placed metadata retain all 9886 bytes', () => {
  expect(body.byteLength).toBe(9886);
  expect(createHash('sha256').update(body).digest('hex')).toBe(hash);
  const authored = {constants: {interact: DRIFTWOOD_INTERACT, interactSpots: spots.rows}};
  expect(encodeCanonicalJson(authored)).toBe(body.toString('utf8'));
  const parsed = input();
  expect(parsed).toEqual(raw);
  expect(encodeCanonicalJson(parsed)).toBe(body.toString('utf8'));
  expect(parsed.constants.interact.rows).toHaveLength(30);
  expect(parsed.constants.interactSpots).toHaveLength(30);
  expect(validateTable(parsed.constants.interact, {items: ['doubloon']})).toEqual([]);
  const placed = bindInteractPlacements(parsed.constants.interact, parsed.constants.interactSpots);
  expect(validateTable(placed, {items: ['doubloon']})).toEqual([]);
  expect(placed).toEqual(bindInteractPlacements(DRIFTWOOD_INTERACT, spots.rows));
  expect(parsed.constants.interactSpots.some(row => row.prompt !== undefined)).toBe(true);
  expect(parsed.constants.interactSpots.some(row => row.collider !== undefined)).toBe(true);
});

test('only the exact name and defining root gain family credit without rewriting the wire', () => {
  expect(REGISTERED_JSON[name].schema).toBe(QuestInteractionSourceSchema);
  expect(REGISTERED_JSON[name].source).toBe(source);
  const schema = registeredJsonSchema(name);
  expect(schema).toEqual({...namedJsonSchema(QuestInteractionSourceSchema), $comment: source});
  expect(platformFileFamily(name, source)?.schema).toBe(QuestInteractionSourceSchema);
  expect(platformFileFamily(name, 'foreign')).toBeUndefined();
  expect(platformFileFamily('quests/interaction-source-copy.json', source)).toBeUndefined();
  const value = input(), before = encodeCanonicalJson(value);
  validateRegisteredJson(name, value);
  expect(validatePlatformFile(name, source, value)?.schema).toBe(QuestInteractionSourceSchema);
  expect(nameBlob(name, 'json', encode(value), {jsonSchema: schema}).bytes).toEqual(encode(raw));
  expect(encodeCanonicalJson(value)).toBe(before);
});

test('whole-document admission refuses omitted, extra, nonfinite or mismatched placement data', () => {
  const extra = {...input(), extra: true};
  const absent = {constants: {interact: input().constants.interact}};
  const duplicate = input(), first = duplicate.constants.interactSpots[0];
  if (first === undefined) throw new Error('Missing baseline placement');
  duplicate.constants.interactSpots.push(structuredClone(first));
  const mismatch = input(), changed = mismatch.constants.interactSpots[0];
  if (changed === undefined) throw new Error('Missing baseline placement');
  changed.kind = 'foreign-kind';
  const nonfinite = input(), badPoint = nonfinite.constants.interactSpots[0];
  if (badPoint === undefined) throw new Error('Missing baseline placement');
  badPoint.x = Infinity;
  const extraMetadata = input(), metadata = extraMetadata.constants.interactSpots[0];
  if (metadata === undefined) throw new Error('Missing baseline placement');
  Object.assign(metadata, {unadmitted: true});
  const foreignPoi = input(), foreignRow = foreignPoi.constants.interact.rows[0];
  if (foreignRow === undefined) throw new Error('Missing baseline interaction');
  Object.assign(foreignRow.at, {poi: 'foreign-frame'});
  for (const bad of [extra, absent, duplicate, mismatch, nonfinite, extraMetadata, foreignPoi]) {
    expect(() => v.parse(QuestInteractionSourceSchema, bad)).toThrow();
    expect(() => validateRegisteredJson(name, bad)).toThrow();
  }
  expect(() => bindInteractPlacements(input().constants.interact, duplicate.constants.interactSpots)).toThrow();
  expect(() => bindInteractPlacements(input().constants.interact, mismatch.constants.interactSpots)).toThrow();
});

test('the original native flag, item and placed-world refusals stay authoritative after parsing', () => {
  const missingFlags = input(); missingFlags.constants.interact.external = [];
  expect(validateTable(missingFlags.constants.interact).some(error => error.includes('nothing raises'))).toBe(true);
  expect(validateTable(input().constants.interact, {items: []}).some(error => error.includes('unknown item'))).toBe(true);
  const outside = input(), placement = outside.constants.interactSpots[0];
  if (placement === undefined) throw new Error('Missing baseline placement');
  placement.x = 251;
  const parsed = v.parse(QuestInteractionSourceSchema, outside);
  expect(validateTable(bindInteractPlacements(parsed.constants.interact, parsed.constants.interactSpots)).some(error => error.includes('outside the chunk'))).toBe(true);
});

test('missing or foreign provenance refuses before product reads and forged schemas refuse at emission', async () => {
  for (const schema of [undefined, {}, {$comment: 'foreign'}]) {
    let reads = 0;
    const product = createShardProduct({slug: identity.slug, revision: 1, shardfile: emptyShardfile(identity), sections: new Map(),
      files: new Map([[name, {hash, url: 'https://example.test/interaction', ...(schema === undefined ? {} : {jsonSchema: schema})}]]),
      read: () => {reads++; return Promise.resolve(encode(raw));}, builtJson: true});
    await expect(product.json(name)).rejects.toThrow('exact defining format contract');
    expect(reads).toBe(0);
  }
  expect(() => nameBlob(name, 'json', encode(raw))).toThrow('requires its defining schema');
  expect(() => nameBlob(name, 'json', encode(raw), {jsonSchema: namedJsonSchema(QuestInteractionSourceSchema)})).toThrow('exact defining format contract');
  expect(() => nameBlob(name, 'json', encode(raw), {jsonSchema: {$schema: 'http://json-schema.org/draft-07/schema#', $comment: source, type: 'object'}})).toThrow('exact defining format contract');
});

test('built and external product readers retain the complete wire and external shape refusals', async () => {
  const productInput = {slug: identity.slug, revision: 1, shardfile: emptyShardfile(identity), sections: new Map(),
    files: new Map([[name, {hash, url: 'https://example.test/interaction', jsonSchema: registeredJsonSchema(name)}]]),
    read: () => Promise.resolve(encode(raw)), builtJson: true};
  expect(await createShardProduct(productInput).json(name)).toEqual(raw);
  expect(await createShardProduct({...productInput, builtJson: false, jsonCheck: fixtureJsonCheck}).json(name)).toEqual(raw);
  await expect(createShardProduct({...productInput, builtJson: false, jsonCheck: fixtureJsonCheck,
    read: () => Promise.resolve(encode({...input(), extra: true}))}).json(name)).rejects.toThrow();
});
