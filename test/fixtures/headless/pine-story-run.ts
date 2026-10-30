// oxlint-disable-next-line import/no-nodejs-modules -- Read only declared paths in the admitted native product.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Assertions concern actual execution in the bounded Node runner.
import assert from 'node:assert/strict';
import * as v from 'valibot';
import {openProductSession} from './productSession';
import {builtProduct} from '../builtProduct';
import {outputDescriptor} from '../../../src/game/shardfile/outputDescriptor';
import {productHeadlessSections} from '../../../src/sdk/headlessSections';
import type {HeadlessRuntimePlan} from '../../../src/sdk/headlessRuntime';
import type {HeadlessCommand} from '../../../src/sdk/tickProtocol';
import type {HeadlessTapeObservation,HeadlessTapeSegment} from '../../../src/sdk/headlessTape';
import {createNativeProofResident} from '../headless-native';
import {loadRapier} from '../../../src/engine/physics/rapier';
import {installWalkRopeBodies} from './ropeBodies';
import {installNativeWalkBounds} from './nativeBounds';
import {installAppIdentity} from '../../../src/engine/app/identity';
import {WILDSHARD_IDENTITY} from '../../../src/game/identity';
import {ForestPageSchema,LivingPageInputSchema} from '../../../src/format/forestPage';
import {prepareHeadlessRuntime} from '../pine-verbs';
import {pineHeadlessAssets} from '../pine-headless';

installAppIdentity(WILDSHARD_IDENTITY);
const slug='pine-hollow',session=await openProductSession(slug,'pine-verbs'),{product}=session;
let resident:Awaited<ReturnType<typeof createNativeProofResident>>|undefined,retireRopes=()=>{};
try{
  const descriptor=outputDescriptor(product.shardfile);assert.ok(descriptor);
  const directory=builtProduct(slug),assets=pineHeadlessAssets(new Map(descriptor.index.files.map(file=>[
    file.commons===true?`commons:${file.hash}`:file.hash,Uint8Array.from(readFileSync(`${directory}/${file.path}`)),
  ])));
  const rapier=await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  // Retain the actual plan once so the controller reads its real nav/ground ports.
  let plan:HeadlessRuntimePlan|undefined;
  resident=await createNativeProofResident({shard:product.shardfile,assets,product,rapier,sections:productHeadlessSections(product)},async preparation=>{
    plan=await prepareHeadlessRuntime(preparation);return plan;
  });
  assert.ok(plan);
  const {pineTape}=await import('../../proof/pine-hollow/witness');
  const controller=pineTape(plan),{host}=resident;
  retireRopes=installWalkRopeBodies(host,product);installNativeWalkBounds(host);
  const page=v.parse(ForestPageSchema,await product.json('world/forest-page.json'));
  const variant=page.buildings.variants.find(row=>row.tier==='phone'&&!row.shadow&&!row.shared);assert.ok(variant);
  const doors=v.parse(LivingPageInputSchema,await product.json(variant.file)).life.doors;
  const door=doors[0];assert.ok(door);
  const statesSchema=v.array(v.object({open:v.boolean()}));
  const loadoutInput=product.shardfile.items.loadout.native?.input;assert.ok(loadoutInput);
  const loadoutSchema=v.object({held:v.number()});
  const held=()=>v.parse(loadoutSchema,host.adapters.get(loadoutInput.step)?.snapshot()).held;
  const heldSlots:number[]=[held()],requestedSlots=new Set<number>();
  const quest=host.quests[0];assert.ok(quest,'actual story owner');
  const segments:HeadlessTapeSegment[]=[],expected:{id:string;flags:string[];current:string|null;complete:boolean;held:number}[]=[];
  let frames:HeadlessCommand[][]=[],commandsCount=0,last=quest.current?.id;
  const flush=()=>{
    if(frames.length===0)return;
    const id=`stage-${segments.length}`;segments.push({id,ticks:frames.length,commands:[],frames});frames=[];
    expected.push({id,flags:[...host.flags.all],current:quest.current?.id??null,complete:quest.isComplete,held:held()});
  };
  for(let tick=0;tick<60_000;tick++){
    const commands=structuredClone(controller.next(host)),states=v.parse(statesSchema,host.adapters.get('pine.doors')?.snapshot());
    const first=states[0];assert.ok(first);
    const [x,y,z]=door.at,p=host.player.position;
    if(!first.open&&Math.hypot(p.x-x,p.y+1.68-y,p.z-z)<door.reach)commands.push({kind:'script',actorId:'pine.door',value:0});
    for(const command of commands)if(command.kind==='script'&&command.actorId===loadoutInput.command)requestedSlots.add(command.value);
    commandsCount+=commands.length;
    if(commandsCount>60_000)throw new Error('Story exceeds canonical declared command allowance');
    resident.step(commands);frames.push(commands);
    const current=quest.current?.id;
    const selected=held(),swapped=selected!==heldSlots.at(-1);if(swapped)heldSlots.push(selected);
    if(current!==last||swapped||frames.length===18_000){flush();last=current;}
    if(controller.walked&&quest.isComplete){flush();break;}
  }
  flush();
  assert.equal(controller.walked,true,JSON.stringify({current:quest.current?.id,position:host.player.position,tape:controller.state}));
  assert.equal(quest.isComplete,true);
  for(const flag of ['talked:ranger','owned:lever-rifle','open:dam-sluice','taken:pond-glass','lit:pond','taken:ridge-flint',
    'lit:ridge','used:ph-zip','lit:den','followed:stag','dead:king','seen:dawn','quest:warden-done'])assert.ok(host.flags.has(flag),flag);
  const slot=(id:string)=>{const row=product.shardfile.items.rows.find(item=>item.id===id);assert.ok(row?.kind==='weapon'&&row.ranged!==undefined);return row.ranged.slot;};
  const crossbow=slot('weapon.crossbow'),lever=slot('weapon.lever'),firstLever=heldSlots.indexOf(lever),backToCrossbow=heldSlots.indexOf(crossbow,firstLever+1);
  assert.ok(firstLever>=0&&backToCrossbow>firstLever&&heldSlots.indexOf(lever,backToCrossbow+1)>backToCrossbow,JSON.stringify(heldSlots));
  assert.ok(requestedSlots.has(crossbow)&&requestedSlots.has(lever),'the real controller must request both selections');
  const report=await session.sim.verbTape({version:1,observe:[loadoutInput.step],segments});
  for(const wanted of expected){
    const actual=report.observations.find(row=>row.id===wanted.id);assert.ok(actual);
    assert.deepEqual(actual.flags,wanted.flags,'fresh current input replay must earn the same transitions');
    const replayed:HeadlessTapeObservation['quests'][number]|undefined=actual.quests.find(row=>row.id===quest.def.id);assert.ok(replayed);
    assert.equal(replayed.currentId,wanted.current);assert.equal(replayed.complete,wanted.complete);
    const equipment=actual.adapters[0];assert.ok(equipment);assert.equal(v.parse(loadoutSchema,JSON.parse(equipment.state)).held,wanted.held);
  }
  assert.equal(report.ticks,host.state.tick);assert.equal(session.sim.quarantined,false);
  console.info(JSON.stringify({phase:'replayed',slug,ticks:report.ticks,quest:quest.def.id,complete:true,segments:report.observations.length,heldSlots}));
}finally{retireRopes();resident?.dispose();await session.sim.dispose();}
