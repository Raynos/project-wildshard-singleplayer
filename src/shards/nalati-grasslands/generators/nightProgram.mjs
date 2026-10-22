import bindings from '../data/nightBindings.json' with { type: 'json' };
import { weatherDecision } from './weatherDecision.mjs';
import { BOWL } from './layout.ts';
import ecology from '../data/ecology.generated.json' with { type: 'json' };
import { ghostArrowKind, ghostStyles, nightCues } from './nightGeometry.ts';

export async function nightProgram() {
  const ridge = Array.from({length:16}, (_,i) => {
    const t = i * Math.PI / 8, c = Math.cos(t), s = Math.sin(t), b = BOWL;
    return [b.x + b.ax * .85 * Math.sign(c) * Math.abs(c) ** (2/3), b.z + b.az * .85 * Math.sign(s) * Math.abs(s) ** (2/3)];
  });
  const params = {canter:ecology.modes.ride[0].gaits.canter,center:BOWL.z};
  for (let i=0;i<4;i++) params[`x${i}`]=ridge[i][0];
  for (let i=1;i<=4;i++) params[`z${i}`]=ridge[i][1]-BOWL.z;
  let distance = 0;
  for (let i=0;i<4;i++) {distance+=Math.hypot(ridge[i+1][0]-ridge[i][0],ridge[i+1][1]-ridge[i][1]);params[`d${i+1}`]=distance;}
  const program = await weatherDecision();
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
  const ride = {looks:ghostStyles(),quietLook:"storm",quietScale:1.6,figure:{bone:"body"},seat:[0,.36,.28],states:{fade:"fade",dying:"dying",dead:"dead"},
    cues:{form:"cue.ghost.form",tear:"cue.ghost.tear",loose:"cue.ghost.loose",hurt:"cue.ghost.hurt",impact:"cue.ghost.impact"},lift:{form:1,loose:.7},
    trail:{cue:"cue.ghost.trail",rate:22,back:1.1},aim:"aim",damage:10,
    targets:[{at:[0,.86,.3],radius:.36,head:false},{at:[0,1.26,.42],radius:.2,head:true}],
    arrow:{...arrow,geometry:shape,colour:[.7,2.6,3],renderOrder:13}};
  return {...bindings,ride,view:{...view,tell:{...view.tell,...bindings.tell}},cues:nightCues(),program,parameters:params,motion:{signal:"patrolMotion",initial:{x:0,z:0,vx:0,vz:0,first:1},parameters:{radius:20},retain:{x:"x",z:"z",vx:"vx",vz:"vz",first:"first"}},slots:{actors:{kind:"balbal",variant:"warrior",variants:{"1":"capped"},herd:-1,yaw:Math.PI,sink:-2.5,memory:{field:1,rise:0},home:{x:"homeX",z:"homeZ",yaw:"homeYaw"},dawn:"dawn",gone:"gone"},release:"statue",cycle:{signal:"warriorCycle",initial:{phase:-1,t:-1}},member:{signal:"warrior",initial:{t:0}},select:{signal:"tonight",count:5}},patrol:{actors:{kind:"ghost-rider",variant:"rider",leader:"captain",count:3,herd:-1,player:{x:"px",z:"pz"},target:{x:"tx",z:"tz"},steering:{tx:"tx",tz:"tz",v:"v",turn:"turn"}},parameters:params,member:{fade:0,fadeTarget:1,dying:0,dead:0},group:{s:0,mode:0,theta:0,dir:1,t:0},signals:{cycle:"patrolCycle",empty:"patrolEmpty",dissolve:"patrolDissolve",member:"rider",fire:"patrolFire",retry:"retry",start:"lineStart",slot:"lineSlot",group:"line",target:"target"}},respawn:60};
}
