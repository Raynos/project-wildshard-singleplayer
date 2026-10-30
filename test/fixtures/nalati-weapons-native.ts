import * as v from 'valibot';
import {Vector3,Quaternion,Euler,MathUtils} from 'three';
import {BowDraw} from '../../src/engine/combat/bowDraw';
import {bowBlocked,bowAimOn,bowMount,bowLooseSpreadDegrees,bowLaunchSpeed,bowMuzzle,type BowMountState} from '../../src/engine/combat/bowLaw';
import {ProjectileLaw} from '../../src/engine/combat/projectileLaw';
import {shotSpread} from '../../src/engine/combat/shotSpread';
import {SweptMeleeCore,sweptLunge,sweptMoveDamage} from '../../src/engine/combat/sweptMeleeCore';
import {SweptBasePose} from '../../src/engine/combat/sweptBasePose';
import {BladeSweep,bladeInReach,sweptBladeDirs,type BladeKey} from '../../src/engine/combat/sweptBlade';
import {pickLunge,targetRadius} from '../../src/engine/combat/lungeTarget';
import {bladeBlocked} from '../../src/engine/player/MeleeSweep';
import {worldHit,floorBelow} from '../../src/engine/physics/query';
import {Wind} from '../../src/engine/world/steppeWind';
import {WindStateSchema,WeatherWorldSchema} from '../../src/format/weatherProgram';
import {MeleeWeaponProfileSchema,ThrownWeaponProfileSchema,HeldBowFileSchema} from '../../src/format/weaponProfiles';
import {BladeRowsSchema,PolearmRowsSchema,type BladeRows} from '../../src/format/heldMelee';
import {parseHeldSlots} from '../../src/format/heldArms';
import {ClientPlanSchema} from '../../src/format/clientPlan';
import {filterCombatAimTargets} from '../../src/game/shardfile/aimTargetFilter';
import {heldBowBase} from '../../src/game/weapons/heldBowBase';
import {SWORD_WOOD} from '../../src/game/weapons/starterMeleeProfile';
import {HeldDecision} from '../../src/game/weapons/heldDecision';
import {MountedPassLaw} from '../../src/game/weapons/mountedPass';
import {PolearmDecision} from '../../src/game/weapons/polearmDecision';
import {PolearmContact} from '../../src/game/weapons/polearmContact';
import {JavelinFlight,type JavelinSlot} from '../../src/game/weapons/javelinFlight';
import {nativeRangedHit} from '../../src/game/plugin/nativeItems';
import type {SimHost} from '../../src/engine/sim';
import {mountedPlayerOf} from '../../src/game/riding/native';
import {nativePopulationOf} from '../../src/game/riding/nativePopulation';
import {nativeTamingOf} from '../../src/game/riding/nativeTaming';
import type {AnimalSim} from '../../src/engine/entities/AnimalSim';
import type {TargetAnimal,TargetHit} from '../../src/engine/combat/types';
import type {PrepareHeadlessRuntime} from '../../src/sdk/headlessRuntime';
import {prepareHeadlessRuntime as prepareCompanions} from './nalati-companions-native';
import {installCombatMotion} from './headless-plan';

const finite=v.pipe(v.number(),v.finite()),count=v.pipe(finite,v.integer(),v.minValue(0)),vector=v.tuple([finite,finite,finite]);
const SwingSaved=v.strictObject({move:v.nullable(count),swingT:finite,comboIdx:count,lastSwingEnd:finite,cooldown:finite,
  charging:v.boolean(),chargeT:finite,releaseQueued:v.boolean(),chargePending:v.boolean(),heldPrev:v.boolean(),time:finite});
const DrawSaved=v.strictObject({drawT:finite,holdT:finite,renockT:finite,tiredT:finite,wasHeld:v.boolean(),needLift:v.boolean(),reachedFull:v.boolean()});
const poseVector=v.tuple([finite,finite,finite,finite,finite,finite,finite]);
const BladeSaved=v.strictObject({pose:v.strictObject({from:poseVector,base:poseVector,chargeBlend:finite,sprintBlend:finite}),
  grip:vector,tip:vector,have:v.boolean(),struck:v.array(v.string()),contacts:count});
