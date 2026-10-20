import { Signal, Field, Channel, Params, Read, List, Do } from './generated/nalatiWeather';
@inline function f(id:i32):f64{return Read.field(0,id);}
// Per-request output scratch only; ReturnProgram rewinds it before every call.
const RESULTS:usize=memory.data(96,8);
let resultCount:i32=0;
@inline function put(id:i32,value:f64):void {
 assert(resultCount<6);const at=RESULTS+usize(resultCount)*16;
 store<i32>(at,id);store<f64>(at+8,value);resultCount++;
}

@inline function angle(y: f64, x: f64): f64 {
  const a = Math.abs(y) + .0000001, right = x >= 0;
  const r = right ? (x - a) / (x + a) : (x + a) / (a - x);
  const theta = (right ? Math.PI / 4 : Math.PI * 3 / 4) + (.1963 * r * r - .9817) * r;
  return y < 0 ? -theta : theta;
}
@inline function length(x: f64, z: f64): f64 { return Math.sqrt(x * x + z * z); }
@inline function pathAt(s: f64, axis: i32): f64 {
  const d = f(Field.d4), total = d * 4, u = s - Math.floor(s / total) * total, q = i32(u / d);
  const a = q % 2 == 0 ? u - q * d : d - (u - q * d);
  let lo = 0.0, hi = f(Field.d1), x0 = f(Field.x0), x1 = f(Field.x1), z0 = 0.0, z1 = f(Field.z1);
  if (a > f(Field.d3)) {lo = f(Field.d3); hi = d; x0 = f(Field.x3); x1 = 0; z0 = f(Field.z3); z1 = f(Field.z4);}
  else if (a > f(Field.d2)) {lo = f(Field.d2); hi = f(Field.d3); x0 = f(Field.x2); x1 = f(Field.x3); z0 = f(Field.z2); z1 = f(Field.z3);}
  else if (a > f(Field.d1)) {lo = f(Field.d1); hi = f(Field.d2); x0 = f(Field.x1); x1 = f(Field.x2); z0 = f(Field.z1); z1 = f(Field.z2);}
  const t = (a - lo) / (hi - lo);
  return axis == 0 ? (x0 + (x1 - x0) * t) * (q == 1 || q == 2 ? -1 : 1)
    : f(Field.center) + (z0 + (z1 - z0) * t) * (q >= 2 ? -1 : 1);
}
@inline function nearest(x: f64, z: f64): f64 {
  return angle((z - f(Field.center)) / f(Field.z4), x / f(Field.x0)) / (Math.PI * 2) * f(Field.d4) * 4;
}

// Native bindings dispatch at no more than ten Hz.

@inline function height(x:f64,z:f64):f64{Read.groundHeight(Math.max(-250,Math.min(250,x)),Math.max(-250,Math.min(250,z)));return List.at(0);}
@inline function terrainRidge(x:f64,z:f64):f64 {
 const a=11.052731928034621,b=4.673020107703806;
 const mean=height(x+a,z+b)+height(x-b,z+a)+height(x-a,z-b)+height(x+b,z-a);
 return height(x,z)-mean/4>1.5?1:0;
}
@inline function top():f64{return f(Field.py)+(f(Field.crouched)>0?1.05:1.75)+(f(Field.mounted)>0?1.5:0);}
// Requests are dispatched by the world adapter at no more than ten Hz.

