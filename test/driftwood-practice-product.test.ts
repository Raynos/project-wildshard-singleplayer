import { afterAll, beforeAll, expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Own only the tiny generated practice-product fixture.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures remain under the repository scratch directory.
import { resolve } from 'node:path';
import { DECISION_PLAYER_HANDLE, buildDecisionRegistries } from '@wildshard/format/decisionBindings';
import { parseActorMoves } from '@wildshard/format/actorMoves';
import { readCreatureStrikes } from '@wildshard/format/creatures';
import { SCRIPT_LIMITS } from '@wildshard/format/scriptLimits';
import { parseDecisionScripts } from '@wildshard/format/decisionScripts';
import { readSpeciesPrograms } from '@wildshard/format/speciesPrograms';
import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import { scenario } from '@wildshard/sdk/scriptScenario';
import { validateOutputProduct } from '@wildshard/sdk/outputProduct';
import { buildDriftwoodPracticeProduct, createDriftwoodPracticeSource, DRIFTWOOD_PRACTICE_DECISION_MEMORY,
  DRIFTWOOD_PRACTICE_OUTPUT } from '../src/shards/driftwood-isle/generators/practiceProduct';
import { decisionLegacyLines } from '../scripts/decision-legacy-lines.mjs';

let root = '', destination = '';
beforeAll(async () => {
  mkdirSync('tmp', { recursive: true }); root = mkdtempSync(resolve('tmp/driftwood-practice-test-'));
  destination = resolve(root, 'practice');
  const lines = decisionLegacyLines(resolve('.'), 'driftwood-isle');
  if (lines === undefined) throw new Error('Missing sealed decision budget');
  await buildDriftwoodPracticeProduct(resolve('src/shards/driftwood-isle'), destination, { decisionLegacyLines: lines });
}, 60_000);
afterAll(() => { if (root !== '') rmSync(root, { recursive: true, force: true }); });

function section(name: string): unknown {
  const entry = validateOutputProduct(destination).index.sections.find(row => row.name === name);
  if (entry === undefined) throw new Error(`Missing practice section ${name}`);
  return JSON.parse(readFileSync(resolve(destination, entry.path), 'utf8'));
}

test('practice source has five identities, eleven explicit fields, five coin rows and no island content', () => {
  const source = createDriftwoodPracticeSource();
  expect(source.runtime?.spawns?.actors?.map(row => row.id)).toEqual([
    'driftwood.brine-puffer', 'driftwood.conch-duelist', 'driftwood.splinter-mantis', 'driftwood.bellback', 'driftwood.colossus',
  ]);
  expect(source.runtime?.spawns).toMatchObject({ homes: [], bosses: [] });
  expect(source.state.shared.map(row => row.id)).toEqual([101, 102, 103, 104, 105, 106, 110, 111, 112, 113, 114]);
  expect(source.rows.loot[0]?.economy?.tables?.[0]?.table.rows.map(row => [row.match.kind, row.count])).toEqual([
    ['brine-puffer', 2], ['conch-duelist', 3], ['splinter-mantis', 3], ['bellback', 12], ['tideRootColossus', 35],
  ]);
  expect(source.tiles).toEqual([]); expect(source.files).toEqual([]); expect(source.library).toEqual([]);
  expect(source.creatures.spawns).toEqual([]); expect(source.quests.quests).toEqual([]);
  expect(Object.keys(source.look.materials).sort()).toEqual([
    'driftwood-creature', 'driftwood-creature-glowing', 'driftwood-fp-arms', 'driftwood-fp-iron', 'driftwood-fp-swim', 'driftwood-fp-wood',
  ]);
  expect(DRIFTWOOD_PRACTICE_OUTPUT.platform?.sections.map(row => row.name).sort()).toEqual([
    'actors/moves', 'actors/species-programs', 'actors/strikes', 'held/arms', 'sim/scripts',
  ]);
});

test('practice product carries actual receipt, fresh Wasm, named poses and unchanged platform memory caps', () => {
  const product = validateOutputProduct(destination), { index, shard } = product;
  const scripts = parseDecisionScripts(section('sim/scripts'));
  expect(scripts).toHaveLength(5); expect(new Set(scripts.map(row => row.module)).size).toBe(5);
  expect(scripts.every(row => row.module !== `blobs/wasm/${'0'.repeat(64)}.wasm`)).toBe(true);
  expect(index.files.filter(row => row.kind === 'wasm')).toHaveLength(5);
  expect(index.files.filter(row => row.kind === 'json').map(row => row.name).sort((a, b) => (a ?? '').localeCompare(b ?? ''))).toEqual([
    'poses/bellback.json', 'poses/brine-puffer.json', 'poses/conch-duelist.json', 'poses/splinter-mantis.json', 'poses/tide-root-colossus.json', 'practice/bodies.json', 'practice/looks.json',
  ]);
  expect(index.files).toHaveLength(12); expect(index.runtime?.files).toEqual([]);
  expect(DRIFTWOOD_PRACTICE_DECISION_MEMORY).toBe(655360);
  expect(createDriftwoodPracticeSource().budgets.sim.resident).toBe(655360);
  expect(shard.budgets.sim.resident).toBe(655360 + index.files.filter(file => file.critical).reduce((sum, file) => sum + file.decoded + file.gpu, 0));
  expect(shard.serverBudget.memory).toBe(1655360);
  expect(SCRIPT_LIMITS.memoryBytes).toBe(24000000); expect(SCRIPT_LIMITS.instances).toBe(8);
  const receipt: unknown = JSON.parse(readFileSync(resolve(destination, 'validation.json'), 'utf8'));
  expect(receipt).toMatchObject({ revision: index.build.validator,
    indexHash: hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(index))) });
  const program = readSpeciesPrograms(section('actors/species-programs'));
  expect(program.program?.species.map(row => row.kind)).toEqual(['brine-puffer', 'conch-duelist', 'splinter-mantis', 'bellback', 'tideRootColossus']);
  expect(program).toMatchObject({ native: [], page: [] });
  expect(section('held/arms')).toMatchObject({ weapons: [{ item: 'weapon.driftwood-isle.wood', blade: 'wood' }], cards: [], claims: [] });
});

