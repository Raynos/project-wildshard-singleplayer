// oxlint-disable-next-line import/no-nodejs-modules -- Assert real mounted entry and the unchanged natural raid.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Read only the admitted product and shipped physics bytes.
import {readFileSync} from 'node:fs';
import {builtProduct} from '../builtProduct';
import {loadHeadlessProduct} from '../../../src/sdk/headlessProduct';
import {outputDescriptor} from '../../../src/game/shardfile/outputDescriptor';
import {loadRapier} from '../../../src/engine/physics/rapier';
import {createNativeProofResident} from '../headless-native';
import {prepareHeadlessRuntime} from '../nalati-predators-native';
import {nativePopulationOf} from '../../../src/game/riding/nativePopulation';
import {nativeGroupCollection} from '../../../src/game/shardfile/groupRuntime';
import {mountedPlayerOf} from '../../../src/game/riding/native';
import {runTrustedHeadlessTape} from '../../../src/sdk/headlessTape';
import type {HeadlessCommand} from '../../../src/sdk/tickProtocol';

type Mounted=NonNullable<ReturnType<typeof mountedPlayerOf>>;
interface EarnedMountedRaid {
  readonly resident:Awaited<ReturnType<typeof createNativeProofResident>>;
  readonly product:Awaited<ReturnType<typeof loadHeadlessProduct>>;
  readonly mount:Mounted;
  readonly pack:ReturnType<typeof nativeGroupCollection>['packs'][number];
  readonly ridden:NonNullable<Mounted['horse']>;
  readonly riddenHealth:number;
  readonly move:(commands:readonly HeadlessCommand[])=>void;
  readonly reins:(forward:number,turn:number,sprint?:boolean,jump?:boolean,yaw?:number)=>HeadlessCommand;
}

/** The existing mounted-chain approach: real camp mount, north-bank road,
 * braking and turning inputs, then the untouched native raid clock. */
export async function earnNalatiMountedRaid():Promise<EarnedMountedRaid>{
  const directory=builtProduct('nalati-grasslands'),product=await loadHeadlessProduct(directory),descriptor=outputDescriptor(product.shardfile);assert.ok(descriptor);
  const assets=new Map(descriptor.index.files.map(file=>[file.commons===true?`commons:${file.hash}`:file.hash,Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  const resident=await createNativeProofResident({product,assets,shard:product.shardfile,rapier:await loadRapier(readFileSync('public/assets/physics/rapier.wasm'))},prepareHeadlessRuntime);
  try{
    const host=resident.host,mount=mountedPlayerOf(host),population=nativePopulationOf(host);assert.ok(mount);assert.ok(population);
    let inputs=0;
    const move=(commands:readonly HeadlessCommand[]):void=>{assert.ok(inputs++<24_000,'mounted inputs retain their finite allowance');resident.step(commands);};
    runTrustedHeadlessTape(host,move,()=>resident.effects,{version:1,observe:[],segments:[{id:'walk-to-camp-horse',ticks:6000,commands:[],
      route:[{x:20,z:216},{x:40,z:218},{x:60,z:214},{x:66,z:209.5},{x:66,z:211.5},{x:66.8,z:213.4}]}]});
    move([{kind:'script',actorId:'nalati.companion.use',value:1}]);assert.equal(mount.mounted,true);
    const ridden=mount.horse;assert.ok(ridden);const riddenHealth=ridden.hp;
    const reins=(forward:number,turn:number,sprint=false,jump=false,yaw=host.player.yaw):HeadlessCommand=>{
      const length=Math.max(1,Math.hypot(forward,turn));return {kind:'player',moveX:0,moveZ:0,yaw,commandVersion:1,
        steer:{keyX:0,keyY:0,stickX:turn/length,stickY:forward/length},sprint,...(jump?{jump:true}:{})};
    };
    for(let tick=0;tick<90;tick++)move([reins(-1,0)]);
    const drive=(x:number,z:number):void=>{
      for(let tick=0;tick<1800;tick++){
        assert.equal(mount.mounted,true);
        const p=host.player.position,dx=x-p.x,dz=z-p.z,distance=Math.hypot(dx,dz);if(distance<2.5)return;
        const target=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(mount.body.heading-target),Math.cos(mount.body.heading-target));
        const brake=Math.abs(delta)>.7&&Math.abs(mount.body.speed)>1.5;
        move([reins(brake?-.3:Math.abs(delta)>.7?0:1,brake?0:Math.max(-1,Math.min(1,delta*2.5)),!brake,tick>120&&tick%60===0&&mount.body.speed<1)]);
      }
      throw new Error(`Actual mounted approach stopped at ${x}, ${z}`);
    };
    for(const [x,z] of [[60,214],[40,218],[20,216],[0,216],[-50,218],[-100,212],[-135,214],[-157,218],[-175,206],[-190,191],[-196,188]] as const)drive(x,z);
    for(let tick=0;tick<300&&mount.body.speed>.15;tick++)move([reins(-1,0)]);
    const flock=population.flocks[0];assert.ok(flock);
    for(let tick=0;tick<600;tick++){
      const p=host.player.position,heading=Math.atan2(flock.cx-p.x,flock.cz-p.z),delta=Math.atan2(Math.sin(mount.body.heading-heading),Math.cos(mount.body.heading-heading));
      if(Math.abs(delta)<.08)break;move([reins(0,Math.max(-1,Math.min(1,delta*2.5)))]);
    }
    for(let tick=0;tick<300&&mount.body.speed>.15;tick++)move([reins(-1,0)]);
    for(let tick=0;tick<18_000&&population.raid.raids===0;tick++)move([reins(0,0)]);
    assert.equal(population.raid.raids,1,'the untouched natural raid clock must admit the actual raiders');
    const pack=nativeGroupCollection(host,'nalati.groups').packs[population.raid.snapshot().raiders];assert.ok(pack);
    return {resident,product,mount,pack,ridden,riddenHealth,move,reins};
  }catch(error){resident.dispose();throw error;}
}
