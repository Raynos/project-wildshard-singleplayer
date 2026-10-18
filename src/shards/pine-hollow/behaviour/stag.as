import { Field, Channel, Read, Do, Params } from './generated/pineLife';

@inline function get(field:i32):f64 { return Read.field(0,field); }
@inline function distance(ax:f64,az:f64,bx:f64,bz:f64):f64 { return Math.hypot(ax-bx,az-bz); }
// Event projections retain the caller's clock and original i/mode/t continuation.
// 0 silent, 1 first appearance, 2 later appearance, 3 fade, 4 cancel, 5 complete.
export function lead():void {
  let i=i32(get(Field.i)),mode=i32(get(Field.mode)),elapsed=get(Field.elapsed),event:i32=0;
  const on=get(Field.on)!=0,begin=get(Field.begin)!=0,px=get(Field.playerX),pz=get(Field.playerZ);
  if(!on) { if(mode!=0)event=4; i=0;mode=0; }
  else {
    if(mode==0&&distance(px,pz,Params.firstX,Params.firstZ)<=Params.first) {i=0;mode=1;elapsed=0;event=1;}
    if(!begin&&mode!=0) {
      elapsed+=get(Field.dt);
      if(mode==1) {
        const x=event==1?Params.firstX:get(Field.atX),z=event==1?Params.firstZ:get(Field.atZ);
        if(distance(px,pz,x,z)<Params.near||distance(px,pz,Params.lastX,Params.lastZ)+Params.past<distance(x,z,Params.lastX,Params.lastZ)) {mode=2;elapsed=0;}
      } else if(mode==2&&elapsed>Params.trot) {
        if(i+1>=Params.length) {mode=0;i=0;event=5;}
        else {i++;mode=3;elapsed=0;event=3;}
      } else if(mode==3&&elapsed>Params.gone) {mode=1;elapsed=0;event=2;}
    }
  }
  Do.channel(Channel.i,i);Do.channel(Channel.mode,mode);Do.channel(Channel.elapsed,elapsed);Do.channel(Channel.event,event);
}
