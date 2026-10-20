/** Source-only necessary-condition check at exact authored idle t=0. NOT a consumer bypass or contact trial. */
import {readFileSync,writeFileSync} from 'node:fs';
import {Vector3} from 'three';
const here=new URL('./',import.meta.url);
const source=JSON.parse(readFileSync(new URL('native-source.json',here))),meta=JSON.parse(readFileSync(new URL('metadata.json',here))),d=meta.bodies[0].dims;
const pivot=n=>new Vector3(...source.bones.find(b=>b.name===n).pos);
const axis=new Vector3(0,Math.sin(d.bodyPitch),Math.cos(d.bodyPitch));const centre=new Vector3(...d.bodyAt).add(pivot('body'));
const a=centre.clone().addScaledVector(axis,-d.bodyHalfLen),b=centre.clone().addScaledVector(axis,d.bodyHalfLen),h=new Vector3(...d.headAt).add(pivot('head'));
const f=d.fore,fc=new Vector3(...f.at).add(pivot(f.bone)),fa=fc.clone().add(new Vector3(-f.halfLen,0,0)),fb=fc.clone().add(new Vector3(f.halfLen,0,0));
const seg=(p,a,b)=>{const v=b.clone().sub(a),t=Math.max(0,Math.min(1,p.clone().sub(a).dot(v)/v.lengthSq()));return p.distanceTo(a.clone().addScaledVector(v,t));};
const margins=p=>[seg(p,a,b)-d.bodyRadius,p.distanceTo(h)-d.headRadius,seg(p,fa,fb)-f.radius];
let worst=null,outside=0,certified=0;const rows=[];
for(const part of source.parts){let outsideCorners=0;const assignments=[];const own=source.bones[part.skinIndices[0]].name;
 for(let t=0;t<part.positions.length/9;t++){const ms=[];for(let c=0;c<3;c++){const corner=t*3+c,p=new Vector3(...part.positions.slice(corner*3,corner*3+3).map(Math.fround)),m=margins(p);ms.push(m);const gap=Math.min(...m);if(gap>1e-7){outside++;outsideCorners++;if(worst===null||gap>worst.outsideBy)worst={part:part.name,owner:own,triangle:t,corner,point:p.toArray(),outsideBy:gap,shapeMargins:m};}}
  const shape=['body','head','fore'].findIndex((_,s)=>ms.every(m=>m[s]<=1e-7));assignments.push(shape<0?'outside-or-unproven':['body','head','fore'][shape]);if(shape>=0)certified++;
 }rows.push({part:part.name,owner:own,triangles:part.positions.length/9,outsideCorners,assignments});
}
if(worst===null)throw Error('Expected retained source refusal');
const report={status:'necessary live source condition fails independently of packed rejection',evaluation:'exact authored idle t=0, speed=0, flinch=0, deathT=-1, strike phase=0 elapsed=0; all rotations zero, leg channels equal bind locals',notRuntimeAdmission:true,notPhysics:true,outsideCorners:outside,certifiedTrianglesAtThisPose:certified,totalTriangles:source.parts.reduce((s,p)=>s+p.positions.length/9,0),worstWitness:worst,shapes:{body:{a:a.toArray(),b:b.toArray(),radius:d.bodyRadius},head:{centre:h.toArray(),radius:d.headRadius},fore:{bone:f.bone,a:fa.toArray(),b:fb.toArray(),radius:f.radius}},allPoseConditionalCertificate:'Body, cranio-cervical and flower components each have all corners in their own same-owner convex live shape, so each whole triangle stays in that shape under every rigid authored transform. This is not a union-of-vertices proof. Tail and limb corners already miss all three shapes at authored idle t=0, disproving complete coverage. No exemptions granted.',rows};
writeFileSync(new URL('live-source-witness.json',here),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({outsideCorners:outside,certified,totalTriangles:report.totalTriangles,worst}));
