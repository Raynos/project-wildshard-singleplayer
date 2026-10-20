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
  return {ghost:ghostStyles(),wedge:shaders,program,parameters:params,patrol:{parameters:params,member:{fade:0,fadeTarget:1,dying:0,dead:0},group:{s:0,mode:0,theta:0,dir:1,t:0},signals:{cycle:"patrolCycle",empty:"patrolEmpty",dissolve:"patrolDissolve",member:"rider",fire:"patrolFire",retry:"retry",start:"lineStart",slot:"lineSlot",group:"line",target:"target"}},geometry:shape,arrow,respawn:60,damage:10};
}
