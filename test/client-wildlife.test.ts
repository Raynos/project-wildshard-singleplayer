import { createShardProduct, type ShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { expect, test, vi } from 'vitest';
import { BufferGeometry, Scene, Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { app } from '../src/engine/app/runtime';
import { Scope } from '../src/engine/app/scope';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import type { Player } from '../src/engine/player/Player';
import * as boot from '../src/engine/boot/plan';
import * as crowdPage from '../src/game/ambient/crowdPage';
import type { PreparedCrowds } from '../src/game/shardfile/crowdRuntime';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { clientWildlife, installClientWildlife, PageWildlife } from '../src/game/population/wildlife';
import { parseClientPlan } from '../src/format/clientPlan';
import { headlessAssembly } from '../src/shards/nalati-grasslands/generators/nativeGroups';
import { legacyDouble } from './fake/FakeGame';

const feature = parseClientPlan({ version: 1, features: [{ kind: 'population.wildlife', file: 'actors/orchard.json',
  crowd: { json: 'actors/birds.json', binary: 'actors/birds.bin' }, navSteer: true,
  frame: { id: 'orchard.wildlife', after: ['orchard.places'], before: ['engine.creatures.update'] } }] }).features[0];

test('declared wildlife waits for animals, owns one frame and retires its hook', async () => {
  if (feature?.kind !== 'population.wildlife') throw new Error('Missing feature');
  const scope = new Scope('orchard.wildlife');scope.expose(app,'levelScope',scope);
  const application = new App(), baseline=application.events.census().answerers, systems: Parameters<ShardContext['system']>[0][] = [], geometry = new BufferGeometry();
  const native = legacyDouble<PreparedCrowds>({ policies: new Map(), advance: vi.fn<PreparedCrowds['advance']>() });
  const body = { geometry, pivots: [], parts: [] };
  vi.spyOn(crowdPage, 'readCrowdBody').mockResolvedValue(body);
  vi.spyOn(crowdPage, 'createPageCrowds').mockReturnValue(legacyDouble<ReturnType<typeof crowdPage.createPageCrowds>>({ runtime: native }));
  const pause = vi.spyOn(boot, 'macrotask').mockResolvedValue();
  const begin = vi.spyOn(PageWildlife.prototype, 'beginFrame').mockReturnValue(0), end = vi.spyOn(PageWildlife.prototype, 'endFrame').mockReturnValue();
  const rows = { ...headlessAssembly.constants.pageWildlife, packs: [], herds: [], flocks: [], mountables: [], foragers: null };
  const hooks: ShardRuntime['hooks'] = {};
  const runtime = legacyDouble<ShardRuntime>({ hooks, world: legacyDouble<NonNullable<ShardRuntime['world']>>({
    game: legacyDouble<NonNullable<ShardRuntime['world']>['game']>({ scene: new Scene(),levelScope:scope }),
    sky: legacyDouble<NonNullable<ShardRuntime['world']>['sky']>({}), chunk: legacyDouble<NonNullable<ShardRuntime['world']>['chunk']>({ seed: 7 }),
    player: legacyDouble<Player>({ position: new Vector3(), yaw: .4, crouching: true }) }) });
  const readJson = vi.fn<ShardProduct['file']>().mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(rows))).mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify({ page: { world: {} } })));
  const fixture = createShardProduct({ slug: 'orchard', revision: 1, shardfile: emptyShardfile({ slug: 'orchard', name: 'Orchard', author: 'Fixture', revision: 1, seed: 7 }), sections: new Map(), files: new Map([[feature.file, { hash: 'population', url: '/population' }], [feature.crowd.json, { hash: 'crowd', url: '/crowd' }]]), read: readJson });
  const ctx = legacyDouble<ShardContext>({ answer:(name,handler)=>{application.events.answer(name,handler,scope);}, scope, app: application, game: legacyDouble<ShardContext['game']>({ runtime }), system: row => { systems.push(row); },
    product: fixture });
  const animals = legacyDouble<AnimalManager>({ animals: [], herds: [], wetAt: () => false, navSteer: false });
  try {
    expect(() => clientWildlife(ctx)).toThrow('not installed');
    const hits:string[]=[];
    const request={origin:new Vector3(),dir:new Vector3(0,0,1),maxDist:10,hit:null};
    application.events.answer('combat.targets.ray',value=>{hits.push('prior');return value;},scope);
    const ray=vi.spyOn(PageWildlife.prototype,'raycastWeapon').mockImplementation((_origin,_direction,_maximum,prior)=>{hits.push('wildlife');return prior;});
    await installClientWildlife(ctx, feature);
    application.events.answer('combat.targets.ray',value=>{hits.push('night');return value;},scope);
    application.events.answer('combat.targets.ray',value=>{hits.push('titan');return value;},scope);
    application.events.ask('combat.targets.ray',request);expect(hits).toEqual(['prior','night','titan']);hits.length=0;
    expect(clientWildlife(ctx)).toBeNull(); expect(systems).toHaveLength(1);
    const frame = systems[0]; if (frame === undefined) throw new Error('Missing frame');
    expect(frame).toMatchObject({ id: 'orchard.wildlife', after: ['orchard.places'], before: ['engine.creatures.update'] });
    frame.run(.1, 2); expect(begin).not.toHaveBeenCalled();
    const build = hooks.animalsBuilt; if (build === undefined) throw new Error('Missing animal stage');
    await build(animals); expect(pause).toHaveBeenCalledOnce(); expect(clientWildlife(ctx)).toBeInstanceOf(PageWildlife);
    application.events.ask('combat.targets.ray',request);expect(hits).toEqual(['prior','wildlife','night','titan']);hits.length=0;
    expect(ray).toHaveBeenCalledWith(request.origin,request.dir,request.maxDist,null);
    expect(animals.navSteer).toBe(true); frame.run(.1, 3);
    expect(begin).toHaveBeenCalledWith(.1, expect.objectContaining({ crouching: true }), { mounted: false });
    expect(end).toHaveBeenCalledOnce();
    await expect(build(animals)).rejects.toThrow('unavailable');
    await expect(installClientWildlife(ctx, feature)).rejects.toThrow('owner');
    scope.dispose();application.events.ask('combat.targets.ray',request);expect(hits).toEqual([]); expect(hooks.animalsBuilt).toBeUndefined(); expect(() => clientWildlife(ctx)).toThrow('disposed');
    const entered=new Scope('orchard.reentry');
    try{
      readJson.mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(rows))).mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify({page:{world:{}}})));
      const next=legacyDouble<ShardContext>({...ctx,scope:entered,answer:(name,handler)=>{application.events.answer(name,handler,entered);}});
      await installClientWildlife(next,feature);
      application.events.answer('combat.targets.ray',value=>{hits.push('reentered');return value;},entered);
      application.events.ask('combat.targets.ray',request);expect(hits).toEqual(['reentered']);
      expect(application.events.census().answerers).toBe(baseline+2);
    }finally{entered.dispose();}
    expect(application.events.census().answerers).toBe(baseline);
  } finally { scope.dispose(); vi.restoreAllMocks(); }
});

test('wildlife rows refuse callbacks and reflected ordering knobs', () => {
  if (feature?.kind !== 'population.wildlife') throw new Error('Missing feature');
  for (const row of [{ ...feature, frame: { id: 'orchard.frame', after: [], before: [], rank: 2 } },
    { ...feature, file: () => 'actors/orchard.json' }, { ...feature, owner: 'borrowed', path: ['population'] }])
    expect(() => parseClientPlan({ version: 1, features: [row] })).toThrow();
});
