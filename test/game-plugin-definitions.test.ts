// oxlint-disable-next-line import/no-nodejs-modules -- Check the package's defining-module map without installing game services.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const definitions=[
  {key:'./plugin/lifecycle',target:'./plugin/lifecycle.ts',old:'./shard/retainedHooks',load:async()=>[await import('@wildshard/game/plugin/lifecycle'),await import('@wildshard/game/shard/retainedHooks')]},
  {key:'./plugin/headless',target:'./plugin/headless.ts',old:'./shardfile/hybridRows',load:async()=>[await import('@wildshard/game/plugin/headless'),await import('@wildshard/game/shardfile/hybridRows')]},
  {key:'./plugin/brain',target:'./plugin/brain.ts',old:null,load:async()=>[await import('@wildshard/game/plugin/brain'),await import('@wildshard/game/plugin/brain')]},
  {key:'./plugin/bossPhase',target:'./plugin/bossPhase.ts',old:null,load:async()=>[await import('@wildshard/game/plugin/bossPhase'),await import('../src/game/plugin/bossPhase')]},
  {key:'./plugin/mover',target:'./plugin/mover.ts',old:'./shardfile/moverRuntime',load:async()=>[await import('@wildshard/game/plugin/mover'),await import('@wildshard/game/shardfile/moverRuntime')]},
  {key:'./plugin/director',target:'./plugin/director.ts',old:null,load:async()=>[await import('@wildshard/game/plugin/director'),await import('../src/game/plugin/director')]},
  {key:'./plugin/ui',target:'./plugin/ui.ts',old:'./quest/presentation',load:async()=>[await import('@wildshard/game/plugin/ui'),await import('@wildshard/game/quest/presentation')]},
  {key:'./plugin/boot',target:'./plugin/boot.ts',old:null,load:async()=>[await import('@wildshard/game/plugin/boot'),await import('../src/game/plugin/boot')]},
];
it('publishes real plugin definitions and keeps exact binding identity for transitional consumers',async()=>{
  const manifest:unknown=JSON.parse(readFileSync('src/game/package.json','utf8'));
  if(manifest===null||typeof manifest!=='object'||!('exports' in manifest)||manifest.exports===null||typeof manifest.exports!=='object')throw new Error('Missing game exports');
  expect(Object.hasOwn(manifest.exports, './shardfile/phasedBoss')).toBe(false);
  expect(manifest.exports).toMatchObject({ './shardfile/directorClient': './shardfile/directorClient.ts' });
  for(const row of definitions){
    expect(manifest.exports).toMatchObject({[row.key]:row.target});
    if(row.old!==null)expect(manifest.exports).toMatchObject({[row.old]:row.target});
    const [current,previous]=await row.load();
    expect(current).toBeDefined();expect(previous).toBeDefined();
    expect(Object.keys(current ?? {}),row.key).toEqual(Object.keys(previous ?? {}));
    const bindings=new Map<string,unknown>(Object.entries(previous ?? {}));
    for(const [name,value]of Object.entries(current ?? {}))expect(bindings.get(name),`${row.key}:${name}`).toBe(value);
  }
});
