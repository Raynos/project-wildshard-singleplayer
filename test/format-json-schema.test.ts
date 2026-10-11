// oxlint-disable-next-line import/no-nodejs-modules -- Generated schema fixtures own their temporary output folder.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures use the system temporary folder.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect only the fixture's generated documents.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import * as v from 'valibot';
import { EdgeProfileSchema } from '@wildshard/format/edgeProfiles';
import { StateSchema } from '@wildshard/format/state';
import { CommonsCostsSchema } from '@wildshard/format/commonsCosts';
import { PlumbingSchema, plumbingRules, type PlumbingData } from '@wildshard/format/plumbing';
import { formatJsonSchema, formatJsonSchemas } from '../src/sdk/formatJsonSchema';
import { writeFormatJsonSchemas } from '../scripts/gen-format-schema.mjs';

it('generates exact native sample-count branches and finite channel bounds from the defining edge schema', () => {
  const schema = formatJsonSchema(EdgeProfileSchema);
  expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  expect(schema.additionalProperties).toBe(false);
  expect(schema.anyOf).toEqual([256, 257].map(count => ({ properties: {
    heights: { minItems: count, maxItems: count }, colours: { minItems: count, maxItems: count },
  } })));
  expect(schema.properties?.['heights']).toEqual({ type: 'array', items: { type: 'number', minimum: -250, maximum: 250 } });
  expect(schema.properties?.['roadHeight']).toEqual({ const: 0 });
  const row = { heights: Array.from({ length: 256 }, () => 0), colours: Array.from({ length: 256 }, () => [0, 0.5, 1]), roadHeight: 0 };
  expect(v.safeParse(EdgeProfileSchema, row).success).toBe(true);
  expect(v.safeParse(EdgeProfileSchema, { ...row, colours: row.colours.slice(1) }).success).toBe(false);
});

it('keeps namespace, references and Debug defaults as explicitly mandatory semantic checks', () => {
  const schema = formatJsonSchema(PlumbingSchema);
  expect(schema['x-wildshard-checks']).toEqual(['@wildshard/format/plumbing#plumbingRules']);
  const text = JSON.stringify(schema);
  expect(text).toContain('utf16-code-units');
  expect(text).toContain('^E[1-9][0-9]*$');
  expect(text).toContain('maxLength');
  const row: PlumbingData = { namespace: 'fixture', input: [], knobs: [{ id: 'foreign.knob', phone: 1, desktop: 2 }], debug: [] };
  expect(v.safeParse(PlumbingSchema, row).success).toBe(false);
  expect(plumbingRules(row)).toEqual(['owned knob namespace']);
});

it('refuses a new custom validator, transform or even a check with a familiar message', () => {
  expect(() => formatJsonSchema(v.custom(() => true, 'namespaced id'))).toThrow();
  expect(() => formatJsonSchema(v.pipe(v.string(), v.check(() => true, 'valid scoped plumbing declarations')))).toThrow();
  expect(() => formatJsonSchema(v.pipe(v.string(), v.transform(value => value.trim())))).toThrow();
  expect(() => formatJsonSchema(v.pipe(PlumbingSchema, v.check(() => true, 'another semantic rule')))).toThrow();
});