const Saved=v.strictObject({version:v.literal(1),enabled:v.optional(v.boolean(),true),slot:v.string(),queued:v.boolean(),aim:finite,pitch:finite,ammo:count,
  draw:DrawSaved,bolts:count,shots:count,letdowns:count,fullDraws:count,aimOn:v.boolean(),aimBlend:finite,
  moves:v.pipe(v.array(v.string()),v.maxLength(64)),passes:count,passDamage:finite,swing:v.unknown(),pass:v.unknown(),cadence:finite,
  thrusts:count,throws:count,recovered:count,polearm:v.unknown(),blade:BladeSaved,
  flying:v.array(v.strictObject({active:v.boolean(),age:finite,glanced:v.boolean(),pos:vector,vel:vector,origin:vector,scale:finite})),stopped:v.unknown(),
  javelins:v.array(v.strictObject({state:v.picklist([0,1,2]),age:finite,pos:vector,vel:vector,q:v.tuple([finite,finite,finite,finite])}))});

/** Actual held inputs and admitted rows, sharing the page's decisions,
 * base pose, contact sweeps and projectile laws. No target is created. */
export type NalatiWeaponRay=(host:SimHost,from:Vector3,direction:Vector3,distance:number,
  hit:ReturnType<typeof nativeRangedHit>)=>ReturnType<typeof nativeRangedHit>;
/** An encounter lends its actual target and continuation identity. Ordinary
 * animal/spear keys remain roster-owned; this port affects arrows only. */
