// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only the generated schema catalogue fixture.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep generated test output inside the repository scratch directory.
import { resolve, join } from 'node:path';
import { writeFormatJsonSchemas } from '../scripts/gen-format-schema.mjs';
import { expect, test } from 'vitest';
import { customSectionIdentityFailures, compareCustomSections } from '../scripts/custom-section-policy.mjs';

const source = '@wildshard/format/demo#DemoSchema', schema = { $comment: source, type: 'object', additionalProperties: false };
const budgets = { 'custom-sections/demo/count': 2, 'custom-sections/demo/bytes': 100 };
const policy = { version: 1, baselineAt: 'a'.repeat(40), baseline: { demo: { count: 2, bytes: 100 } },
  freeze: { at: 'b'.repeat(40), names: { demo: ['custom/old', 'old.json'] } } };
const failures = (name: string, jsonSchema?: unknown) => customSectionIdentityFailures(policy,
  { demo: { customSections: [{ name, bytes: 1, ...(jsonSchema === undefined ? {} : { jsonSchema }) }] } }, { [source]: schema });

test('existing names remain usable and retirement cannot fund another custom section', () => {
  expect(failures('custom/old')).toEqual([]); expect(failures('old.json')).toEqual([]);
  expect(failures('custom/new')).toEqual(['demo: new custom section custom/new is frozen']);
  expect(customSectionIdentityFailures(policy, { other: { customSections: [{ name: 'custom/old', bytes: 1 }] } }, {})).toHaveLength(1);
});

test('new JSON requires the exact shared schema, not a source label or missing definition', () => {
  expect(failures('new.json', schema)).toEqual([]);
  expect(failures('new.json', { additionalProperties: false, type: 'object', $comment: source })).toEqual([]);
  for (const value of [undefined, {}, { ...schema, $comment: 'src/shards/demo/schema.ts#LocalSchema' },
    { ...schema, $comment: '@wildshard/format/missing#Schema' }, { ...schema, type: 'number' }])
    expect(failures('new.json', value)).toEqual(['demo: new named JSON new.json needs verified shared-format schema provenance']);
});

test('freeze identities only shrink and cannot rebase, disappear or grant another shard the names', () => {
  expect(compareCustomSections(budgets, budgets, policy, policy)).toEqual([]);
  expect(compareCustomSections(budgets, budgets, policy, { ...policy, freeze: { ...policy.freeze, names: { demo: [] } } })).toEqual([]);
  for (const freeze of [undefined, { ...policy.freeze, at: 'c'.repeat(40) },
    { ...policy.freeze, names: { demo: ['old.json', 'new.json'] } }, { ...policy.freeze, names: { other: ['old.json'] } }])
    expect(compareCustomSections(budgets, budgets, policy, { ...policy, ...(freeze === undefined ? {} : { freeze }),
      ...(freeze === undefined ? { freeze: undefined } : {}) })).not.toEqual([]);
});

test('the ordinary format generator independently emits the provenance catalogue alongside existing schemas', () => {
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp', 'named-schema-catalogue-'));
  try {
    writeFormatJsonSchemas(root);
    const catalogue: unknown = JSON.parse(readFileSync(join(root, '.wildshard/format/named.json'), 'utf8'));
    if (typeof catalogue !== 'object' || catalogue === null) throw new Error('Missing generated catalogue');
    const name = '@wildshard/format/clientChannels#WorldSceneSchema';
    expect(Object.hasOwn(catalogue, name)).toBe(true);
    expect(existsSync(join(root, '.wildshard/format/plumbing.schema.json'))).toBe(true);
    expect(Object.keys(catalogue).length).toBeGreaterThan(100);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
