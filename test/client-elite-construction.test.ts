// oxlint-disable-next-line import/no-nodejs-modules -- Admit the actual programme and charge source without a static generated import.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { Scene, type Object3D } from 'three';
import { Scope } from '../src/engine/app/scope';
import type { Game } from '../src/engine/core/Game';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardWorld } from '../src/game/shard/world';
import type { ShardRuntime } from '../src/game/shard/runtime';
import type { TimedEncounters } from '../src/game/boss/timedEncounters';
import type { ForestWeatherRig } from '../src/game/weather/forest';
import { parseClientPlan } from '../src/format/clientPlan';
import { parseSpawnScript } from '../src/format/spawnScripts';
import { buildEliteEntryPageRows } from '../src/shards/nalati-grasslands/generators/eliteEntryRows';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { installClientEliteConstruction } from '../src/game/shardfile/clientEliteConstruction';
import { entryOwner, publishEntryOwner } from '../src/game/shardfile/entryOwners';
import { SceneDressing } from '../src/game/shardfile/sceneDressing';
import { ReturnProgram } from '../src/game/population/returnProgram';
import * as spawn from '../src/game/population/spawnScript';
import { sha256 } from '../src/game/plugin/moduleHash';
import { emptyShardfile } from '../src/sdk/author';
import { admission, lendNalatiAdmission } from './fixtures/nalati-return-modules';
import { legacyDouble } from './fake/FakeGame';

const row = {kind: 'elite.construct', owner: 'quarry.elites', file: 'sim/assembly.json', admission: 'sim/admission.json', fight: 'quarry.charge',
  models: 'quarry.models', program: 'elite.rules', weather: 'quarry.weather', night: 'quarry.watch', ledges: {part: 'cliffs', anchor: 'ledges'}};
function fixture(retireOnRead = false) {
  const scope = new Scope('quarry.elites'), models = new Map<string, Object3D>(), ledges = [{x: 1, y: 2, z: 3, r: 0, facing: 0}], scene = new Scene();
  const rows = buildEliteEntryPageRows(), charge = parseSpawnScript(JSON.parse(readFileSync('src/shards/nalati-grasslands/data/eliteCharge.generated.json', 'utf8')));
  const contents = new Map<string, unknown>([[row.file, {constants: {pageElites: rows}}], [row.admission, {admission}]]);
  const bytes = new Map([...contents].map(([name, value]) => [name, new TextEncoder().encode(JSON.stringify(value))]));
  const byHash = new Map([...bytes.values()].map(value => [sha256(value), value]));
  const product = createShardProduct({slug: 'quarry', revision: 1, shardfile: emptyShardfile({slug: 'quarry', name: 'Quarry', author: 'Fixture', revision: 1, seed: 1}),
    sections: new Map(), files: new Map([...bytes].map(([name, value]) => [name, {hash: sha256(value), url: `/${name}`}])) ,
    read: hash => { if (retireOnRead) scope.dispose(); const found = byHash.get(hash); if (found === undefined) throw new Error('Missing fixture bytes'); return Promise.resolve(found); }});
  const game = legacyDouble<Game>({levelScope: scope, scene}), world = legacyDouble<ShardWorld>({game});
  const runtime = legacyDouble<ShardRuntime>({world}), ctx = legacyDouble<ShardContext>({scope, product, game: legacyDouble<ShardContext['game']>({runtime})});
  publishEntryOwner(scope, 'drawn-models', row.models, models); lendNalatiAdmission(scope);
  const dressing = vi.spyOn(SceneDressing, 'current').mockReturnValue(legacyDouble<SceneDressing>({pieces: new Map([['cliffs', legacyDouble<NonNullable<ReturnType<SceneDressing['pieces']['get']>>>({anchors: {ledges}})]])}));
  const readCharge = vi.spyOn(spawn, 'readSpawnScript').mockImplementation((source, id) => { expect(source).toBe(product); expect(id).toBe(row.fight); return Promise.resolve(charge); });
  return {scope, models, ledges, scene, rows, charge, world, ctx, readCharge, done() {readCharge.mockRestore(); dressing.mockRestore(); scope.dispose();}};
}
test('elite construction admits only finite owner selections', () => {
  expect(parseClientPlan({version: 1, features: [row]}).features).toEqual([row]);
  for (const input of [{...row, build: () => undefined}, {...row, ledges: 'world.ledges'}, {...row, weather: '../clock'}])
    expect(() => parseClientPlan({version: 1, features: [input]})).toThrow();
});
test('construction publishes original resources without bodies, presentation or an eager night/weather read', async () => {
  const f = fixture();
  try {
    const loan = await installClientEliteConstruction(f.ctx, row);
    expect(entryOwner(f.scope, 'elite-entry', row.owner)).toBe(loan);
    expect(loan.rows).toEqual(f.rows); expect(loan.entry.rows).toEqual(f.rows.entry);
    expect(loan.models).toBe(f.models); expect(loan.ledges).toBe(f.ledges); expect(loan.fight).toBe(f.charge);
    expect(loan.program).toEqual({id: row.program, scope: f.scope, value: ReturnProgram.page(admission, f.scope)});
    expect(loan.entry.scripts).toEqual([]); expect(loan.entry.bar).toBeNull(); expect(f.scene.children).toEqual([]);
    expect(() => loan.patrol).toThrow('Missing live entry owner'); expect(() => loan.clock).toThrow('Missing live entry owner');
    const riders = legacyDouble<TimedEncounters['riders']>({});
    publishEntryOwner(f.scope, 'timed-encounters', row.night, legacyDouble<TimedEncounters>({riders}));
    const clock = legacyDouble<NonNullable<ForestWeatherRig['sky']>['clock']>({});
    const storm = legacyDouble<NonNullable<ForestWeatherRig['storm']>>({});
    publishEntryOwner(f.scope, 'world-weather', row.weather, legacyDouble<ForestWeatherRig>({sky: legacyDouble<NonNullable<ForestWeatherRig['sky']>>({clock}), storm}));
    expect(loan.patrol).toBe(riders); expect(loan.clock).toBe(clock); expect(loan.weather).toBe(storm);
    await expect(installClientEliteConstruction(f.ctx, row)).rejects.toThrow('already exists'); expect(f.readCharge).toHaveBeenCalledTimes(1);
    f.scope.disposeSteps().next(); expect(() => loan.patrol).toThrow('owner left or changed');
  } finally { f.done(); }
});
test('retirement during named admission refuses before programme, charge or publication', async () => {
  const f = fixture(true);
  try {
    await expect(installClientEliteConstruction(f.ctx, row)).rejects.toThrow('owner left or changed');
    expect(f.readCharge).not.toHaveBeenCalled(); expect(f.scene.children).toEqual([]);
  } finally { f.done(); }
});
