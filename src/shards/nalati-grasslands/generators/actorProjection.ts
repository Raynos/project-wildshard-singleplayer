import { parseActorProjectionV2,type ActorProjectionV2Rows } from '@wildshard/format/actorProjectionV2';
import type { CreatureGuestRows } from '@wildshard/format/speciesBookRows';

/** Compile the existing authored guest metadata into H4 columns. This producer
* has no live actor, service, clock or continuation. */
export function actorProjection(row:CreatureGuestRows):ActorProjectionV2Rows {
  const column=(name:string,source:unknown)=>({name,source});
  const columns=(rows:ReturnType<typeof column>[])=>rows.map((value,index)=>({...value,id:index+1}));
  const actor=(name:string,field=name)=>column(name,{kind:'actor',field});
  const channel=(name:string)=>({kind:'channel',name});
  const memory=Object.entries(row.memory).map(([key,value])=>column(key,{kind:'memory',key,default:value}));
  const think=columns([...memory,column('bearing',{kind:'bearing',target:{kind:'player'}}),
  column('homeBearing',{kind:'bearing',target:{kind:'memory',x:'homeX',z:'homeZ',fallback:'self'}}),
  column('homeOff',{kind:'heading-offset',target:{kind:'memory',key:'homeYaw'}}),column('hitOff',{kind:'heading-offset',target:{kind:'player'}}),
  column('dt',{kind:'time',field:'dt'}),...['x','y','z'].map(axis=>column(`p${axis}`,{kind:'player-position',axis})),
  actor('x'),actor('ay','y'),actor('z'),actor('yaw'),column('state',{kind:'actor-state',states:row.states}),
  column('calm',{kind:'context',field:'calm'}),actor('attack','attackPhase'),
  column('bounds',{kind:'memory-present',keys:['minX','maxX','minZ','maxZ']}),actor('scale')]);
  const weak=columns([actor('x'),actor('ay','y'),actor('z'),column('cos',{kind:'heading-component',axis:'cos',sign:-1}),
  column('sin',{kind:'heading-component',axis:'sin',sign:-1}),actor('scale'),actor('yOffset'),...['x','y','z'].map(axis=>column(`hit${axis.toUpperCase()}`,{kind:'hit',axis}))]);
  const damage=columns([['field',0],['rise',1],['open',0]].map(([key,value])=>column(String(key),{kind:'memory',key,default:{value}})).concat([
  column('range',{kind:'distance-xz',from:{kind:'hit'},to:{kind:'memory',x:row.playerKeys[0],z:row.playerKeys[1],fallback:'zero'}}),
  column('requestPresent',{kind:'request',field:'present'}),column('legacyTag',{kind:'request-tags',tags:[row.piercing.legacy]}),
  column('piercingTag',{kind:'request-tags',tags:row.piercing.tags}),column('equipmentMatch',{kind:'equipment',ids:row.piercing.equipment}),
  column('crack',{kind:'result',channel:'weakPoint'})]));
  return parseActorProjectionV2({program:row.program,step:{signal:'think',clock:row.clock,every:.1,columns:think,operations:[
      ...row.writes.map(key=>({kind:'memory',key,value:channel(key)})),{kind:'memory',key:'init',value:{kind:'constant',value:1}},
      {kind:'memory',key:row.clock,value:{kind:'time'}},...row.playerKeys.map((key,index)=>({kind:'memory',key,value:{kind:'player',axis:index===0?'x':'z'}})),
      {kind:'position',axis:'x',value:channel('x')},{kind:'position',axis:'z',value:channel('z')},{kind:'look',weight:channel('look')},
      {kind:'state',value:channel('state'),states:row.states},{kind:'attack',when:{channel:'start',equal:1},seconds:row.attack},
      {kind:'motion',when:{channel:'motion',equal:1},path:{channel:'path',equal:1},yaw:channel('yaw'),speed:channel('speed'),turn:channel('turn')},
      {kind:'cancel',when:{channel:'cancel',equal:1}},{kind:'contact',when:{channel:'strike',equal:1},strike:row.strike,damage:channel('damage'),length:row.length,sound:row.strikeSound},
      {kind:'sound',value:channel('sound'),sounds:row.sounds}]},damage:{requests:[{signal:'weakPoint',columns:weak},{signal:'damage',columns:damage}],result:'damage'}});
}
