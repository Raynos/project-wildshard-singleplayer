import {installBounds} from '../../../src/engine/world/bounds';
import {floorBelow} from '../../../src/engine/physics/query';
import type {Bounds} from '../../../src/engine/level/spec';
import type {SimHost} from '../../../src/engine/sim';

const declared=new WeakMap<SimHost,Bounds>();
const installed=new WeakSet<SimHost>();
/** Retain authored bounds without adding work to ordinary native replay. */
export function registerNativeWalkBounds(host:SimHost,bounds:Bounds|undefined):void {
  if(bounds!==undefined)declared.set(host,bounds);
}
/** Activate the page's unchanged bounds owner only for native walk proofs. */
export function installNativeWalkBounds(host:SimHost):void {
  const bounds=declared.get(host);if(bounds===undefined||installed.has(host))return;
  installed.add(host);
  const spawn=(x:number,z:number,yaw:number,y:number):void=>{host.resetPlayerPose({x,y,z},yaw);};
  installBounds({addSystem:(spec,scope)=>{
    scope.onDispose(host.onStep(spec.id,dt=>{spec.run(dt,host.clock.now);},undefined,'afterBodies'));
  }},host.scope,bounds,{
    player:{position:host.player.position,get yaw(){return host.player.yaw;},
      get onGround(){return host.playerFall.grounded;},get hover(){return host.playerBoard.on;},spawn},
    suspended:()=>false,
    floorAt:(x,z)=>floorBelow(host.physics,x,z,host.player.position.y+0.6,1.2,host.player.motor.collider),
    toSpawn:()=>{const {at,yaw}=host.level.player;spawn(at.x,at.z,yaw,at.y);},
  });
}
