import { expect, test } from 'vitest';
import * as v from 'valibot';
import { WeatherGeometrySchema, WeatherGeometryPayloadSchema } from '@wildshard/format/weatherEffects';
import { ArenaScriptGeometrySchema } from '@wildshard/format/arenaScriptRows';
import { ArenaRoomDocumentSchema } from '@wildshard/format/arenaRoomDocument';
import { DecisionScriptsSchema, type DecisionScriptRowInput } from '@wildshard/format/decisionScripts';
import { titanFightOwners } from './fixtures/titanFightOwners';
import { CloudSpecimenSchema } from '@wildshard/format/encounterRows';
import { titanGeometryRows } from '../src/shards/nalati-grasslands/generators/stormTitanGeometry';

const data = { attributes: { position: { itemSize: 3, type: 'Float32Array', array: [0, 0, 0], normalized: false } } };
const full = { metadata: { version: 4.7, type: 'BufferGeometry', generator: 'BufferGeometry.toJSON' }, type: 'BufferGeometry', data };

test('native full and arrow data-only geometries retain their distinct complete envelopes', () => {
  const arrow = { data }, before = JSON.stringify(arrow);
  expect(v.safeParse(WeatherGeometryPayloadSchema, arrow).success).toBe(true);
  expect(JSON.stringify(arrow)).toBe(before);
  expect(v.safeParse(WeatherGeometrySchema, full).success).toBe(true);
  expect(v.safeParse(WeatherGeometrySchema, arrow).success).toBe(false);
  expect(v.safeParse(WeatherGeometryPayloadSchema, { data, metadata: {} }).success).toBe(false);
  for (const invalid of [
    { attributes: {} },
    { attributes: data.attributes, index: { type: 'Uint16Array', array: [1] } },
    { attributes: { ...data.attributes, normal: { itemSize: 3, type: 'Float32Array', array: [], normalized: false } } },
  ]) expect(v.safeParse(WeatherGeometryPayloadSchema, { data: invalid }).success).toBe(false);
});

test('the real two-tier Titan geometry validates every scene, geometry and pose without mutating its source', () => {
  const geometry = titanGeometryRows(), before = JSON.stringify(geometry);
  expect(v.safeParse(ArenaScriptGeometrySchema, geometry).success).toBe(true);
  expect(JSON.stringify(geometry)).toBe(before);
  for (const malformed of [
    { ...geometry, poses: [{}] },
    { ...geometry, eyes: {} },
    { ...geometry, body: { ...geometry.body, scene: {} } },
    { ...geometry, phone: { ...geometry.phone, flames: { data } } },
    { ...geometry, arena: { ...geometry.arena, geometry: { bad: {} } } },
  ]) expect(v.safeParse(ArenaScriptGeometrySchema, malformed).success).toBe(false);
  const body = { ...geometry.body, geometry: { ...geometry.body.geometry, eyes: geometry.eyes }, poses: geometry.poses };
  const specimen = { name: 'storm-titan', pose: {}, ports: {}, phone: { ...body, puffs: { ...body.puffs, rows: geometry.phone.puffs } },
    desktop: { ...body, puffs: { ...body.puffs, rows: geometry.desktop.puffs } } };
  expect(v.safeParse(CloudSpecimenSchema, specimen).success).toBe(true);
  expect(v.safeParse(CloudSpecimenSchema, { ...specimen, desktop: { ...specimen.desktop, poses: [{}] } }).success).toBe(false);
});

const script: DecisionScriptRowInput = {
  id: 'arena.fixture', abi: '1.0', side: 'sim', module: `blobs/wasm/${'a'.repeat(64)}.wasm`,
  source: 'behaviour/arena.as', binding: { shard: true }, onFail: 'hold',
  on: ['start'], reads: [], commands: [], stateVersion: 1, state: [], params: {},
};

test('the complete room document preserves original King, scene, portal and collider fields', () => {
  const program = { script: v.parse(DecisionScriptsSchema, [script])[0], bytes: '' };
  const room = titanFightOwners.arenaRoom, king = titanFightOwners.king;
  const value = { room, encounter: { ...king, definition: king.encounter, program } };
  const before = JSON.stringify(value);
  expect(v.safeParse(ArenaRoomDocumentSchema, value).success).toBe(true);
  expect(JSON.stringify(value)).toBe(before);
  for (const invalid of [
    { ...value, room: { ...room, view: { ...room.view, static: {} } } },
    { ...value, room: { ...room, collision: { ...room.collision, descs: [{ kind: 'box', x: 0 }] } } },
    { ...value, encounter: { ...value.encounter, portal: { ...king.portal, slow: 2 } } },
    { ...value, encounter: { ...value.encounter, tuning: { ...king.tuning, drifts: ['opaque'] } } },
    { ...value, encounter: { ...value.encounter, page: { ...king.page, profile: {} } } },
    { ...value, encounter: { ...value.encounter, program: { ...program, script: {} } } },
    { ...value, encounter: { ...value.encounter, program: { ...program, script: { ...program.script, pages: 5 } } } },
    { ...value, encounter: { ...value.encounter, program: { ...program, signal: 'formerly refused extra' } } },
  ]) expect(v.safeParse(ArenaRoomDocumentSchema, invalid).success).toBe(false);
});

test('the complete return envelope refuses a script accessor before reading it', () => {
  let reads = 0;
  const program = { get script() { reads++; return script; }, bytes: '' };
  const value = { room: titanFightOwners.arenaRoom,
    encounter: { ...titanFightOwners.king, definition: titanFightOwners.king.encounter, program } };
  expect(v.safeParse(ArenaRoomDocumentSchema, value).success).toBe(false);
  expect(reads).toBe(0);
});
