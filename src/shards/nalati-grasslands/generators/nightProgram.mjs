import { weatherDecision } from './weatherDecision.mjs';
import { BOWL } from './layout.ts';
import ecology from '../data/ecology.generated.json' with { type: 'json' };
import { ghostArrowKind, wedgeMaterial, ghostStyles } from './nightGeometry.ts';

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
  const wedge = wedgeMaterial();
  const shaders = {vertexShader:wedge.vertexShader,fragmentShader:wedge.fragmentShader};wedge.dispose();
  return {ghost:ghostStyles(),wedge:shaders,program,parameters:params,motion:{signal:"patrolMotion",initial:{x:0,z:0,vx:0,vz:0,first:1},parameters:{radius:20},retain:{x:"x",z:"z",vx:"vx",vz:"vz",first:"first"}},slots:{actors:{kind:"balbal",variant:"warrior",variants:{"1":"capped"},herd:-1,yaw:Math.PI,sink:-2.5,memory:{field:1,rise:0},home:{x:"homeX",z:"homeZ",yaw:"homeYaw"},dawn:"dawn",gone:"gone"},release:"statue",cycle:{signal:"warriorCycle",initial:{phase:-1,t:-1}},member:{signal:"warrior",initial:{t:0}},select:{signal:"tonight",count:5}},patrol:{actors:{kind:"ghost-rider",variant:"rider",leader:"captain",count:3,herd:-1,player:{x:"px",z:"pz"},target:{x:"tx",z:"tz"},steering:{tx:"tx",tz:"tz",v:"v",turn:"turn"}},parameters:params,member:{fade:0,fadeTarget:1,dying:0,dead:0},group:{s:0,mode:0,theta:0,dir:1,t:0},signals:{cycle:"patrolCycle",empty:"patrolEmpty",dissolve:"patrolDissolve",member:"rider",fire:"patrolFire",retry:"retry",start:"lineStart",slot:"lineSlot",group:"line",target:"target"}},geometry:shape,arrow,respawn:60,damage:10};
}
