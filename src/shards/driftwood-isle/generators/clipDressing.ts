import * as THREE from 'three';

/** Retained triangle runs of the native merged shape, without a second geometry payload. */
export interface ClipRuns { vertices:number; indices:number; output:number; runs:{start:number;count:number}[] }
export function retainedIslandRuns(geometry:THREE.BufferGeometry,keep:(x:number,z:number)=>boolean):ClipRuns {
 const pos=geometry.getAttribute('position'),index=geometry.getIndex(),count=index?.count??pos.count,runs:{start:number;count:number}[]=[];
 for(let t=0;t<count;t+=3){
  const a=index?.getX(t)??t,b=index?.getX(t+1)??t+1,c=index?.getX(t+2)??t+2;
  if(!keep((pos.getX(a)+pos.getX(b)+pos.getX(c))/3,(pos.getZ(a)+pos.getZ(b)+pos.getZ(c))/3))continue;
  const previous=runs.at(-1);if(previous!==undefined&&previous.start+previous.count===t)previous.count+=3;else runs.push({start:t,count:3});
 }
 if(runs.length>4096)throw new Error('Island clip runs exceed metadata bound');
 return{vertices:pos.count,indices:index?.count??0,output:runs.reduce((n,row)=>n+row.count,0),runs};
}

/** Install retained native triangle runs without classifying positions during boot. */
export function clipIslandDressing(geometry:THREE.BufferGeometry,plan:{vertices:number;indices:number;output:number;runs:readonly{start:number;count:number}[]}):void {
 const source=geometry.getIndex(),vertices=geometry.getAttribute('position').count,count=source?.count??vertices;
 if(vertices!==plan.vertices||(source?.count??0)!==plan.indices||plan.runs.length>4096)throw new Error('Required island clipping differs; rebuild its declared facts');
 if(!Number.isSafeInteger(plan.output)||plan.output<0||plan.output>count||plan.runs.some(row=>!Number.isSafeInteger(row.start)||!Number.isSafeInteger(row.count)||row.start<0||row.count<0||row.start%3!==0||row.count%3!==0||row.start+row.count>count)||plan.runs.reduce((n,row)=>n+row.count,0)!==plan.output)throw new Error('Required island clipping runs are corrupt');
 if(plan.output===(source?.count??vertices))return;
 const out=vertices>65535?new Uint32Array(plan.output):new Uint16Array(plan.output);let offset=0;
 for(let i=0;i<4096;i++){
  const row=plan.runs[i];if(row===undefined)break;
  if(source!==null)out.set(source.array.subarray(row.start,row.start+row.count),offset);
  else for(let j=0;j<Math.min(row.count,6_000_000);j++)out[offset+j]=row.start+j;
  offset+=row.count;
 }
 geometry.setIndex(new THREE.BufferAttribute(out,1));
}