@inline function decide(signal:i32,value:f64,source:i32):void {
if (signal == Signal.lineStart) {
    const at = f(Field.at), s = at < 0 ? nearest(-f(Field.px), f(Field.center) * 2 - f(Field.pz)) : at;
    put(Channel.s, s); put(Channel.dir, Read.random() < .5 ? 1 : -1);
  } else if (signal == Signal.lineSlot) {
    const s = f(Field.s) - f(Field.slot) * 11, ax = pathAt(s, 0), az = pathAt(s, 1);
    put(Channel.x, ax); put(Channel.z, az); put(Channel.yaw, angle(-(az - f(Field.center)) * f(Field.x0) / f(Field.z4), ax * f(Field.z4) / f(Field.x0)));
  } else if (signal == Signal.line) {
    const dt = f(Field.dt), px = f(Field.px), pz = f(Field.pz), ax = f(Field.ax), az = f(Field.az);
    const distance = length(px - ax, pz - az), plateau = f(Field.py) > 18;
    let mode = f(Field.mode), s = f(Field.s), theta = f(Field.theta), t = f(Field.t);
    if (mode == 0 && distance < 70 && plateau) { mode = 1; t = 0; theta = angle(ax - px, az - pz); }
    else if (mode == 1 && (distance > 115 || !plateau)) { mode = 0; s = nearest(ax, az); }
    if (mode == 0) s += dt * f(Field.canter) * .95;
    else { t += dt; theta += f(Field.dir) * dt * 11.5 / 34; }
    put(Channel.mode, mode); put(Channel.s, s); put(Channel.theta, theta); put(Channel.t, t);
  } else if (signal == Signal.target) {
    const slot = f(Field.slot); let tx = 0.0, tz = 0.0, speed = 11.5, turn = 2.2;
    if (f(Field.mode) == 0) {
      const s = f(Field.s) - slot * 11;
      const ax = pathAt(s, 0), az = pathAt(s, 1), dx = -(az - f(Field.center)) * f(Field.x0) / f(Field.z4), dz = ax * f(Field.z4) / f(Field.x0);
      const norm = Math.max(.001, length(dx, dz)); tx = ax + dx / norm * 10; tz = az + dz / norm * 10;
      speed = length(ax - f(Field.ax), az - f(Field.az)) > 6 ? 11.5 : f(Field.canter);
    } else {
      const dir = f(Field.dir), theta = f(Field.theta) - dir * slot * (11.0 / 34) + dir * .4;
      Read.radial(f(Field.t) * .4 + slot, 5); const radius = 34 + List.at(0);
      Read.radial(theta, radius); tx = f(Field.px) + List.at(0); tz = f(Field.pz) + List.at(1); turn = 2.8;
    }
    put(Channel.x, tx); put(Channel.z, tz); put(Channel.speed, speed); put(Channel.turn, turn);
  }
if(resultCount>0)return;
if(signal==Signal.warriorCycle){
 const phase=f(Field.kind),previous=f(Field.phase),wake=phase==1&&previous!=1;
 put(Channel.phase,phase);put(Channel.spawn,wake?1:0);put(Channel.dissolve,phase==0&&previous!=0?1:0);
 put(Channel.t,f(Field.t)+(wake?1:0));
} else if(signal==Signal.patrolFire){
 const t=f(Field.fireT)-f(Field.dt),d=f(Field.distance);
 put(Channel.fireT,t);put(Channel.shoot,t<=0&&f(Field.quiet)==0&&d<62&&d>6&&f(Field.engaged)==1&&f(Field.dead)==0&&f(Field.dying)==0&&f(Field.hidden)==0?1:0);
} else if(signal==Signal.patrolCycle){
 const phase=f(Field.night),before=f(Field.phase),night=phase==1;
 let respawn=f(Field.respawn),kills=f(Field.kills);
 if(before<0){if(night)respawn=.5;}
 else if(phase!=before){if(night){kills=0;if(f(Field.hold)==0&&f(Field.living)==0)respawn=2;}else respawn=-1;}
 const enabled=respawn>=0&&f(Field.hold)==0;if(enabled)respawn-=f(Field.dt);
 put(Channel.respawn,respawn);put(Channel.spawn,enabled&&respawn<0&&night?1:0);
 put(Channel.phase,phase);put(Channel.kills,kills);put(Channel.dissolve,phase==0&&phase!=before?1:0);
} else if(signal==Signal.patrolEmpty){
 put(Channel.kills,f(Field.kills)+f(Field.killed));
 put(Channel.respawn,f(Field.empty)>0&&f(Field.living)==0&&f(Field.night)==1?60:f(Field.respawn));
} else if(signal==Signal.patrolDissolve){
 put(Channel.dying,f(Field.dying)==0?.001:f(Field.dying));put(Channel.fadeTarget,0);
}
if (signal == Signal.roster) {
    let t = f(Field.respawn); const enabled = t >= 0 && f(Field.hold) == 0;
    if (enabled) t -= f(Field.dt);
    put(Channel.respawn, t); put(Channel.spawn, enabled && t < 0 && f(Field.night) == 1 ? 1 : 0);
  } else if (signal == Signal.rider) {
    const dt = f(Field.dt), killed = f(Field.alive) == 0 && f(Field.dead) == 0;
    let dying = f(Field.dying), fade = f(Field.fade), target = f(Field.fadeTarget);
    if (killed) { dying = Math.max(dying, .001); target = 0; }
    fade += (target - fade) * Math.min(1, dt * (target > fade ? 1.4 : 2.2));
    if (dying > 0) dying += dt;
    put(Channel.killed, killed ? 1 : 0); put(Channel.dead, killed ? 1 : f(Field.dead));
    put(Channel.dying, dying); put(Channel.fade, fade); put(Channel.fadeTarget, target); put(Channel.retire, dying >= 1.3 ? 1 : 0);
  } else if (signal == Signal.tonight) {
    const count = i32(f(Field.count)), night = i32(Math.max(0,f(Field.night))), slot = i32(f(Field.slot));
    if (count <= 0) return;
    if (slot < 4) put(Channel.index, (night * 2 + slot * 2 + (slot >= 3 ? 1 : 0)) % (count < 9 ? count : 9));
    else if (count > 9) put(Channel.index, 9 + night % (count - 9));
  } else if (signal == Signal.warrior) {
    const dead = f(Field.alive) == 0, t = f(Field.t) + (dead ? f(Field.dt) : 0);
    put(Channel.broken, dead && f(Field.t) == 0 ? 1 : 0); put(Channel.t, t);
    put(Channel.retire, (dead && t > 3.2) || f(Field.gone) == 1 ? 1 : 0);
    put(Channel.statue, f(Field.gone) == 1 ? 1 : 0);
  } else if (signal == Signal.fire) {
    const t = f(Field.fireT) - f(Field.dt), d = f(Field.distance);
    put(Channel.fireT, t); put(Channel.shoot, t <= 0 && f(Field.quiet) == 0 && d < 62 && d > 6 && f(Field.engaged) == 1 ? 1 : 0);
  } else if (signal == Signal.retry) {
    put(Channel.fireT, (f(Field.first) == 1 ? 2 : 3) + Read.random() * (f(Field.first) == 1 ? 2.5 : 1.8));
  }
if(resultCount>0)return;
if (signal == Signal.aim) {
    const x = f(Field.x), y = f(Field.y), z = f(Field.z), t = length(f(Field.px) - x, f(Field.pz) - z) / 34;
    const dx = f(Field.px) + f(Field.vx) * t * .8 - x, dz = f(Field.pz) + f(Field.vz) * t * .8 - z, dy = f(Field.py) + 1.2 - y;
    const h = length(dx, dz), v2 = 1156.0, disc = v2 * v2 - 5 * (5 * h * h + 2 * dy * v2);
    const elevation = disc >= 0 ? angle(v2 - Math.sqrt(disc), 5 * Math.max(h, .001)) : Math.PI / 4;
    const spread = 1.4 * Math.PI / 180, yaw = angle(dx, dz) + (Read.random() - .5) * spread * 2, pitch = elevation + (Read.random() - .5) * spread;
    Read.radial(pitch, 34); const dyOut = List.at(0), horizontal = List.at(1);
    Read.radial(yaw, horizontal); put(Channel.dx, List.at(0)); put(Channel.dy, dyOut); put(Channel.dz, List.at(1));
  }
if(signal==Signal.arm){
  const hunt=f(Field.lowFor)>3&&Read.random()<.45,angle=hunt?0:Read.random()*Math.PI*2,d=hunt?0:40+Read.random()*190;
  Read.radial(angle,d);const dx=List.at(1),dz=List.at(0);put(Channel.x,f(Field.px)+dx);put(Channel.z,f(Field.pz)+dz);put(Channel.radius,hunt?30:35);
 }else if(signal==Signal.pick){
  const cx=f(Field.cx),cz=f(Field.cz),r=f(Field.radius),first=f(Field.first)>0;
  let x=f(Field.bestX),z=f(Field.bestZ),y=f(Field.bestY),kind=f(Field.bestKind),index=f(Field.bestIndex),score=f(Field.bestScore);
  if(first){x=cx;z=cz;y=height(cx,cz);kind=0;index=-1;score=y+terrainRidge(cx,cz);}
  const scan=f(Field.scan);
  if(scan>=0){const a=scan*Math.PI/4;Read.radial(a,r*.6);const dx=List.at(1),dz=List.at(0),tx=cx+dx,tz=cz+dz,ty=height(tx,tz),s=ty+terrainRidge(tx,tz);if(s>score){x=tx;z=tz;y=ty;score=s;kind=0;index=-1;}}
  if(f(Field.count)>0){
   const tx=Read.field(1,Field.x),tz=Read.field(1,Field.z),ty=Read.field(1,Field.top),s=ty+terrainRidge(tx,tz);
   if(s>score){x=tx;z=tz;y=ty;score=s;kind=Read.field(1,Field.kind);index=Read.field(1,Field.index);}
  }
  if(first){const px=f(Field.px),pz=f(Field.pz),py=top(),ps=py+terrainRidge(px,pz);
  if(f(Field.sheltered)==0&&length(px-cx,pz-cz)<=r&&ps>score){x=px;z=pz;y=py;kind=3;index=-1;score=ps;}}
  put(Channel.x,x);put(Channel.y,y);put(Channel.z,z);put(Channel.kind,kind);put(Channel.index,index);put(Channel.score,score);
 }else if(signal==Signal.low){
  if(f(Field.active)==0||f(Field.sheltered)>0||f(Field.blocked)>0){put(Channel.low,0);put(Channel.lowFor,0);return;}
  const px=f(Field.px),pz=f(Field.pz),head=top()+terrainRidge(px,pz);let low=true;
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
  const d=length(f(Field.x)-f(Field.px),f(Field.z)-f(Field.pz));put(Channel.distance,d);put(Channel.bearing,angle(f(Field.z)-f(Field.pz),f(Field.x)-f(Field.px)));
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

@inline export function onSignal(signal:i32,value:f64,source:i32):void {
 resultCount=0;decide(signal,value,source);
 if(resultCount>0)Do.channel(load<i32>(RESULTS+0),load<f64>(RESULTS+8));
 if(resultCount>1)Do.channel(load<i32>(RESULTS+16),load<f64>(RESULTS+24));
 if(resultCount>2)Do.channel(load<i32>(RESULTS+32),load<f64>(RESULTS+40));
 if(resultCount>3)Do.channel(load<i32>(RESULTS+48),load<f64>(RESULTS+56));
 if(resultCount>4)Do.channel(load<i32>(RESULTS+64),load<f64>(RESULTS+72));
 if(resultCount>5)Do.channel(load<i32>(RESULTS+80),load<f64>(RESULTS+88));
}