test('decision registry uses the exact practice subset and explicit field ids', () => {
  const product = validateOutputProduct(destination);
  const registry = buildDecisionRegistries(product.shard, parseActorMoves(section('actors/moves')), undefined,
    readCreatureStrikes(section('actors/strikes')), parseDecisionScripts(section('sim/scripts')));
  expect([...registry.actors ?? []]).toEqual([
    ['driftwood.bellback', 1], ['driftwood.brine-puffer', 2], ['driftwood.colossus', 3], ['driftwood.conch-duelist', 4], ['driftwood.splinter-mantis', 5],
  ]);
  expect(registry.fields?.get('conch-guard')).toBe(103); expect(registry.fields?.get('tg-exposed')).toBe(114);
  expect(registry.strikes?.size).toBe(11); expect(registry.moves?.size).toBe(5);
});

test.each([
  ['brine-puffer', 'driftwood.brine-puffer'], ['conch-duelist', 'driftwood.conch-duelist'],
  ['splinter-mantis', 'driftwood.splinter-mantis'], ['bellback', 'driftwood.bellback'], ['colossus', 'driftwood.colossus'],
])('actual emitted %s guest attacks through the real disk/DecisionHost path', async (kind, actor) => {
  const run = await scenario('practice', `driftwood.${kind}.decision`, { products: root, seed: 7,
    actors: [{ id: actor, at: [0, 0, 0] }], players: [{ id: DECISION_PLAYER_HANDLE, at: [0, 0, 1] }] });
  run.send('start'); const started = run.commands(); run.advance(2);
  expect([...started, ...run.commands()].some(row => row[0] === 'strike')).toBe(true);
  expect(run.trace().filter(row => row.kind === 'call').every(row => row.ok)).toBe(true);
  expect(run.maxFuel()).toBeLessThanOrEqual(SCRIPT_LIMITS.fuelPerCall);
});
