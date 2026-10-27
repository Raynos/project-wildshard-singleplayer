import bindings from '../data/nightBindings.json' with { type: 'json' };
import { BOWL } from './layout';
import { NALATI_ECOLOGY as ecology } from './ecology.mjs';
import { ghostArrowKind, nightCues } from './nightGeometry';
import type { DecisionScriptRow } from '@wildshard/sdk/decisionScripts';

/** The night roster's ABI-1 return programme: the shard's weather decision (its script; the bytes stay a named file). */
export interface NalatiNightProgram { readonly script: DecisionScriptRow; readonly bytes: string }

function nightRowsOf(program: NalatiNightProgram) {
  const ridge = Array.from({length:16}, (_,i): [number, number] => {
    const t = i * Math.PI / 8, c = Math.cos(t), s = Math.sin(t), b = BOWL;
    return [b.x + b.ax * .85 * Math.sign(c) * Math.abs(c) ** (2/3), b.z + b.az * .85 * Math.sign(s) * Math.abs(s) ** (2/3)];
  });
  const point = (i: number): [number, number] => { const row = ridge[i]; if (row === undefined) throw new Error('Missing night ridge point'); return row; };
  const gaits = ecology.modes.ride[0]?.gaits;
  if (gaits === undefined) throw new Error('Missing night ride gaits');
  let distance = 0;
  const leg = (i: number): number => { const a = point(i - 1), b = point(i); distance += Math.hypot(b[0] - a[0], b[1] - a[1]); return distance; };
  // the original key order: canter, centre, x0..x3, z1..z4, then the running distances d1..d4
  const params = { canter: gaits.canter, center: BOWL.z, x0: point(0)[0], x1: point(1)[0], x2: point(2)[0], x3: point(3)[0],
    z1: point(1)[1] - BOWL.z, z2: point(2)[1] - BOWL.z, z3: point(3)[1] - BOWL.z, z4: point(4)[1] - BOWL.z, d1: leg(1), d2: leg(2), d3: leg(3), d4: leg(4) };
  const {geometry,material,...arrow}=ghostArrowKind();
  const shape={data:geometry.toJSON().data};geometry.dispose();material.dispose();
  const view = {cycle:{wake:"spawn",dawn:"dissolve"},states:{broken:"broken",retire:"retire",home:"statue"},
    cues:{wake:"cue.balbal.wake",hit:"cue.balbal.chip",weak:"cue.balbal.crack",hard:{cue:"cue.balbal.chip.hard",drop:40},broken:"cue.balbal.broken",strike:"cue.balbal.slam"},
    lift:{wake:.1,hit:1.2,broken:1,strike:.1},strike:{field:"slamT",ahead:.75},every:.05,
    // soil pours off a balbal moving through the ground (dust now and then); a clod falls from one walking
    trails:[{cue:"cue.balbal.soil",field:"rise",min:1e-6,max:1,chance:1,at:"ground",lift:.05},{cue:"cue.balbal.dust",field:"rise",min:1e-6,max:1,chance:.35,at:"ground",lift:.1},
      {cue:"cue.balbal.clod",field:"rise",min:1,max:2,chance:.18,at:"body",lift:0}],
    tell:{pool:6,hold:.08,alpha:[.6,.4,1.4],look:"nalati-tell"}};
  // a ghost rider: the fresnel ghost looks (the Titan's storm riders the quiet one, 1.6x), the hooded figure on the body
  // bone, its torso and hood as targets, its mist, and the glowing arrow
  const ride = {looks:{rider:"nalati-ghost",captain:"nalati-ghost-captain",storm:"nalati-ghost-storm"},quietLook:"storm",quietScale:1.6,figure:{bone:"body"},seat:[0,.36,.28],states:{fade:"fade",dying:"dying",dead:"dead"},
    cues:{form:"cue.ghost.form",tear:"cue.ghost.tear",loose:"cue.ghost.loose",hurt:"cue.ghost.hurt",impact:"cue.ghost.impact"},lift:{form:1,loose:.7},
    trail:{cue:"cue.ghost.trail",rate:22,back:1.1},aim:"aim",damage:10,
    targets:[{at:[0,.86,.3],radius:.36,head:false},{at:[0,1.26,.42],radius:.2,head:true}],
    arrow:{...arrow,geometry:shape,colour:[.7,2.6,3],renderOrder:13}};
  return {...bindings,ride,view:{...view,tell:{...view.tell,...bindings.tell}},cues:nightCues(),program,parameters:params,motion:{signal:"patrolMotion",initial:{x:0,z:0,vx:0,vz:0,first:1},parameters:{radius:20},retain:{x:"x",z:"z",vx:"vx",vz:"vz",first:"first"}},slots:{actors:{kind:"balbal",variant:"warrior",variants:{"1":"capped"},herd:-1,yaw:Math.PI,sink:-2.5,memory:{field:1,rise:0},home:{x:"homeX",z:"homeZ",yaw:"homeYaw"},dawn:"dawn",gone:"gone"},release:"statue",cycle:{signal:"warriorCycle",initial:{phase:-1,t:-1}},member:{signal:"warrior",initial:{t:0}},select:{signal:"tonight",count:5}},patrol:{actors:{kind:"ghost-rider",variant:"rider",leader:"captain",count:3,herd:-1,player:{x:"px",z:"pz"},target:{x:"tx",z:"tz"},steering:{tx:"tx",tz:"tz",v:"v",turn:"turn"}},parameters:params,member:{fade:0,fadeTarget:1,dying:0,dead:0},group:{s:0,mode:0,theta:0,dir:1,t:0},signals:{cycle:"patrolCycle",empty:"patrolEmpty",dissolve:"patrolDissolve",member:"rider",fire:"patrolFire",retry:"retry",start:"lineStart",slot:"lineSlot",group:"line",target:"target"}},respawn:60};
}

/** GR6 (G783): the night roster rows (the retired `nalati-elite-charge` job's data/night.generated.json) around the
 *  shard's weather decision programme; the build and tests call this with the compiled weather rows. */
export function nalatiNightRows(program: NalatiNightProgram): ReturnType<typeof nightRowsOf> {
  // the rows read exactly as the job's JSON did (-0 as 0, no undefined fields)
  const wire = JSON.stringify(nightRowsOf(program)), exact: unknown = JSON.parse(wire);
  return exact as ReturnType<typeof nightRowsOf>;
}
