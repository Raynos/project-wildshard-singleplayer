// oxlint-disable-next-line import/no-nodejs-modules -- Audit this isolated source tree's authoring job.
import process from 'node:process';
import { expect, it } from 'vitest';
import { BoxCollider } from '@wildshard/sdk/physics';
import { auditAuthoringInputs } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';
import { DRY_ENTRIES } from '../src/shards/driftwood-isle/data/entryRows';
import { ENTRY_LANDINGS, decodeEntryLandings } from '../src/shards/driftwood-isle/data/entryLandings';
import { driftwoodEntryFloorScene, driftwoodEntryFloorRows } from '../src/shards/driftwood-isle/generators/entryFloors';

// The actual pre-migration G164/G170 slabs, including order, dimensions and full-width road contact.
const ORIGINAL = [
  { edge: 'north', box: { kind: 'box', x: 0, y: -0.1, z: 234.25, hx: 4, hy: 0.1, hz: 0.75, surface: 'stone' } },
  { edge: 'east', box: { kind: 'box', x: 234.25, y: -0.1, z: 0, hx: 0.75, hy: 0.1, hz: 4, surface: 'stone' } },
  { edge: 'south', box: { kind: 'box', x: 0, y: -0.1, z: -234.25, hx: 4, hy: 0.1, hz: 0.75, surface: 'stone' } },
  { edge: 'west', box: { kind: 'box', x: -234.25, y: -0.1, z: 0, hx: 0.75, hy: 0.1, hz: 4, surface: 'stone' } },
];

it('compiles all four original slabs through real SDK collider objects', () => {
  const scene = driftwoodEntryFloorScene();
  expect(scene.children.map(box => box.name)).toEqual(DRY_ENTRIES);
  expect(scene.children.every(box => box instanceof BoxCollider)).toBe(true);
  expect(driftwoodEntryFloorRows().rows).toEqual(ORIGINAL);
  expect(ENTRY_LANDINGS).toEqual(ORIGINAL);
});

it('returns independent authored data without retaining scene objects', () => {
  const first = driftwoodEntryFloorRows(), second = driftwoodEntryFloorRows();
  const row = first.rows[0];
  if (row === undefined) throw new Error('Missing original north landing');
  row.box.hx = 1;
  expect(second.rows).toEqual(ORIGINAL);
  const wire = JSON.stringify(second), restored: unknown = JSON.parse(wire);
  expect(decodeEntryLandings(restored)).toEqual(ORIGINAL);
});

it('refuses missing, reordered, duplicated and malformed cached slabs', () => {
  const source = driftwoodEntryFloorRows(), rows = source.rows;
  expect(() => decodeEntryLandings({ ...source, rows: rows.slice(1) })).toThrow();
  expect(() => decodeEntryLandings({ ...source, rows: [...rows].reverse() })).toThrow();
  expect(() => decodeEntryLandings({ ...source, rows: rows.map(() => rows[0]) })).toThrow();
  const negative = structuredClone(source), nonfinite = structuredClone(source);
  for (const row of negative.rows) row.box.hx = -1;
  for (const row of nonfinite.rows) row.box.y = Number.NaN;
  expect(() => decodeEntryLandings(negative)).toThrow();
  expect(() => decodeEntryLandings(nonfinite)).toThrow();
  const first = rows[0];
  if (first === undefined) throw new Error('Missing north landing');
  expect(() => decodeEntryLandings({ ...source, rows: [{ ...first, box: { ...first.box, surface: 'flesh' } }, ...rows.slice(1)] })).toThrow();
});

it('registers a complete author-only primitive-floor job without a retained data seed', () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'driftwood-entry-floors');
  if (job === undefined) throw new Error('Missing authored floor job');
  const roots = [job.entry, 'src/sdk/bake/source-loader.mjs'];
  const audits = roots.map(entry => auditAuthoringInputs(root, 'driftwood-isle', entry));
  expect(audits.flatMap(audit => audit.issues)).toEqual([]);
  const inputs = [...new Set([...audits.flatMap(audit => audit.files), 'src/sdk/bake/json.mjs', 'src/sdk/package.json',
    'src/format/package.json', 'package.json', 'pnpm-lock.yaml'])].sort();
  expect(job.inputRoots).toEqual(inputs);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['src/shards/driftwood-isle/data/entryFloors.generated.json']);
  if (job.buildOutputs === undefined) throw new Error('Missing admitted floor hash');
  expect(Object.keys(job.buildOutputs)).toEqual(job.outputs);
  expect(Object.values(job.buildOutputs)).toEqual([expect.stringMatching(/^[a-f0-9]{64}$/u)]);
  expect(job.outputs).not.toContain('src/shards/driftwood-isle/runtime/navmesh.baked.json');
});
