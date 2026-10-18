import * as THREE from 'three';

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
