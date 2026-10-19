/** Camera-only fit inside the actual convex arena. No room or subject edits. */
import { PerspectiveCamera, Vector3 } from 'three';
export const DIRECTIONS={front:[0,0,-1],left:[1,0,0],right:[-1,0,0],back:[0,0,1],top:[0,1,0],
  'diag-front':[0,.8,-1],'diag-left':[1,.8,0],'diag-right':[-1,.8,0],'diag-back':[0,.8,1]};
// Exact TrainingArena constants; build admission separately pins/verifies their producer bytes.
export const ROOM={min:[-50,899.97,-50],max:[50,909,50],cameraMin:[-49.5,900.5,-49.5],cameraMax:[49.5,908.5,49.5]};
const inside=(point,min,max)=>point.toArray().every((v,i)=>v>=min[i]&&v<=max[i]);
export function fitViews(bounds,world,aspect,near=.1,far=1000,fields=[35,40,45,50,55,60,65,70,75,80,85,90,95,100,105,110]) {
  const center=bounds.getCenter(new Vector3()).applyMatrix4(world),size=bounds.getSize(new Vector3());
  const scale=new Vector3().setFromMatrixScale(world),radius=size.length()*.5*Math.max(scale.x,scale.y,scale.z);
  const corners=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])corners.push(new Vector3(x,y,z).applyMatrix4(world));
  if(!corners.every(p=>inside(p,ROOM.min,ROOM.max)))throw new Error('Character bounds leave actual arena room');
  for(const fov of fields) {
    const distance=radius/Math.sin(Math.atan(Math.tan(fov*Math.PI/360)*Math.min(1,aspect)))*1.08,views={};let valid=true;
    for(const [view,vector] of Object.entries(DIRECTIONS)) {
      const direction=new Vector3(...vector).normalize().transformDirection(world),camera=new PerspectiveCamera(fov,aspect,near,far);
      camera.position.copy(center).addScaledVector(direction,distance);
      if(!inside(camera.position,ROOM.cameraMin,ROOM.cameraMax)){valid=false;break;}
      if(view==='top')camera.up.set(0,0,-1).transformDirection(world);
      camera.lookAt(center);camera.updateMatrixWorld(true);
      const projected=corners.map(p=>p.clone().project(camera).toArray());
      if(!projected.every(p=>Math.abs(p[0])<=.98&&Math.abs(p[1])<=.98&&p[2]>-1&&p[2]<1)){valid=false;break;}
      views[view]={position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),up:camera.up.toArray(),projectedCorners:projected};
    }
    if(valid)return {fov,aspect,distance,target:center.toArray(),room:ROOM,worldCorners:corners.map(p=>p.toArray()),views};
  }
  throw new Error('No camera fit preserves all nine views inside actual room and projected bounds');
}
