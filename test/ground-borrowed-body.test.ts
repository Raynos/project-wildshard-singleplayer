// oxlint-disable-next-line import/no-nodejs-modules -- The proof uses official product and physics bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Standalone tests run the official product writer.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Only an exact product receipt skips generation.
import { env, execPath } from 'node:process';
import { beforeAll, expect, test } from 'vitest';
import { Vector3 } from 'three';
import { PINE_TERRAIN } from '../src/shards/pine-hollow/data/terrainBindings';
import * as v from 'valibot';
import { loadRapier } from '@wildshard/engine/physics/rapier';
import type { SimValue } from '@wildshard/engine/sim';
import { snapshotSimHost } from '@wildshard/engine/sim/snapshot';
import { borrowedDecisionControl } from '@wildshard/game/shardfile/borrowedDecisions';
import { outputDescriptor } from '@wildshard/game/shardfile/outputDescriptor';
import { loadHeadlessProduct } from '@wildshard/sdk/headlessProduct';
import { createTrustedHeadlessResident } from '@wildshard/sdk/headlessRuntime';

beforeAll(() => {
  if (env['WS_TEST_PRODUCTS_SHA'] !== env['VERCEL_GIT_COMMIT_SHA'] || env['WS_TEST_PRODUCTS_SHA'] === undefined)
    execFileSync(execPath, ['scripts/build-shardfiles.mjs', '--reuse'], { stdio: 'inherit' });
}, 120_000);
const savedControl = v.object({ version:v.literal(1),actor:v.string(),phase:v.number(),fighting:v.boolean(),decision:v.string(),strike:v.unknown() });
const logical = v.object({ decision: v.object({ bindings: v.array(v.object({ failures: v.number() })) }) });
function record(value:SimValue):Record<string,SimValue> {
  if(value===null||typeof value!=='object'||Array.isArray(value))throw new Error('Missing continuation record');return value;
}
for (const [slug,kind] of [['driftwood-isle','captain'],['pine-hollow','antler-king']] as const) {
  test(`${kind} uses the same native body through guest phases and restore`, async () => {
    const product=await loadHeadlessProduct(`out/${slug}`),descriptor=outputDescriptor(product.shardfile);
    if(descriptor===undefined)throw new Error('Missing verified product');
    const rapier=await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
    const assets=new Map(descriptor.index.files.map(file=>[file.commons===true?`commons:${file.hash}`:file.hash,
      Uint8Array.from(readFileSync(`out/${slug}/${file.path}`))]));
    if(slug==='pine-hollow')for(const file of [PINE_TERRAIN.terrain,PINE_TERRAIN.navmesh])assets.set(file,Uint8Array.from(readFileSync(file)));
    const preparation={product,shard:product.shardfile,assets,rapier},entry={module:new URL(kind==='captain'?'../src/shards/driftwood-isle/boot/headlessModules.ts':'../src/shards/pine-hollow/boot/headlessModules.ts',import.meta.url).href},resident=await createTrustedHeadlessResident(preparation,entry);
    let resumed:Awaited<ReturnType<typeof createTrustedHeadlessResident>>|undefined;
    try {
      const host=resident.host,spawn=product.shardfile.runtime?.spawns?.bosses.find(row=>row.kind===kind);
      if(spawn===undefined)throw new Error('Missing retained boss row');
      host.events.answer('damage.modify',request=>request?.target===host.player.health?null:request,host.scope);
      host.player.position.set(spawn.at[0]+4,host.groundHeightAt(spawn.at[0],spawn.at[1])+.1,spawn.at[1]);
      if(kind==='captain')host.flags.set('used:altar');else host.dayClock?.setTime('night');
      for(let i=0;i<600;i++)resident.step([]);
      const body=[...host.entities.values()].find(actor=>actor.kind===kind);
      if(body===undefined)throw new Error('Missing existing encounter body');
      const control=borrowedDecisionControl(body),policy=()=>v.parse(savedControl,JSON.parse(v.parse(v.string(),control.snapshot())));
      expect(control.fighting).toBe(true);
      for(const fraction of [.6,.3]) {
        body.hp=body.maxHp*fraction;
        for(let i=0;i<300;i++)resident.step([]);
        expect(host.entities.get(body.entityId)).toBe(body);
        expect(v.parse(logical,JSON.parse(policy().decision)).decision.bindings[0]?.failures,policy().decision).toBe(0);
      }
      body.startAttack(1.4);
      const attacking = await createTrustedHeadlessResident(preparation, entry, snapshotSimHost(host));
      try {
        expect(attacking.host.entities.get(body.entityId)?.snapshot()).toEqual(body.snapshot());
      } finally { attacking.dispose(); }
      body.stagger(new Vector3(1, 0, 0), 1);
      expect(body.stunned).toBe(true);
      const saved=snapshotSimHost(host),before=control.snapshot();
      resumed=await createTrustedHeadlessResident(preparation,entry,saved);
      resumed.host.events.answer('damage.modify',request=>request?.target===resumed?.host.player.health?null:request,resumed.host.scope);
      const restored=resumed.host.entities.get(body.entityId);if(restored===undefined)throw new Error('Missing restored body');
      expect(borrowedDecisionControl(restored).snapshot()).toBe(before);
      for(let i=0;i<90;i++){
        resident.step([]);resumed.step([]);
        expect(borrowedDecisionControl(restored).snapshot()).toBe(control.snapshot());
      }
      const decode=(wire:unknown)=>{const decoded=v.parse(savedControl,JSON.parse(v.parse(v.string(),wire)));const decision:unknown=JSON.parse(decoded.decision);return {...decoded,decision};};
      expect(decode(borrowedDecisionControl(restored).snapshot())).toEqual(decode(control.snapshot()));
      const legacy=structuredClone(saved),entryState=legacy.entities.find(row=>row.id===body.entityId);
      if(entryState===undefined)throw new Error('Missing old body continuation');
      if(kind==='captain') {
        const island=legacy.adapters.find(row=>row.id==='driftwood.island');if(island===undefined)throw new Error('Missing v8 keeper');
        record(record(island.state)['captain']??null)['policy']=false;
        for(const [oldName,newName] of [['subT','subt'],['poolX','pool-x'],['poolZ','pool-z'],['burstX','burst-x'],['burstZ','burst-z']]) {
          if(oldName===undefined||newName===undefined)throw new Error('Missing old field mapping');
          entryState.state.mem[oldName]=entryState.state.mem[newName]??0;delete entryState.state.mem[newName];
        }
      } else {
        const king=legacy.adapters.find(row=>row.id==='pine.king');if(king===undefined)throw new Error('Missing old King');
        const wire=v.parse(v.record(v.string(),v.unknown()),JSON.parse(v.parse(v.string(),king.state))),fight=v.parse(v.record(v.string(),v.unknown()),wire['fight']);
        delete fight['decision'];wire['fight']=fight;king.state=JSON.stringify(wire);
        for(const name of Object.keys(entryState.state.mem))if(name.startsWith('king.'))delete entryState.state.mem[name];
      }
      const upgraded=await createTrustedHeadlessResident(preparation,entry,legacy);
      try {for(let i=0;i<30;i++)upgraded.step([]);
        const actor=upgraded.host.entities.get(body.entityId);if(actor===undefined)throw new Error('Old continuation lost its body');
        const migrated=v.parse(savedControl,JSON.parse(v.parse(v.string(),borrowedDecisionControl(actor).snapshot())));
        expect(migrated.fighting).toBe(true);
        expect(v.parse(logical,JSON.parse(migrated.decision)).decision.bindings[0]?.failures).toBe(0);
      }finally{upgraded.dispose();}
    } finally {resumed?.dispose();resident.dispose();}
  },120_000);
}
