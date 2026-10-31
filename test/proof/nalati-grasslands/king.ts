// oxlint-disable-next-line import/no-nodejs-modules -- Every transition requires an earned original owner.
import assert from 'node:assert/strict';
import type {SimHost} from '../../../src/engine/sim';
import type {HeadlessCommand} from '../../../src/sdk/tickProtocol';
import type {parseHeldSlots} from '../../../src/format/heldArms';
import type {NalatiKingData} from '../../fixtures/nalati-king-data';
import {readNalatiWeaponObservation} from '../../fixtures/nalati-weapon-observation';
import {chapterWalkInputs} from './chapterOne';
import type {KingObservation,KingBodyObservation} from '../../fixtures/nalati-king-continuation';

/** A walking destination inside the actual door program's observed strip. */
export function kingEntryPoint(e:Pick<NalatiKingData['entrance'],'x'|'z'|'facing'>):{readonly x:number;readonly z:number} {
  return {x:e.x+Math.sin(e.facing)*1.7,z:e.z+Math.cos(e.facing)*1.7};
}

/** Commands only. The caller lends detached observations, not the encounter,
 * its bodies, its reset/phase controls, a saved record or a damage port. */
export function* kingEntryInputs(host:SimHost,read:()=>KingObservation,rows:NalatiKingData):Generator<readonly HeadlessCommand[]> {
  for(const flag of ['clue:1','clue:2','clue:3'])assert.ok(host.flags.has(flag),flag);
  assert.equal(host.flags.has('dead:golden-king'),false);
  const e=rows.entrance;
  for(const commands of chapterWalkInputs(host,'earned-king-door',[kingEntryPoint(e)],2400)){
    if(read().inside)break;yield commands;
  }
  for(let tick=0;tick<120&&!read().inside;tick++)yield [{kind:'player',moveX:0,moveZ:0,yaw:e.facing,commandVersion:1,steer:{keyX:0,keyY:0,stickX:0,stickY:0}}];
  assert.equal(read().inside,true,'the original door program must actually enter');
  const p=rows.profile.fight.origin;
  for(const commands of chapterWalkInputs(host,'entered-king-corridor',[{x:p.x,z:p.z+rows.room.halfWidth-2}],1800)){
    if(read().state!=='armed')break;yield commands;
  }
  for(let tick=0;tick<600&&read().state!=='fight';tick++)yield [];
  const entered=read();assert.equal(entered.inside,true);assert.equal(entered.state,'fight');assert.equal(entered.phase,0);
  assert.ok(entered.body?.alive);assert.equal(host.flags.has('dead:golden-king'),false);
}

/** A new child can stop only at the King's actually earned next phase or
 * victory. The enclosing tape retains its original combined ledger/caps. */
export function* kingPhaseInputs(host:SimHost,read:()=>KingObservation,rows:NalatiKingData,
  slots:ReturnType<typeof parseHeldSlots>,through:1|2|'victory'):Generator<readonly HeadlessCommand[]> {
  for(const flag of ['clue:1','clue:2','clue:3'])assert.ok(host.flags.has(flag),flag);
  assert.equal(read().inside,true);assert.ok(read().body);
  const blade=slots.slots.find(slot=>slot.kind==='blade');assert.ok(blade);
  const weapons=()=>{const adapter=host.adapters.get('nalati.weapons');assert.ok(adapter);return readNalatiWeaponObservation(adapter);};
  for(let swap=0;swap<slots.registration.length&&weapons().slot!==blade.id;swap++)yield [{kind:'script',actorId:'nalati.weapon.swap',value:1}];
  assert.equal(weapons().slot,blade.id);
  let dodged=-120;
  const point=(body:KingBodyObservation):{x:number;z:number}=>({x:body.position[0],z:body.position[2]});
  const distance=(body:KingBodyObservation):number=>{const at=point(body),p=host.player.position;return Math.hypot(at.x-p.x,at.z-p.z);};
  for(let tick=0;tick<12_000;tick++){
    const seen=read();assert.equal(seen.inside,true,'combat inputs cannot leave their actual encounter');
    if(through==='victory'?seen.state==='victory':seen.phase>=through)break;
    const king=seen.body;assert.ok(king);
    const adds=seen.adds.filter(body=>body.alive).sort((a,b)=>distance(a)-distance(b));
    const target=seen.shielded&&adds.length>0?adds[0]:king;assert.ok(target);
    const at=point(target),p=host.player.position,dx=at.x-p.x,dz=at.z-p.z,d=Math.hypot(dx,dz);
    const windup=target.attackPhase>=.35&&target.attackPhase<.68,dodge=windup&&d<rows.profile.fight.attacks.combo.reach+1
      &&host.state.tick-dodged>=60;
    if(dodge)dodged=host.state.tick;
    const jump=target===king&&king.act===rows.profile.fight.attacks.burst.act&&king.attackPhase>=.65&&king.attackPhase<.78;
    const heavy=tick%75<45&&d<3.5&&seen.state==='fight';
    yield [{kind:'player',moveX:0,moveZ:0,yaw:Math.atan2(-dx,-dz),commandVersion:1,
      steer:{keyX:0,keyY:0,stickX:dodge?(tick%2===0?.8:-.8):.2,stickY:d>2.1?.65:d<1.3?-.45:0},
      ...(heavy?{heavy:{}}:{}),...(dodge?{dodge:true}:{}),...(jump?{jump:true}:{})}];
  }
  const final=read();
  if(through==='victory'){
    assert.equal(final.state,'victory','only the actual encounter may publish victory');
    assert.ok(host.flags.has('dead:golden-king'),'the real saved record must publish the King outcome');
  }else assert.ok(final.phase>=through,'the original health threshold must earn the next phase');
}
