import {expect,test} from 'vitest';
import {ShaderMaterial} from 'three';
// oxlint-disable-next-line import/no-nodejs-modules -- The browser loan checks the identical complete source digest.
import {createHash} from 'node:crypto';
import {loanMaterialPrograms,type ProgramSource,type MaterialProgramLoan} from '../scripts/perf/material-program-loan.mjs';

function source(body:string):ProgramSource{
 const vertex='attribute vec3 aSeed; uniform float phase; void main(){gl_Position=vec4(aSeed,1.0);}';
 const fragment=`uniform float phase; void main(){gl_FragColor=${body};}`;
 const hash=(text:string):string=>createHash('sha256').update(text).digest('hex');
 return {vertex,fragment,vertexHash:hash(vertex),fragmentHash:hash(fragment)};
}
function fixture():{material:ShaderMaterial;program:MaterialProgramLoan}{
 const before=source('vec4(phase)'),after=source('vec4(phase*1.0)');
 const material=new ShaderMaterial({vertexShader:before.vertex,fragmentShader:before.fragment,uniforms:{phase:{value:7}}});material.name='owned';
 return {material,program:{aliases:['owned'],before,after,uniforms:['phase']}};
}

test('loans only source and restores native material policy and uniforms by identity',async()=>{
 const {material,program}=fixture(),uniforms=material.uniforms,defines=material.defines;
 const onBeforeCompile:unknown=Reflect.get(material,'onBeforeCompile');
 try{
  const loan=await loanMaterialPrograms([material],[program]);
  expect(material.fragmentShader).toBe(program.after.fragment);
  expect(loan.receipts[0]).toMatchObject({materials:1,before:{fragmentHash:program.before.fragmentHash},after:{fragmentHash:program.after.fragmentHash}});
  expect(material.uniforms).toBe(uniforms);expect(uniforms['phase']?.value).toBe(7);
  expect(Reflect.get(material,'onBeforeCompile')).toBe(onBeforeCompile);expect(material.defines).toBe(defines);
  loan.restore();loan.restore();
  expect(material.fragmentShader).toBe(program.before.fragment);expect(material.vertexShader).toBe(program.before.vertex);
  expect(material.uniforms).toBe(uniforms);
 }finally{material.dispose();}
});

test('wrong source, missing uniforms and attribute/uniform changes refuse before any mutation',async()=>{
 for(const kind of ['hash','actual','uniform-value','attribute','uniform-declaration','missing','overlap','unchanged']){
  const {material,program}=fixture(),before=material.fragmentShader;
  let proposed=program;
  if(kind==='hash')proposed={...program,after:{...program.after,fragmentHash:'f'.repeat(64)}};
  if(kind==='actual')material.vertexShader+='\n';
  if(kind==='uniform-value')proposed={...program,uniforms:['other']};
  if(kind==='attribute'){
   const vertex=program.after.vertex.replace('vec3 aSeed','vec2 aSeed');
   proposed={...program,after:{...program.after,vertex,vertexHash:createHash('sha256').update(vertex).digest('hex')}};
  }
  if(kind==='uniform-declaration'){
   const fragment=program.after.fragment.replace('uniform float phase','uniform vec2 phase');
   proposed={...program,after:{...program.after,fragment,fragmentHash:createHash('sha256').update(fragment).digest('hex')}};
  }
  if(kind==='missing')proposed={...program,aliases:['absent']};
  if(kind==='unchanged')proposed={...program,after:program.before};
  try{
   await expect(loanMaterialPrograms([material],kind==='overlap'?[program,program]:[proposed]),kind).rejects.toThrow();
   expect(material.fragmentShader,kind).toBe(before);
  }finally{material.dispose();}
 }
});
