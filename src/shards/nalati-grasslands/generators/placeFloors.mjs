// Build-only floor profiles. Physics still uses the original collider rows.
import { zlibSync } from 'fflate';

export function placeFloors(row) {
  if (row.kind === 'ledge') return { rects: [{ x: row.x, z: row.z, hw: row.hw, hd: row.hd, y: row.top, rot: row.heading === undefined ? Math.atan2(row.sn,row.cs) : Math.atan2(...row.heading) }] };
  if (row.kind === 'cave') {
    const {x,z,cs,sn,mouthW,depth,porchY:y}=row, rot=Math.atan2(sn,cs);
    return { rects: [{x:x+.075*sn,z:z+.075*cs,hw:3,hd:2.025,y,rot},{x:x+(2.1+depth/2)*sn,z:z+(2.1+depth/2)*cs,hw:mouthW/2,hd:depth/2,y,rot}] };
  }
  if (!('kind' in row) && !('slabs' in row)) {
    const {x,halfWidth:hw,z0,z1,flat0,flat1,deck:y,slope}=row;
    return { rects: [{x,z:0,hw,hd:Math.max(Math.abs(z0),Math.abs(z1)),y,profile:[[z0,hw,-(flat0-z0)*slope],[flat0,hw,0],[flat1,hw,0],[z1,hw,-(z1-flat1)*slope]]}] };
  }
  const tor='slabs' in row;
  const x=tor?row.cx:row.x,z=tor?row.cz:row.z;
  const size=tor?Math.max(row.rTop,...row.slabs.map(s=>s[0]+row.w+.1))*2+1:Math.max(row.len,row.dep,row.cw+3.6)*2+2;
  const res=Math.ceil(size/.08)+1,values=new Float32Array(res*res);
  function sample(px,pz) {
    const dx=px-x,dz=pz-z;
    if(tor){const r=Math.hypot(dx,dz),a=((row.a0-Math.atan2(dz,dx))%(Math.PI*2)+Math.PI*2)%(Math.PI*2),sl=row.slabs[Math.floor(a/row.da)];
      const step=sl===undefined||r<sl[0]-.2||r>sl[0]+row.w+.1?undefined:sl[1],top=r<=row.rTop?row.top:undefined;
      return step===undefined||(top!==undefined&&top>step)?top:step;}
    const {fx,fz,cw,len,lintelY,dep,floorY,nSteps,rise}=row,lz=-(dx*fx+dz*fz),lx=dx*fz-dz*fx;
    let hood;
    if(lz>=.4&&lz<=len-.2&&Math.abs(lx)<=cw/2+1.1){const t=lz/len;hood=lintelY+1.05-t*1.2+Math.sin(Math.PI*t)*.25-(1-Math.cos(lx/((cw+3.6)/2)*1.35))*1.6;}
    let floor;
    if(Math.abs(lx)<=cw/2){if(lz>=-.15&&lz<=dep)floor=floorY;else if(lz<-.15&&lz>-.2-(nSteps+.5)*.5){const i=Math.ceil((-.2-lz)/.5-.5);floor=floorY-rise*Math.max(1,i)/(nSteps+1);}}
    return hood===undefined?floor:floor===undefined?hood:Math.max(hood,floor);
  }
  for(let j=0;j<res;j++)for(let i=0;i<res;i++)values[j*res+i]=sample(x-size/2+i*size/(res-1),z-size/2+j*size/(res-1))??Number.NaN;
  return {x,z,size,res,data:Buffer.from(zlibSync(new Uint8Array(values.buffer))).toString('base64')};
}
