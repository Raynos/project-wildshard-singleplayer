import type {SimHost} from '../../../src/engine/sim';
import type {HeadlessCommand} from '../../../src/sdk/tickProtocol';
import {runTrustedHeadlessTape} from '../../../src/sdk/headlessTape';

// Desired walking inputs around the steep south bank and bowl shelves. These
// are route targets, not asserted geometry; the real motor resolves every step.
const bank:readonly (readonly [number,number])[]=[
  [0,147],[1,146],[23,146],[27,142],[29,142],[30,141],
  [39,141],[40,140],[45,140],[46,139],[53,139],[54,138],
  [55,138],[57,136],[57,134],[56,133],[40,133],[36,129],
  [32,129],[30,127],[15,127],[13,125],[11,125],[8,122],
  [8,119],[9,118],[22,118],[25,115],[33,115],[35,113],
  [44,113],[48,109],[49,109],[50,108],[55,108],[57,106],
  [57,105],[55,103],[38,103],[35,100],[28,100],[23,95],
  [18,95],[17,94],[15,94],[14,93],[14,90],[17,87],
  [19,87],[20,86],[22,86],[23,85],[25,85],[30,80],
  [31,80],[32,79],[33,79],[36,76],[37,76],[68,45],
];

/** Enter across the actual river bridge, then walk the bank's traversable
 * shelves. Neither fixture spawn nor any later feet/body state is replaced. */
export function walkNalatiHorsePlains(host:SimHost,step:(commands:readonly HeadlessCommand[])=>void):void {
  runTrustedHeadlessTape(host,step,()=>[],{version:1,observe:[],segments:[{id:'walk-the-river-bridge',ticks:6000,commands:[],
    route:[{x:0,z:216},{x:0,z:200},{x:0,z:190},{x:0,z:183},{x:0,z:170},{x:0,z:158},{x:0,z:150},{x:0,z:146}]}]});
  for(const [x,z] of bank){
    const budget=Math.max(300,Math.ceil(Math.hypot(x-host.player.position.x,z-host.player.position.z)*90));
    let reached=false;
    for(let tick=0;tick<budget;tick++){
      const at=host.player.position,dx=x-at.x,dz=z-at.z,distance=Math.hypot(dx,dz);
      if(distance<.18){reached=true;break;}
      step([{kind:'player',moveX:dx/distance,moveZ:dz/distance,yaw:Math.atan2(-dx,-dz),commandVersion:1,
        steer:{keyX:0,keyY:Math.min(1,distance*2),stickX:0,stickY:0},sprint:true}]);
    }
    if(!reached)throw new Error(`Horse-plains route blocked at ${x}, ${z}`);
  }
}
