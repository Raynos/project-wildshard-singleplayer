import { expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { bindLevelSelection } from '../src/engine/level/selection';
import { HeightfieldBinding, bindHeightfield } from '../src/engine/world/Heightfield';
import { WorldRegistry } from '../src/engine/world/registry';
import { installPagePathRamps } from '../src/game/shardfile/pagePreparation';
import { toLevelSpec } from '../src/game/shard/spec';
import { MANIFEST } from '../src/shards/pine-hollow/discovery.generated';

test('native paths read the installed floor, skip deck carriers and retire with their world', () => {
  const level = { ...toLevelSpec(MANIFEST), id: 'orchard-paths', ground: { terrain: {
    heightAt: () => 0, normalAt: (): [number,number,number] => [0,1,0],
    splatAt: (): [number,number,number,number] => [1,0,0,0], trailDistance: () => 0,
    cabinMask: () => 0, pondMask: () => 0, waterLevel: () => -100,
    trails: [[[0,0],[8,0]] satisfies [number,number][]], cabinSites: [], pond: null,
  } } };
  const selection = bindLevelSelection(level), binding = new HeightfieldBinding(level), release = bindHeightfield(binding);
  const registry = new WorldRegistry(), scope = new Scope('orchard-paths'); registry.scope = scope;
  try {
    installPagePathRamps(registry, {id:'flat',name:'Flat route'});
    expect(registry.get('flat')?.colliders).toEqual([]);
    binding.install({heightAt:()=>9,normalAt:()=>[0,.5,Math.sqrt(.75)],splatAt:()=>[1,0,0,0]});
    installPagePathRamps(registry, {id:'baked',name:'Baked route'});
    const colliders=registry.get('baked')?.colliders;
    expect(colliders?.length).toBeGreaterThan(0);
    expect(colliders?.every(row=>row.kind==='box'&&row.y+row.hy>=9)).toBe(true);
    registry.add({id:'deck',name:'Deck',category:'ground',file:'fixture',floor:()=>10});
    installPagePathRamps(registry, {id:'carried',name:'Carried route'});
    expect(registry.get('carried')?.colliders).toEqual([]);
    expect(()=>installPagePathRamps(registry,{id:'bad',name:'Bad',heightAt:()=>0})).toThrow();
    expect(registry.get('bad')).toBeUndefined();
    scope.dispose(); expect(registry.get('baked')).toBeUndefined();
  } finally { scope.dispose(); release(); selection(); }
});
