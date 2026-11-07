import { expect, test, vi } from 'vitest';
import { Scene, type Object3D } from 'three';
import { Scope } from '../src/engine/shared/app/scope';
import type { Game } from '../src/engine/client/core/Game';
import type { ShardContext } from '../src/game/client/plugin/context';
import type { ShardWorld } from '../src/game/server/shard/world';
import type { ShardRuntime } from '../src/game/shared/shard/runtime';
import type { TimedEncounters } from '../src/game/client/boss/timedEncounters';
import type { ForestWeatherRig } from '../src/game/client/weather/forest';
import { parseClientPlan } from '@wildshard/format/clientPlan';
import { buildEliteEntryPageRows } from '../src/shards/nalati-grasslands/generators/eliteEntryRows';
import { createShardProduct } from '../src/game/shared/shardfile/shardProduct';
import { installClientEliteConstruction } from '../src/game/client/shardfile/clientEliteConstruction';
import { entryOwner, publishEntryOwner } from '../src/game/shared/shardfile/entryOwners';
import { SceneDressing } from '../src/game/client/shardfile/sceneDressing';
import { ReturnProgram } from '../src/game/shared/population/returnProgram';
import { sha256 } from '../src/game/shared/plugin/moduleHash';
import { emptyShardfile } from '../src/sharddev/author';
import { admission, lendNalatiAdmission } from './fixtures/nalati-return-modules';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';

const row = {kind: 'elite.construct', owner: 'quarry.elites', rows: buildEliteEntryPageRows(), admission: 'sim/admission.json', fight: 'quarry.charge',
  models: 'quarry.models', program: 'elite.rules', weather: 'quarry.weather', night: 'quarry.watch', ledges: {part: 'cliffs', anchor: 'ledges'}};
function fixture(retireOnRead = false) {
  const scope = new Scope('quarry.elites'), models = new Map<string, Object3D>(), ledges = [{x: 1, y: 2, z: 3, r: 0, facing: 0}], scene = new Scene();
  const rows = buildEliteEntryPageRows();
  const contents = new Map<string, unknown>([[row.admission, {admission}]]);
  const bytes = new Map([...contents].map(([name, value]) => [name, new TextEncoder().encode(JSON.stringify(value))]));
  const byHash = new Map([...bytes.values()].map(value => [sha256(value), value]));
  const product = createShardProduct({slug: 'quarry', revision: 1, shardfile: emptyShardfile({slug: 'quarry', name: 'Quarry', author: 'Fixture', revision: 1, seed: 1}),
    sections: new Map(), files: new Map([...bytes].map(([name, value]) => [name, {hash: sha256(value), url: `/${name}`}])) ,
    read: hash => { if (retireOnRead) scope.dispose(); const found = byHash.get(hash); if (found === undefined) throw new Error('Missing fixture bytes'); return Promise.resolve(found); }});
  // Explicit byte oracle for this owner-lifecycle fixture. The real named-file
  // admission remains covered by the production documents and grammar tests.
  vi.spyOn(product,'json').mockImplementation(async name=>{
    const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await product.file(name)));return value;
  });
  const game = legacyDouble<Game>({levelScope: scope, scene}), world = legacyDouble<ShardWorld>({game});
  const runtime = legacyDouble<ShardRuntime>({world}), ctx = legacyDouble<ShardContext>({scope, product, game: legacyDouble<ShardContext['game']>({runtime})});
  publishEntryOwner(scope, 'drawn-models', row.models, models); lendNalatiAdmission(scope);
  const dressing = vi.spyOn(SceneDressing, 'current').mockReturnValue(legacyDouble<SceneDressing>({pieces: new Map([['cliffs', legacyDouble<NonNullable<ReturnType<SceneDressing['pieces']['get']>>>({anchors: {ledges}})]])}));
  return {scope, models, ledges, scene, rows, world, ctx, done() {dressing.mockRestore(); scope.dispose();}};
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
    expect(loan.models).toBe(f.models); expect(loan.ledges).toBe(f.ledges);
    expect(loan.program).toEqual({id: row.program, scope: f.scope, value: ReturnProgram.page(admission, f.scope)});
    expect(loan.entry.scripts).toEqual([]); expect(loan.entry.bar).toBeNull(); expect(f.scene.children).toEqual([]);
    expect(() => loan.patrol).toThrow('Missing live entry owner'); expect(() => loan.clock).toThrow('Missing live entry owner');
    const riders = legacyDouble<TimedEncounters['riders']>({});
    publishEntryOwner(f.scope, 'timed-encounters', row.night, legacyDouble<TimedEncounters>({riders}));
    const clock = legacyDouble<NonNullable<ForestWeatherRig['sky']>['clock']>({});
    const storm = legacyDouble<NonNullable<ForestWeatherRig['storm']>>({});
    publishEntryOwner(f.scope, 'world-weather', row.weather, legacyDouble<ForestWeatherRig>({sky: legacyDouble<NonNullable<ForestWeatherRig['sky']>>({clock}), storm}));
    expect(loan.patrol).toBe(riders); expect(loan.clock).toBe(clock); expect(loan.weather).toBe(storm);
    await expect(installClientEliteConstruction(f.ctx, row)).rejects.toThrow('already exists');
    f.scope.disposeSteps().next(); expect(() => loan.patrol).toThrow('owner left or changed');
  } finally { f.done(); }
});
test('retirement during named admission refuses before programme or publication', async () => {
  const f = fixture(true);
  try {
    await expect(installClientEliteConstruction(f.ctx, row)).rejects.toThrow('owner left or changed');
    expect(f.scene.children).toEqual([]);
  } finally { f.done(); }
});
