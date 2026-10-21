// Driftwood's tide barrel (G566): the PHYSICS P7-L1 never-jam watch over its declared body. Past its leash it goes home at
// once; at home or on a tide plate it is left alone (clocks cleared); lost (offshore, or under the floor) for 4 s, or wedged
// (the player asking >= 1 m/s into it for 4 s while it got < 0.6 m further), it goes home upright at its declared yaw.
// The decision host runs it at <= 10 Hz and applies its commands on the next fixed step, so its clocks advance by the real
// ticks since its last decision and a teleport lands one step after the decision that asked for it.
import { Body, Read, List, Do, State, Params, Clock } from './generated/driftwoodBarrels';

const PLAYER:i32=0x7fffffff, R:f64=0.38, HALF:f64=0.475, PUSH_R:f64=R+0.35+0.4, PUSH_SPEED:f64=1, WEDGE_MOVE:f64=0.6, HOME_R:f64=1;
const SEA_DEPTH:f64=0.3, UNDER:f64=1.5, LOST_T:f64=4, WEDGE_T:f64=4, PLATE_NEAR:f64=0.3;

@inline function atPlate(cx:f64,cy:f64,cz:f64,px:f64,py:f64,pz:f64,size:f64):bool {
  return Math.hypot(cx-px,cz-pz)<size/2+PLATE_NEAR&&Math.abs(cy-py)<1.2;
}
@inline function goHome():void {
  Do.bodyTeleport(Body.barrel,Params.homeX,Params.homeY+HALF+0.01,Params.homeZ); State.lost=0; State.wedge=0;
}
export function onStart():void { State.lastTick=f64(Clock.tick); if(!Read.bodyAlive(Body.barrel)) Do.bodySpawn(Body.barrel); }
export function onTick(_dt:f64):void {
  const dt=(f64(Clock.tick)-State.lastTick)/60; State.lastTick=f64(Clock.tick);
  if(!Read.bodyAlive(Body.barrel)) return;
  const cx=Read.bodyX(Body.barrel),cy=Read.bodyY(Body.barrel),cz=Read.bodyZ(Body.barrel);
  const dx=cx-Params.homeX,dz=cz-Params.homeZ,dy=cy-HALF-Params.homeY;
  if(dx*dx+dy*dy+dz*dz>Params.leash*Params.leash) { goHome(); return; }
  if(dx*dx+dz*dz<HOME_R*HOME_R||atPlate(cx,cy,cz,Params.plateAX,Params.plateAY,Params.plateAZ,Params.plateASize)
    ||atPlate(cx,cy,cz,Params.plateBX,Params.plateBY,Params.plateBZ,Params.plateBSize)) { State.lost=0; State.wedge=0; return; }
  Read.declaredFloor(cx,cz); const floor=List.at(0);
  State.lost=floor<Params.water-SEA_DEPTH||cy<floor-UNDER?State.lost+dt:0;
  const px=cx-Read.x(PLAYER),pz=cz-Read.z(PLAYER),pd=Math.hypot(px,pz),vx=Read.playerIntent(0),vz=Read.playerIntent(1);
  const into=pd<PUSH_R&&pd>1e-3&&Math.abs(cy-Read.y(PLAYER))<1.5&&(vx*px+vz*pz)/pd>PUSH_SPEED;
  if(into) {
    if(State.wedge==0) { State.fromX=cx; State.fromY=cy; State.fromZ=cz; }
    State.wedge+=dt;
    if(State.wedge>=WEDGE_T) {
      const mx=cx-State.fromX,my=cy-State.fromY,mz=cz-State.fromZ;
      if(Math.sqrt(mx*mx+my*my+mz*mz)<WEDGE_MOVE) { goHome(); return; }
      State.wedge=0;
    }
  } else State.wedge=Math.max(0,State.wedge-dt);
  if(State.lost>LOST_T) goHome();
}
