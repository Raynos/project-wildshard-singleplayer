import { Signal, Field, Channel, Read, List, Do } from './generated/nalatiWeather';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function put(id:i32,value:f64):void{Do.channel(id,value);}
@inline function height(x:f64,z:f64):f64{Read.groundHeight(Math.max(-250,Math.min(250,x)),Math.max(-250,Math.min(250,z)));return List.at(0);}
function ridge(x:f64,z:f64):f64 {
 const a=11.052731928034621,b=4.673020107703806;
 const mean=height(x+a,z+b)+height(x-b,z+a)+height(x-a,z-b)+height(x+b,z-a);
 return height(x,z)-mean/4>1.5?1:0;
}
@inline function top():f64{return f(Field.py)+(f(Field.crouched)>0?1.05:1.75)+(f(Field.mounted)>0?1.5:0);}
// Requests are dispatched by the world adapter at no more than ten Hz.
export function onSignal(signal:i32,value:f64,source:i32):void {
 if(signal==Signal.arm){
  const hunt=f(Field.lowFor)>3&&Read.random()<.45,angle=hunt?0:Read.random()*Math.PI*2,d=hunt?0:40+Read.random()*190;
  Read.radial(angle,d);const dx=List.at(1),dz=List.at(0);put(Channel.x,f(Field.px)+dx);put(Channel.z,f(Field.pz)+dz);put(Channel.radius,hunt?30:35);
 }else if(signal==Signal.pick){
  const cx=f(Field.cx),cz=f(Field.cz),r=f(Field.radius),first=f(Field.first)>0;
  let x=f(Field.bestX),z=f(Field.bestZ),y=f(Field.bestY),kind=f(Field.bestKind),index=f(Field.bestIndex),score=f(Field.bestScore);
  if(first){x=cx;z=cz;y=height(cx,cz);kind=0;index=-1;score=y+ridge(cx,cz);}
  const scan=f(Field.scan);
  if(scan>=0){const a=scan*Math.PI/4;Read.radial(a,r*.6);const dx=List.at(1),dz=List.at(0),tx=cx+dx,tz=cz+dz,ty=height(tx,tz),s=ty+ridge(tx,tz);if(s>score){x=tx;z=tz;y=ty;score=s;kind=0;index=-1;}}
  if(f(Field.count)>0){
   const tx=Read.field(1,Field.x),tz=Read.field(1,Field.z),ty=Read.field(1,Field.top),s=ty+ridge(tx,tz);
   if(s>score){x=tx;z=tz;y=ty;score=s;kind=Read.field(1,Field.kind);index=Read.field(1,Field.index);}
  }
  if(first){const px=f(Field.px),pz=f(Field.pz),py=top(),ps=py+ridge(px,pz);
  if(f(Field.sheltered)==0&&Math.hypot(px-cx,pz-cz)<=r&&ps>score){x=px;z=pz;y=py;kind=3;index=-1;score=ps;}}
  put(Channel.x,x);put(Channel.y,y);put(Channel.z,z);put(Channel.kind,kind);put(Channel.index,index);put(Channel.score,score);
 }else if(signal==Signal.low){
  if(f(Field.active)==0||f(Field.sheltered)>0||f(Field.blocked)>0){put(Channel.low,0);put(Channel.lowFor,0);return;}
  const px=f(Field.px),pz=f(Field.pz),head=top()+ridge(px,pz);let low=true;
  if(height(px+(12),pz+(0))+1.2>=head||height(px+(8.485281374238571),pz+(8.485281374238571))+1.2>=head||height(px+(0),pz+(12))+1.2>=head||height(px+(-8.485281374238571),pz+(8.485281374238571))+1.2>=head||height(px+(-12),pz+(0))+1.2>=head||height(px+(-8.485281374238571),pz+(-8.485281374238571))+1.2>=head||height(px+(0),pz+(-12))+1.2>=head||height(px+(8.485281374238571),pz+(-8.485281374238571))+1.2>=head||height(px+(30),pz+(0))+1.2>=head||height(px+(21.213203435596427),pz+(21.213203435596427))+1.2>=head||height(px+(0),pz+(30))+1.2>=head||height(px+(-21.213203435596427),pz+(21.213203435596427))+1.2>=head||height(px+(-30),pz+(0))+1.2>=head||height(px+(-21.213203435596427),pz+(-21.213203435596427))+1.2>=head||height(px+(0),pz+(-30))+1.2>=head||height(px+(21.213203435596427),pz+(-21.213203435596427))+1.2>=head)low=false;
  if(f(Field.count)>0&&Read.field(1,Field.top)>head)low=false;
  put(Channel.low,low?1:0);put(Channel.lowFor,low?f(Field.lowFor)+f(Field.dt):0);
 }else if(signal==Signal.tick){
  if(f(Field.armed)>0){const t=f(Field.pendingT)-f(Field.dt);put(Channel.pendingT,t);put(Channel.land,t<=0?1:0);}
  else if(f(Field.ready)>0){
   if(f(Field.storm)>0)put(Channel.arm,1);
   else{const gust=f(Field.gust)>0;put(Channel.distance,gust?500+Read.random()*700:1200+Read.random()*1800);put(Channel.flash,gust?.55:.3);put(Channel.bearing,f(Field.bearing)+(Read.random()*1.2-.6));}
  }
 }else if(signal==Signal.hit){
  const d=Math.hypot(f(Field.x)-f(Field.px),f(Field.z)-f(Field.pz));put(Channel.distance,d);put(Channel.bearing,Math.atan2(f(Field.z)-f(Field.pz),f(Field.x)-f(Field.px)));
  put(Channel.damage,f(Field.sheltered)==0&&d<=4&&Math.abs(f(Field.y)-f(Field.py))<6?60:0);
 }else if(signal==Signal.wind){
  const hold=f(Field.titanHeld)>0&&f(Field.storm)>0&&f(Field.phaseLen)-f(Field.phaseT)<30;
  put(Channel.phaseT,hold?f(Field.phaseLen)-30:f(Field.phaseT));
  const speed=f(Field.windSpeed),asking=speed>=0;
  put(Channel.asked,asking?speed:-1);
  if(asking||f(Field.asked)>=0){
   put(Channel.speed,asking?speed:f(Field.calmSpeed));
   put(Channel.dir,asking&&f(Field.building)==0&&f(Field.after)==0?Math.PI/4:f(Field.calmDir));
   put(Channel.gustiness,asking?f(Field.windGustiness):f(Field.calmGust));
   put(Channel.seconds,asking?(f(Field.gust)>0?6:10):30);
  }
 }
}