export interface NalatiArrowTargets {
  readonly ray:(host:SimHost,from:Vector3,direction:Vector3,distance:number,hit:TargetHit|null)=>TargetHit|null;
  readonly key:(host:SimHost,target:TargetAnimal)=>string|null;
  readonly resolve:(host:SimHost,key:string)=>TargetAnimal|null;
}
export interface NativeNalatiWeapons {readonly setEnabled:(on:boolean)=>void;readonly refill:()=>void;readonly look:{yaw:number;pitch:number}}
const weaponOwners=new WeakMap<SimHost,NativeNalatiWeapons>();
export function nalatiWeaponsOf(host:SimHost):NativeNalatiWeapons|undefined{return weaponOwners.get(host);}
export function withNalatiWeapons(prepare:PrepareHeadlessRuntime,contacts?:NalatiWeaponRay,arrowTargets?:NalatiArrowTargets):PrepareHeadlessRuntime {return async preparation=>{
  const base=await prepare(preparation),product=preparation.product;
  const slots=parseHeldSlots(await product.json('held/slots.json'));
  const aimRows=v.parse(ClientPlanSchema,product.section('client/plan')).features.find(row=>row.kind==='combat.targets')?.rows.aim;
  if(aimRows===undefined)throw new Error('Weapons require their admitted aim exclusions');
  const bowSlot=slots.slots.find(row=>row.kind==='bow'),bladeSlot=slots.slots.find(row=>row.kind==='blade'),spearSlot=slots.slots.find(row=>row.kind==='polearm');
  if(bowSlot?.kind!=='bow'||bladeSlot?.kind!=='blade'||spearSlot?.kind!=='polearm'||bladeSlot.source.kind!=='passes')throw new Error('Missing admitted native weapon slots');
  const blade=v.parse(BladeRowsSchema,await product.json(bladeSlot.source.file)),spear=v.parse(PolearmRowsSchema,await product.json(spearSlot.file));
  const definition=v.parse(HeldBowFileSchema,await product.json(bowSlot.file)),bow=heldBowBase({bow:definition.bow,base:definition.base});
  const bladeItem=product.shardfile.items.rows.find(row=>row.id===bladeSlot.item),spearItem=product.shardfile.items.rows.find(row=>row.id===spearSlot.item);
  if(bladeItem?.kind!=='weapon'||spearItem?.kind!=='weapon')throw new Error('Missing actual weapon catalogue profiles');
  const melee=v.parse(MeleeWeaponProfileSchema,bladeItem.profile),thrown=v.parse(ThrownWeaponProfileSchema,spearItem.profile);
  if(melee.mounted===undefined)throw new Error('Sabre requires its admitted mounted policy');
  const mountedRows=melee.mounted;
  const bladeKey=(row:BladeRows['moves']['rest']):BladeKey=>({t:row.t,pos:new Vector3(...row.pos),q:new Quaternion(...row.q)});
  const bladeMove=(row:BladeRows['moves']['heavy'])=>({...row,keys:[bladeKey(row.keys[0]),bladeKey(row.keys[1]),bladeKey(row.keys[2])] as const});
  const bladeMoves={rest:bladeKey(blade.moves.rest),charge:bladeKey(blade.moves.charge),sprint:bladeKey(blade.moves.sprint),
    combo:blade.moves.combo.map(bladeMove),heavy:bladeMove(blade.moves.heavy),
    passes:{left:bladeMove(blade.moves.passes.left),right:bladeMove(blade.moves.passes.right)}};
  const assembly=await product.json<{constants:{nativeWeather:unknown}}>('sim/headless-assembly.json');
  const weather=v.parse(WeatherWorldSchema,assembly.constants.nativeWeather);
  const length=v.parse(v.object({length:v.pipe(finite,v.minValue(0))}),JSON.parse(bow.rows.bake.arrow)).length;
  const order=slots.equipment.order??slots.registration,available=new Set([bowSlot.id,bladeSlot.id,spearSlot.id]);
  if(order.some(id=>!available.has(id))||order.length!==3)throw new Error('The ordinary arsenal must retain its three real weapons');
  return {...base,install:(host,context)=>{
    const combat=context.combat;if(combat===undefined)throw new Error('Native weapons require their actual input frame');
    base.install(host,context);
    installCombatMotion(host,context,7.2);
    const mount=mountedPlayerOf(host),taming=nativeTamingOf(host);if(mount===undefined||taming===undefined)throw new Error('Weapons require actual native riding');
    let slot=slots.selection.initial??bowSlot.id,queued=false,aim=0,pitch=0,ammo=thrown.carried,bolts=bow.base.quiver,weaponsEnabled=true;
    let shots=0,letdowns=0,fullDraws=0,aimOn=false,aimBlend=0,passes=0,passDamage=melee.damage,thrusts=0,throws=0,recovered=0;
    const moves:string[]=[],draw=new BowDraw(bow.base.draw),decision=new HeldDecision(blade.program,host.scope),pass=new MountedPassLaw(decision);
    const polearm=new PolearmDecision<AnimalSim>(spear.program,host.scope),wind=new Wind({value:1});
    const foot=bowMount(bow.base,0,null);if(foot===null)throw new Error('Missing on-foot bow state');let saddle:BowMountState=foot;
    const body=(id:string):AnimalSim=>{const actor=host.entities.get(id);if(actor===undefined)throw new Error(`Missing native weapon target ${id}`);return actor;};
    const knownContacts=new WeakMap<TargetAnimal,string>(),retiredContacts=new Map<number,string>();
    const key=(actor:TargetAnimal):string=>{for(const [id,row] of host.entities)if(row===actor){knownContacts.set(actor,id);return id;}throw new Error('Foreign native weapon target');};
    const retired=():ReadonlySet<string>=>{
      const population=nativePopulationOf(host),owner=population===undefined?undefined:host.adapters.get(population.id);
      if(owner===undefined)throw new Error('Missing native weapon retirement authority');
      return new Set(v.parse(v.object({retired:v.array(v.string())}),owner.snapshot()).retired);
    };
    // A retired body cannot be raycast again, but its occupied hit slot still
    // counts against this swing's cap. Restore only the identity witnessed by
    // the real population, never a replacement body or a new combat target.
    const bladeContactKey=(actor:TargetAnimal|null,index:number):string=>{
      if(actor===null){const id=retiredContacts.get(index);
        if(id===undefined||host.entities.has(id)||!retired().has(id))throw new Error('Missing retired blade contact');return id;}
      const id=knownContacts.get(actor);
      if(id!==undefined&&host.entities.get(id)!==actor){
        if(actor.alive||host.entities.has(id)||!retired().has(id))throw new Error('Foreign retired blade contact');return id;
      }
      return key(actor);
    };
    const arrowKey=(actor:TargetAnimal):string=>{
      if(arrowTargets===undefined)return key(actor);
      const id=arrowTargets.key(host,actor);if(id===null)return key(actor);
      if(host.entities.has(id)||arrowTargets.resolve(host,id)!==actor)throw new Error('Encounter arrow target identity changed');
      return id;
    };
    const arrowBody=(id:string):TargetAnimal=>{
      const actor=host.entities.get(id);if(actor!==undefined)return actor;
      const target=arrowTargets?.resolve(host,id);
      if(target===undefined||target===null||arrowTargets?.key(host,target)!==id)throw new Error('Missing encounter arrow target');
      return target;
    };
    const bodies=():AnimalSim[]=>[...host.entities.values()].filter(actor=>actor.alive&&actor!==mount.horse);
    const targets=():AnimalSim[]=>filterCombatAimTargets(bodies(),aimRows.exclude);
    const basePose=new SweptBasePose(),sweep=new BladeSweep(melee.sweep);basePose.rest(bladeMoves.rest);let bladeContacts=0;
    const grip=new Vector3(),tip=new Vector3(),basePos=new Vector3(),baseQ=new Quaternion(),left=new Vector3(),strikeDirection=new Vector3(),push=new Vector3(),up=new Vector3(0,1,0);
    const eye=new Vector3(),forward=new Vector3(),scratch=new Vector3(),velocity=new Vector3(),rotation=new Quaternion(),euler=new Euler(0,0,0,'YXZ');
    const random=():number=>host.rng.stream('gameplay').next();
    const ray=(from:Vector3,dir:Vector3,distance:number)=>{
      const original=nativeRangedHit(bodies(),from,dir,distance);
      const hit=contacts===undefined?original:contacts(host,from,dir,distance,original);return hit===null||hit.body===null?null:{animal:hit.body,point:hit.point,distance:hit.distance,headshot:hit.head};
    };
    const spearContacts=new PolearmContact<AnimalSim>({raycast:ray,same:(animal,target)=>animal===target,
      contact:(animal,amount,point,dir,from,moveId)=>host.combat.hit({source:'env',sourceTags:['actor.player',spearItem.id,'dmg.melee'],
        target:body(key(animal)).combatActor(),amount,point,dir,from,weaponId:spearItem.id,moveId}),struck:()=>undefined},polearm);
    const floor=(x:number,y:number,z:number):number=>floorBelow(host.physics,x,z,y+.3,60)??host.groundHeightAt(x,z);
    const arrows=new ProjectileLaw(bow.rows.arrow.maxFlying>0?{...bow.rows.arrow,length,
      substeps:bow.base.projectile?.substeps??4,lifetime:bow.base.projectile?.lifetime??12}:(()=>{throw new Error('Missing bow flight slots');})(),{
      feet:host.player.position,extent:host.level.ground.size/2,floorAt:floor,world:(from,to,radius)=>worldHit(host.physics,from,to,radius),
      targets:(from,dir,distance)=>{const hit=ray(from,dir,distance);return arrowTargets===undefined?hit:arrowTargets.ray(host,from,dir,distance,hit);},
      wind:()=>wind,surface:wall=>wall.material==='flesh'?'flesh':wall.material==='wood'||wall.material==='planks'?'wood':'ground',
      random,canRecover:()=>bolts<bow.base.quiver,recover:survived=>{if(survived)bolts=Math.min(bow.base.quiver,bolts+1);},
      flight:()=>({}),stuck:()=>null,moved:()=>undefined,ended:()=>undefined,settled:()=>undefined,changed:()=>undefined,removed:()=>undefined,impact:()=>undefined,
      playerHit:()=>{throw new Error('Player bow cannot become an enemy projectile');},targetHit:()=>undefined,hit:()=>undefined,
    });
    const javelins:JavelinSlot[]=Array.from({length:thrown.pool},()=>({state:0,pos:new Vector3(),vel:new Vector3(),q:new Quaternion(),age:0}));
    const flight=new JavelinFlight<NonNullable<ReturnType<typeof ray>>>(javelins,thrown,{worldHit:(from,to,radius)=>worldHit(host.physics,from,to,radius),raycast:ray,
      strike:(hit,damage,dir)=>{const killed=hit.animal.applyDamage(damage,hit.point,dir);if(!killed)hit.animal.stagger(scratch.set(dir.x,0,dir.z).normalize(),thrown.stagger);},
      impact:()=>undefined,water:(x,z)=>host.waterSurfaceAt(x,z),floor,random,damageScale:()=>1,
      surface:material=>material==='flesh'?'flesh':material==='wood'||material==='planks'?'wood':'ground'});
    const extra=[bladeMoves.passes.left,bladeMoves.passes.right];
    if(weaponOwners.has(host))throw new Error('Native held equipment already has an owner');
    const live=():void=>{if(host.scope.disposed||host.scope.disposing)throw new Error('Native held equipment owner retired');};
    weaponOwners.set(host,{look:{get yaw(){return host.player.yaw;},set yaw(value){live();host.player.yaw=value;},
      get pitch(){return pitch;},set pitch(value){live();pitch=value;}},setEnabled:on=>{live();weaponsEnabled=on;},refill:()=>{
      live();for(const refill of slots.refills){
        if(refill.slot===bowSlot.id&&refill.kind==='add-magazine')bolts=Math.min(bow.base.quiver,bolts+bow.base.quiver);
        else if(refill.slot===spearSlot.id&&refill.kind==='fill-capacity')ammo=thrown.carried;
        else throw new Error('Invalid admitted native held refill owner');
      }
    }});
    host.scope.onDispose(()=>{weaponOwners.delete(host);});
    const pose=():void=>{const p=host.player.position;eye.set(p.x,p.y+1.68,p.z);rotation.setFromEuler(euler.set(pitch,host.player.yaw,0));forward.set(0,0,-1).applyQuaternion(rotation);};
    const clock=new SweptMeleeCore(bladeMoves,melee,{queue:()=>{queued=true;},consume:()=>{const before=queued;queued=false;return before;}},{
      start:(move,lunge)=>{moves.push(move.name);if(moves.length>64)moves.shift();sweep.reset();retiredContacts.clear();basePose.startSwing();
        const heavy=move===bladeMoves.heavy;
        const target=lunge?pickLunge(targets(),host.player.position,host.player.yaw,heavy?melee.lunge.heavyRange:melee.lunge.range,melee.lunge.cone):null;
        if(target!==null){const feet=host.player.position,dash=sweptLunge(melee.lunge,heavy,target.position.x-feet.x,target.position.z-feet.z,targetRadius(target));
          if(dash!==null)host.dashTo(target.position.x,target.position.z,dash.stopAt,dash.time);}
      },charge:()=>undefined,
    });
    host.onStep('nalati.weapons',dt=>{
      const commands=context.commands(),player=commands.find(command=>command.kind==='player');
      const enabled=weaponsEnabled&&host.player.health.alive&&taming.phase!=='breaking';
      const pressed=commands.some(command=>command.kind==='script'&&command.actorId==='nalati.weapon.attack'&&command.value===1);
      for(const command of commands)if(command.kind==='script'&&command.actorId==='nalati.weapon.swap'){
        if(command.value!==1)throw new Error('Invalid weapon swap input');if(!weaponsEnabled)continue;const index=order.indexOf(slot),next=order[(index+1)%order.length];
        if(next===undefined)throw new Error('Missing next held slot');slot=next;clock.stop();queued=false;
      }
      aim=0;
      for(const command of commands)if(command.kind==='script'){
        if(command.actorId==='nalati.weapon.aim'){
          if(command.value!==0&&command.value!==1)throw new Error('Invalid held AIM input');aim=command.value;
        }else if(command.actorId==='nalati.weapon.pitch'){
          if(command.value< -Math.PI/2||command.value>Math.PI/2)throw new Error('Invalid held look pitch');pitch=command.value;
        }
      }
      // riding/client publishes weapon yaw opposite the horse body heading.
      const mounted=mount.horse===null?null:{speed:mount.body.speed,yaw:mount.body.heading-Math.PI};
      const sampled=bowMount(bow.base,host.player.yaw,mounted);if(sampled!==null)saddle=sampled;
      const blocked=bowBlocked({enabled:enabled&&slot===bowSlot.id,cancel:false,bolts,sprinting:mount.rider.sprinting,mounted:mount.mounted,swimming:host.playerSwim.on});
      const event=draw.step(dt,slot===bowSlot.id&&player?.heavy!==undefined,blocked.blocked,saddle.draw);
      if(event==='full')fullDraws++;if(event==='letdown'||event==='tired')letdowns++;
      if(event==='loose'){
        const speed=mount.mounted?0:combat.speedFactor;if(speed===null)throw new Error('Native bow requires its actual motion sample');
        pose();const spread=bowLooseSpreadDegrees(bow.base,aimBlend,speed,0,saddle.spread);
        shotSpread(forward,MathUtils.degToRad(spread),random,bow.base.loose??{radius:'sqrt',axisScale:1},scratch);
        eye.addScaledVector(forward,bowMuzzle(bow.base));velocity.copy(forward).multiplyScalar(bowLaunchSpeed(bow.base,1));
        velocity.x+=saddle.carrier.x;velocity.y+=saddle.carrier.y;velocity.z+=saddle.carrier.z;
        arrows.launch(eye,velocity,{damageScale:bow.base.damageScale});bolts--;shots++;
      }
      aimOn=bowAimOn({asked:aim>0,enabled:enabled&&slot===bowSlot.id,running:blocked.running,swimming:host.playerSwim.on});
      aimBlend+=((aimOn?1:0)-aimBlend)*Math.min(1,dt*bow.base.aimIn);if(Math.abs(aimBlend-(aimOn?1:0))<.002)aimBlend=aimOn?1:0;
      const weatherOwner=host.adapters.get(weather.step);if(weatherOwner===undefined)throw new Error('Missing actual native wind owner');
      wind.restore(v.parse(v.object({wind:WindStateSchema}),weatherOwner.snapshot()).wind);arrows.update(dt);
      if(slot===bladeSlot.id&&enabled){
        if(pressed){if(mounted===null)clock.tryFire();else pass.attack();}
        const strike=pass.decide(dt,{player:host.player,mount:mounted,charging:clock.chargingHeavy,baseDamage:melee.damage,rows:mountedRows,targets:targets()});
        if(strike!==null){passDamage=strike.damage;if(clock.strike(strike.side<0?bladeMoves.passes.left:bladeMoves.passes.right,false))passes++;}
        if(clock.move===null)passDamage=melee.damage;
        const {move,active}=clock.step(dt,host.clock.now,melee.swingScale,player?.heavy!==undefined);
        basePose.blend(dt,SWORD_WOOD.chargeBlend,clock.chargingHeavy,mount.rider.sprinting,move!==null);
        basePose.pose(bladeMoves,move,clock.swingTime,clock.charge,host.clock.now,basePos,baseQ);
        if(move!==null){
          sweptBladeDirs(basePose.basePos,basePose.baseQ,blade.rig.tipX,blade.rig.tipY,grip,tip);pose();
          if(!active||!sweep.have||!bladeInReach(eye,melee.reach,targets(),targetRadius))sweep.hold(grip,tip);
          else sweep.sweep(grip,tip,eye,rotation,move.reach??melee.reach,{raycast:ray,
            blocked:(origin,point)=>bladeBlocked(host.physics,origin,point,host.player.motor.collider),
            strike:hit=>{left.copy(forward).applyAxisAngle(up,Math.PI/2);
              strikeDirection.copy(forward).multiplyScalar(.7).addScaledVector(left,.7*move.sweep).normalize();
              if(Math.abs(move.sweep)<.6)strikeDirection.y-=.35*(1-Math.abs(move.sweep));strikeDirection.normalize();
              const result=host.combat.hit({source:'env',sourceTags:['actor.player',bladeItem.id,'dmg.melee','cover.checked'],
                target:body(key(hit.animal)).combatActor(),amount:Math.round(sweptMoveDamage(passDamage,move,move===bladeMoves.heavy,1)),
                point:hit.point,dir:strikeDirection,from:eye,weaponId:bladeItem.id,moveId:`move.${move.name}`});
              if(result===null)return;bladeContacts++;
              push.set(forward.x,0,forward.z).normalize().multiplyScalar(.8).addScaledVector(left,.5*move.sweep);
              if(!result.killed)hit.animal.stagger?.(push,move.stagger);
              if(move===bladeMoves.passes.left||move===bladeMoves.passes.right)pass.hit();
            }});
        }
      }else clock.stop();
      if(pressed&&slot===spearSlot.id&&enabled)polearm.attackPending=true;
      polearm.stow(slot===spearSlot.id,enabled);
      const out=polearm.decide(dt,host.clock.now,{player:host.player.position,heading:mounted?.yaw??host.player.yaw,held:slot===spearSlot.id,
        enabled,ads:slot===spearSlot.id&&aim>0,ammo,capacity:thrown.carried,mount:mounted,targets:targets(),
        radius:targetRadius,javelins,random,policy:spear.profile,projectile:thrown});
      if(out!==null){if(out.launch&&ammo>0&&flight.free()){ammo--;pose();if(flight.launch(eye,rotation,forward,mounted))throws++;}
        if(out.strike){thrusts++;pose();spearContacts.thrust(eye,rotation,forward,spear.profile);}
        if(out.target!==undefined){pose();spearContacts.lance(eye,out.target,out.damage,host.clock.now,host.player.position);}
        const pickup=javelins[out.pickup];if(pickup!==undefined){pickup.state=0;if(out.recover){ammo++;recovered++;}}}
      flight.fly(dt);
    },{
      snapshot:()=>JSON.stringify({version:1,...(weaponsEnabled?{}:{enabled:false}),slot,queued,aim,pitch,ammo,draw:draw.save(),bolts,shots,letdowns,fullDraws,aimOn,aimBlend,moves:[...moves],passes,passDamage,
        blade:{pose:basePose.snapshot(),grip:sweep.grip.toArray(),tip:sweep.tip.toArray(),have:sweep.have,
          struck:sweep.struck.slice(0,sweep.struckN).map(bladeContactKey),contacts:bladeContacts},
        swing:clock.snapshot(extra),pass:pass.snapshot(),cadence:decision.snapshot(),thrusts,throws,recovered,polearm:polearm.snapshot(actor=>actor.entityId),
        flying:arrows.pool.slots.map(row=>({active:row.active,age:row.age,glanced:row.glanced,pos:row.pos.toArray(),vel:row.vel.toArray(),origin:row.origin.toArray(),scale:row.scale})),
        stopped:arrows.stopped.snapshot(arrowKey),javelins:javelins.map(row=>({state:row.state,age:row.age,pos:row.pos.toArray(),vel:row.vel.toArray(),q:row.q.toArray()}))}),
      restore:input=>{const saved=v.parse(Saved,typeof input==='string'?JSON.parse(input):input);if(!available.has(saved.slot)||saved.flying.length!==arrows.pool.slots.length||saved.javelins.length!==javelins.length
          ||saved.ammo>thrown.carried||saved.bolts>bow.base.quiver||saved.blade.struck.length>melee.sweep.maxHits
          ||new Set(saved.blade.struck).size!==saved.blade.struck.length)throw new Error('Invalid native weapon continuation');
        const missing=new Map<number,string>();
        const struck=saved.blade.struck.map((id,index)=>{const actor=host.entities.get(id);if(actor!==undefined){knownContacts.set(actor,id);return actor;}
          if(!retired().has(id))throw new Error(`Missing native weapon target ${id}`);missing.set(index,id);return null;});
        basePose.restore(saved.blade.pose);sweep.reset();retiredContacts.clear();for(const [index,id]of missing)retiredContacts.set(index,id);
        sweep.grip.fromArray(saved.blade.grip);sweep.tip.fromArray(saved.blade.tip);sweep.have=saved.blade.have;
        struck.forEach((actor,index)=>{sweep.struck[index]=actor;});sweep.struckN=struck.length;bladeContacts=saved.blade.contacts;
        clock.restore(v.parse(SwingSaved,saved.swing),extra);pass.restore(saved.pass);decision.restore(saved.cadence);
        polearm.restore(saved.polearm,body,id=>!host.entities.has(id)&&retired().has(id));draw.load(saved.draw);
        arrows.stopped.restore(saved.stopped,arrowBody);
        saved.flying.forEach((row,index)=>{const target=arrows.pool.slots[index];if(target===undefined)throw new Error('Missing native arrow slot');
          target.active=row.active;target.age=row.age;target.glanced=row.glanced;target.pos.fromArray(row.pos);target.vel.fromArray(row.vel);target.origin.fromArray(row.origin);target.scale=row.scale;});
        saved.javelins.forEach((row,index)=>{const target=javelins[index];if(target===undefined)throw new Error('Missing native javelin slot');
          target.state=row.state;target.age=row.age;target.pos.fromArray(row.pos);target.vel.fromArray(row.vel);target.q.fromArray(row.q);});
        slot=saved.slot;queued=saved.queued;aim=saved.aim;pitch=saved.pitch;ammo=saved.ammo;bolts=saved.bolts;shots=saved.shots;letdowns=saved.letdowns;
        fullDraws=saved.fullDraws;aimOn=saved.aimOn;aimBlend=saved.aimBlend;moves.splice(0,moves.length,...saved.moves);passes=saved.passes;
        passDamage=saved.passDamage;thrusts=saved.thrusts;throws=saved.throws;recovered=saved.recovered;weaponsEnabled=saved.enabled;
      },
    },'afterBodies');
  }};
};}

export const prepareHeadlessRuntime:PrepareHeadlessRuntime=withNalatiWeapons(prepareCompanions);
