import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { fileURLToPath } from 'node:url';
import { BOWL } from './layout.ts';
import ecology from '../data/ecology.generated.json' with { type: 'json' };
import { ghostArrowKind, wedgeMaterial } from './nightGeometry.ts';

export async function nightProgram() {
  const fields = ['at','px','py','pz','slot','s','dt','ax','az','mode','theta','dir','t','respawn','hold','night','alive','dead','dying','fade','fadeTarget','x','y','z','vx','vz','count','gone','fireT','quiet','distance','engaged'];
  const channels = ['s','dir','x','z','yaw','mode','theta','t','speed','turn','respawn','spawn','killed','dead','dying','fade','fadeTarget','retire','dx','dy','dz','index','broken','statue','fireT','shoot'];
  const signals = ['lineStart','lineSlot','line','target','roster','rider','aim','tonight','warrior','fire','retry'];
  const aliases = names => Object.fromEntries(names.map(name => [name,name]));
  const registry = names => new Map([...names].sort((a,b)=>a<b?-1:a>b?1:0).map((name,index) => [name,index+1]));
  const ridge = Array.from({length:16}, (_,i) => {
    const t = i * Math.PI / 8, c = Math.cos(t), s = Math.sin(t), b = BOWL;
    return [b.x + b.ax * .85 * Math.sign(c) * Math.abs(c) ** (2/3), b.z + b.az * .85 * Math.sign(s) * Math.abs(s) ** (2/3)];
  });
  const params = {canter:ecology.modes.ride[0].gaits.canter,center:BOWL.z};
  for (let i=0;i<4;i++) params[`x${i}`]=ridge[i][0];
  for (let i=1;i<=4;i++) params[`z${i}`]=ridge[i][1]-BOWL.z;
  let distance = 0;
  for (let i=0;i<4;i++) {distance+=Math.hypot(ridge[i+1][0]-ridge[i][0],ridge[i+1][1]-ridge[i][1]);params[`d${i+1}`]=distance;}
  const row = {id:'nalati.night',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/night.as',
    binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params,
    reads:['field','random','radial'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals)};
  const programs = {};
  for (const [key,suffix] of [['line',''],['roster','Roster'],['aim','Aim']]) {
    const source = {...row,id:`nalati.night${suffix}`,source:`behaviour/night${suffix}.as`};
    const built = await compileDecisionScripts([source],{fields:registry(fields),channels:registry(channels),signals:registry(signals)},
      readDecisionSources(fileURLToPath(new URL('../',import.meta.url))),{asLineCeiling:2837});
    const script=built.rows.at(0),blob=built.blobs.at(0); if(script===undefined||blob===undefined)throw new Error('Missing night program');
    programs[key] = {script,bytes:Buffer.from(blob.bytes).toString('base64')};
  }
  const {geometry,material,...arrow}=ghostArrowKind();
  const shape={data:geometry.toJSON().data};geometry.dispose();material.dispose();
  const wedge = wedgeMaterial();
  const shaders = {vertexShader:wedge.vertexShader,fragmentShader:wedge.fragmentShader};wedge.dispose();
  return {wedge:shaders,programs,geometry:shape,arrow,respawn:60,damage:10};
}