it('rebuilds all migrated documents byte-identically without committing generated JSON', () => {
  const root = mkdtempSync(join(tmpdir(), 'format-json-schema-'));
  try {
    writeFormatJsonSchemas(root);
    const directory = join(root, '.wildshard/format');
    const files = readdirSync(directory).sort();
    expect(files).toEqual(Object.keys(formatJsonSchemas()).map(name => `${name}.schema.json`).sort());
    expect(files.length).toBe(89);
    const before = files.map(name => readFileSync(join(directory, name), 'utf8'));
    writeFormatJsonSchemas(root);
    expect(files.map(name => readFileSync(join(directory, name), 'utf8'))).toEqual(before);
    expect(before.every(text => text.includes('DO-NOT-EDIT'))).toBe(true);
    expect(Object.keys(formatJsonSchemas()).slice(0, 4)).toEqual(['edge-profiles', 'plumbing', 'state', 'commons-costs']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('retains typed state defaults and global capacity as defining semantic checks and exact commons bounds', () => {
  const state = formatJsonSchema(StateSchema);
  expect(state['x-wildshard-checks']).toEqual(['@wildshard/format/state#stateRules']);
  const value = { version: 1, sharedOwner: 'host', playerKey: 'actorId', shared: [], player: [
    { id: 1, name: 'health', type: 'i32', privacy: 'owner', default: 10, min: 0, max: 20 },
  ] };
  expect(v.safeParse(StateSchema, value).success).toBe(true);
  expect(v.safeParse(StateSchema, { ...value, player: [{ ...value.player[0], default: 21 }] }).success).toBe(false);
  expect(v.safeParse(StateSchema, { ...value, shared: value.player }).success).toBe(false);
  const costs = formatJsonSchema(CommonsCostsSchema);
  expect(costs.maxProperties).toBe(1024);
  expect(v.safeParse(CommonsCostsSchema, { ['a'.repeat(64)]: { decoded: 0, gpu: 0, triangles: 0, draws: 0 } }).success).toBe(true);
  expect(() => formatJsonSchema(v.pipe(StateSchema, v.check(() => true, 'state declaration semantic rules')))).toThrow();
});

it('documents defining creature, audio, director and migration checks without granting a familiar new validator', () => {
  const roots = formatJsonSchemas();
  expect(roots['brains.Guardian']?.['x-wildshard-checks']).toEqual(['@wildshard/format/brains#GuardianSchema.pipe.1']);
  expect(roots['director.Director']?.['x-wildshard-checks']).toEqual(['@wildshard/format/director#DirectorSchema.pipe.1']);
  expect(JSON.stringify(roots['audio.AudioData'])).toContain('@wildshard/format/audio#AudioDataSchema.entries.cues.pipe.2');
  expect(roots['runtimeBinds.RuntimeBinds']?.type).toBe('array');
  expect(roots['runtimeSpawns.RuntimeSpawns']?.additionalProperties).toBe(false);
  expect(() => formatJsonSchema(v.pipe(v.string(), v.check(() => true, 'Ordered guardian radii')))).toThrow();
});

it('retains presentation hashes, independent mesh chunk checks and strict hook/script declarations', () => {
  const roots = formatJsonSchemas();
  expect(roots['presentation.Presentation']?.additionalProperties).toBe(false);
  expect(JSON.stringify(roots['presentation.Presentation'])).toContain('^[a-f0-9]{64}$');
  expect(roots['meshCollision.MeshCollision']?.['x-wildshard-checks']).toEqual([1, 2, 3].map(index => `@wildshard/format/meshCollision#MeshCollisionSchema.pipe.${index}`));
  expect(roots['scripts.ScriptBindings']?.maxItems).toBe(10000);
  expect(roots['hooks.Hooks']?.additionalProperties).toBe(false);
});

it('documents exact terrain grids, bounded water and the closed twenty-accent palette', () => {
  const roots = formatJsonSchemas();
  expect(roots['terrain.Terrain']?.['x-wildshard-checks']).toEqual(['@wildshard/format/terrain#TerrainSchema.pipe.1']);
  expect(roots['water.Water']?.maxItems).toBe(64);
  expect(roots['accent.Accent']?.enum).toHaveLength(20);
  expect(roots['accent.Accent']?.enum).not.toContain('cyan');
});

it('documents item template identities and native item, target and quest reference checks', () => {
  const roots = formatJsonSchemas();
  const items = JSON.stringify(roots['items.Items']);
  expect(items).toContain('declared');
  expect(items).toContain('@wildshard/format/items#ItemsSchema.pipe.3');
  expect(roots['items.ItemFamilyName']?.maxLength).toBe(128);
  expect(roots['targets.Targets']?.additionalProperties).toBe(false);
  expect(roots['quests.QuestData']?.['x-wildshard-checks']).toEqual(['@wildshard/format/quests#QuestDataSchema.pipe.1']);
  expect(() => formatJsonSchema(v.custom<`weapon.${string}`>(() => true))).toThrow();
});

it('documents all entry variants and exact row/client/mover limits without broadening custom admission', () => {
  const roots = formatJsonSchemas();
  expect(JSON.stringify(roots['entryways.Entryways'])).toContain('socketLift');
  expect(JSON.stringify(roots['entryways.Entryways'])).toContain('portalLink');
  expect(JSON.stringify(roots['rows.Rows'])).toContain('@wildshard/format/rows#RowsSchema.pipe.3');
  expect(roots['movers.Movers']?.maxItems).toBe(32);
  expect(roots['nativeGround.NativeGround']?.additionalProperties).toBe(false);
  expect(roots['ui.Ui']?.maxItems).toBe(64);
  expect(JSON.stringify(roots['clientScripts.ClientScripts'])).toContain('maxOffset');
});

it('documents native client checkpoints and skin/script/runtime declarations without admitting new transforms', () => {
  const roots = formatJsonSchemas();
  expect(roots['runtime.Runtime']?.additionalProperties).toBe(false);
  expect(roots['skinData.SkinClipName']?.pattern).toContain('idle|walk|run');
  expect(JSON.stringify(roots['clientState.ClientCheckpoint'])).toContain('moverPending');
  expect(roots['liftRider.LiftRider']).toBeDefined();
  expect(roots['weaponHooks.WeaponHooks']?.additionalProperties).toBe(false);
  expect(roots['speciesScripts.ScriptSpecies']?.additionalProperties).toBe(false);
  expect(roots['eliteScripts.EliteScript']?.additionalProperties).toBe(false);
  expect(() => formatJsonSchema(v.pipe(v.string(), v.transform(value => value)))).toThrow();
});

it('documents remaining root wire bounds and defaults while preserving the material group for DS1.4', () => {
  const roots = formatJsonSchemas();
  expect(roots['shardSections.Files']?.maxItems).toBe(4096);
  expect(roots['shardSections.Tiles']?.maxItems).toBe(80);
  expect(roots['shardSections.Identity']?.additionalProperties).toBe(false);
  expect(JSON.stringify(roots['shardSections.Sim'])).toContain('@wildshard/format/shardSections#SimSchema');
});
