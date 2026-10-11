// oxlint-disable-next-line import/no-nodejs-modules -- Check the package's defining-module map without installing game services.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const definitions=[
  {key:'./plugin/audio',target:'./plugin/audio.ts',old:null,load:async()=>[await import('@wildshard/game/plugin/audio'),await import('../src/game/plugin/audio')]},
  {key:'./plugin/audio',target:'./plugin/audio.ts',old:'./systems/audio/weaponVoices',load:async()=>[await import('@wildshard/game/plugin/audio'),await import('@wildshard/game/systems/audio/weaponVoices')]},
];
it('publishes real audio definitions and keeps exact binding identity for transitional consumers',async()=>{
  const manifest:unknown=JSON.parse(readFileSync('src/game/package.json','utf8'));
  if(manifest===null||typeof manifest!=='object'||!('exports' in manifest)||manifest.exports===null||typeof manifest.exports!=='object')throw new Error('Missing game exports');
  expect(Object.hasOwn(manifest.exports, './systems/audio/combatCues')).toBe(false);
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
