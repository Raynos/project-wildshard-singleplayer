// oxlint-disable-next-line import/no-nodejs-modules -- Audit the isolated authoring tree.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the real admission module in an isolated transport fixture.
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Invoke the production loader without module mocks.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep malformed cache fixtures outside source.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture files and the real loader.
import { join } from 'node:path';
import { linkNodeModules } from '../scripts/link-node-modules.mjs';
import { expect, it } from 'vitest';
import { expectKeyedClosure } from './fixtures/authoringClosure';
import { auditAuthoringInputs } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';
import { parseBakedTerrain } from '@wildshard/format/bakedTerrainBytes';
import { bakedSamplers } from '@wildshard/engine/world/BakedTerrain';
import { driftwoodGroundBytes } from '../src/shards/driftwood-isle/generators/groundRows';
import { driftwoodGroundSampler } from '../src/shards/driftwood-isle/generators/groundSampling';
import { WORLD_DROP } from '../src/shards/driftwood-isle/data/landscapeRows';
import { DRY_ENTRIES } from '../src/shards/driftwood-isle/data/entryRows';
import { ENTRY_DECKS } from '../src/shards/driftwood-isle/data/entryDecks';
import { driftwoodEntryDeckRows, deckRects, deckSlabs, deckPlacements } from '../src/shards/driftwood-isle/generators/entryDeck';
import { deckRects as originalRects, deckSlabs as originalSlabs, deckPlacements as originalPlacements } from '../src/shards/driftwood-isle-legacy/world/entryDeck';

it('preserves the actual native bilinear height and datum for 10k independent samples', () => {
  const grid = parseBakedTerrain(new Uint8Array(driftwoodGroundBytes()).buffer);
  if (grid === null) throw new Error('Missing cold authored lattice');
  const original = bakedSamplers(grid).heightAt, actual = driftwoodGroundSampler();
  for (let index = 0; index < 10_000; index++) {
    const x = ((index * 137.031) % 620) - 310, z = ((index * 71.917) % 620) - 310;
    expect(actual(x, z)).toBe(original(x, z) - WORLD_DROP);
  }
  for (const x of [-250, 0, 250]) for (const z of [-250, 0, 250]) {
    expect(actual(x, z)).toBe(original(x, z) - WORLD_DROP);
  }
});

it('preserves frozen road frames, foam slabs and seabed columns including ordered subsets', () => {
  const ground = driftwoodGroundSampler();
  for (const edges of [DRY_ENTRIES, [...DRY_ENTRIES].reverse(), ['east', 'north'] as const, []]) {
    expect(deckRects(edges)).toEqual(originalRects(edges));
    expect(deckSlabs(edges)).toEqual(originalSlabs(edges));
    expect(deckPlacements(edges, ground)).toEqual(originalPlacements(edges, ground));
  }
  const rows = driftwoodEntryDeckRows().rows;
  expect(rows.map(row => row.rect)).toEqual(originalRects(DRY_ENTRIES));
  expect(rows.map(row => row.slab)).toEqual(originalSlabs(DRY_ENTRIES));
  expect(rows.map(row => row.placement)).toEqual(originalPlacements(DRY_ENTRIES, ground));
  expect(ENTRY_DECKS).toEqual(rows);
});

it('refuses missing, reordered, duplicated and malformed cached slabs at module admission', () => {
  const source = driftwoodEntryDeckRows(), rows = source.rows;
  const negative = structuredClone(source), nonfinite = structuredClone(source);
  for (const row of negative.rows) row.rect.maxX = row.rect.minX;
  for (const row of nonfinite.rows) row.placement.params.bed = Number.NaN;
  const first = rows[0];
  if (first === undefined) throw new Error('Missing north landing');
  const invalid = [
    { ...source, rows: rows.slice(1) }, { ...source, rows: [...rows].reverse() },
    { ...source, rows: rows.map(() => rows[0]) }, negative, nonfinite,
    { ...source, rows: [{ ...first, placement: { ...first.placement, y: 1 } }, ...rows.slice(1)] },
  ];
  const root = process.cwd(), stage = realpathSync(mkdtempSync(join(tmpdir(), 'dw-entry-admission-')));
  const data = 'src/shards/driftwood-isle/data';
  try {
    mkdirSync(join(stage, data), { recursive: true });
    for (const file of ['entryDecks.ts', 'entryRows.ts']) copyFileSync(join(root, data, file), join(stage, data, file));
    copyFileSync(join(root, 'package.json'), join(stage, 'package.json'));
    linkNodeModules(root, stage);
    const loader = 'src/sdk/bake/source-loader.mjs', entry = 'src/shards/driftwood-isle/generators/admission.mjs';
    mkdirSync(join(stage, 'src/sdk/bake'), { recursive: true });
    mkdirSync(join(stage, 'src/shards/driftwood-isle/generators'), { recursive: true });
    copyFileSync(join(root, loader), join(stage, loader));
    writeFileSync(join(stage, entry), "import { ENTRY_DECKS } from '../data/entryDecks.ts'; console.log(ENTRY_DECKS.length);\n");
    const load = (): string => execFileSync(process.execPath, ['--import', `./${loader}`, entry],
      { cwd: stage, encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
    writeFileSync(join(stage, data, 'entryDecks.generated.json'), JSON.stringify(source));
    expect(load().trim()).toBe('4');
    for (const payload of invalid) {
      writeFileSync(join(stage, data, 'entryDecks.generated.json'), JSON.stringify(payload));
      expect(load).toThrow(/ValiError/u);
    }
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
});

it('registers a complete author-only deck job with no retained terrain or geometry seed', () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'driftwood-entry-decks');
  if (job === undefined) throw new Error('Missing authored deck component');
  const audits = [job.entry, 'src/sdk/bake/source-loader.mjs'].map(entry => auditAuthoringInputs(root, 'driftwood-isle', entry));
  expect(audits.flatMap(audit => audit.issues)).toEqual([]);
  const inputs = [...new Set([...audits.flatMap(audit => audit.files), 'src/sdk/bake/json.mjs', 'src/sdk/package.json',
    'src/format/package.json', 'package.json', 'pnpm-lock.yaml'])].sort();
  expectKeyedClosure(job.inputRoots, inputs, 'driftwood-isle');
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['src/shards/driftwood-isle/data/entryDecks.generated.json']);
  expect(inputs.some(file => file.includes('/runtime/') || file.includes('-legacy/') || file.endsWith('terrain.bin'))).toBe(false);
});
