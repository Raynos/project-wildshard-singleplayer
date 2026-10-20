import { Signal, Field, Channel, Read, List, Do } from './generated/nalatiAdmission';
@inline function get(field:i32):f64 { return Read.field(0,field); }
// Bounded direction approximation; libc atan2 exceeds the return fuel budget.
@inline function heading(y:f64,x:f64):f64 {
  if(x==0&&y==0)return 0;
  const a=Math.abs(y)+.0000001,right=x>=0;
  const r=right?(x-a)/(x+a):(x+a)/(a-x);
  const theta=(right?Math.PI/4:Math.PI*3/4)+(.1963*r*r-.9817)*r;
  return y<0?-theta:theta;
}
@inline function distance2(x:f64,z:f64):f64{return Math.sqrt(x*x+z*z);}
// Synchronous admission/restore events and bounded 10 Hz sheepdog decisions.
// The native owner retains bodies, clocks and both original random streams.
@inline export function onSignal(signal:i32,value:f64,source:i32):void {
  if(signal==Signal.argymaqTick) {
    const dt=get(Field.dt),state=get(Field.state);
    let lane=get(Field.laneT),run=get(Field.runT);
    if(state!=get(Field.previousState)) {
      if(state==1){lane=1.2;Do.channel(Channel.capture,1);Do.channel(Channel.signature,1);}
      if(state==2)lane=Math.max(lane,1.4);
    }
    if(lane>0)lane-=dt;
    if(get(Field.phase2)!=0&&get(Field.engaged)!=0&&state!=3) {
      run-=dt;if(run<=0){run=8;Do.channel(Channel.lead,1);}
    }
    Do.channel(Channel.laneT,lane);Do.channel(Channel.runT,run);
    Do.channel(Channel.adopt,get(Field.bonded)!=0&&get(Field.same)==0?1:0);
    Do.channel(Channel.fraction,Math.max(0,(get(Field.health)-.25)/.75));
  } else if(signal==Signal.eliteRule) {
    const rule=get(Field.rule),phase=get(Field.phase);
    Do.channel(Channel.accept,rule==0||rule==1&&get(Field.storm)!=0||rule==2&&phase==2||rule==3&&phase>=1?1:0);
  } else if(signal==Signal.eliteAux) {
    Do.channel(Channel.accept,get(Field.kills)>=5?1:0);
    Do.channel(Channel.count,get(Field.engaged)!=0&&get(Field.line)==0?3:0);
  } else if(signal==Signal.eliteDamage) {
    Do.channel(Channel.scale,get(Field.mode)==4&&get(Field.distance)<3.8?3:1);
  } else if(signal==Signal.speed) {
    const dt=get(Field.dt),dx=get(Field.x)-get(Field.px),dz=get(Field.z)-get(Field.pz),old=get(Field.speed);
    const instant=dt>0?Math.min(Math.sqrt(dx*dx+dz*dz)/dt,14):old;
    Do.channel(Channel.speed,old+(instant-old)*Math.min(1,dt*6));
  } else if(signal==Signal.whistle) {
    const dx=get(Field.x)-get(Field.px),dz=get(Field.z)-get(Field.pz);
    Do.channel(Channel.accept,dx*dx+dz*dz<900?1:0);
    Do.channel(Channel.awareness,Math.min(1,get(Field.awareness)+.3));
  } else if(signal==Signal.scare) {
    const dx=get(Field.x)-get(Field.px),dz=get(Field.z)-get(Field.pz),r=get(Field.radius);
    Do.channel(Channel.accept,dx*dx+dz*dz<r*r?1:0);
  } else if(signal==Signal.firstRaid) {
    Do.channel(Channel.time,150+Read.random()*90);Read.random();
  } else if(signal==Signal.damage) {
    const floor=get(Field.owned)!=0?.1:get(Field.stallion)!=0?.2:0;
    Do.channel(Channel.scale,floor==0?1:Math.max(0,Math.min(1,(get(Field.health)-floor)/(1-floor))));
  } else if(signal==Signal.dispatch) {
    Do.channel(Channel.state,get(Field.elite)!=0?1:get(Field.wolf)!=0?2:get(Field.dog)!=0?3:get(Field.held)==0?4:0);
  } else if(signal==Signal.spot) {
    const angle=(Math.PI*2)*Read.random(),radius=Math.sqrt(Read.random())*get(Field.radius);
    if(Read.radial(angle,radius)!=2)unreachable();
    Do.channel(Channel.x,get(Field.x)+List.at(1));Do.channel(Channel.z,get(Field.z)+List.at(0));
  } else if(signal==Signal.accept) {
    Do.channel(Channel.accept,Math.abs(get(Field.x))<=235&&Math.abs(get(Field.z))<=235&&get(Field.normal)>=.78
      &&get(Field.height)>=get(Field.water)+.3&&get(Field.wet)==0&&get(Field.clash)==0?1:0);
  } else if(signal==Signal.begin) {
    Do.channel(Channel.attempts,40);
  } else if(signal==Signal.yaw) {
    Do.channel(Channel.yaw,(Math.PI*2)*Read.random());
  } else if(signal==Signal.packPlan) {
    Do.channel(Channel.radius,8);
  } else if(signal==Signal.dogPlan) {
    Do.channel(Channel.x,get(Field.x)+14);Do.channel(Channel.z,get(Field.z));Do.channel(Channel.radius,4);
  } else if(signal==Signal.herdStart) {
    Do.channel(Channel.start,Math.floor(Read.random()*get(Field.coats)));
    Do.channel(Channel.count,get(Field.mares)+get(Field.foals)+get(Field.stallion));
  } else if(signal==Signal.herdMember) {
    const index=get(Field.index),mares=get(Field.mares),foals=get(Field.foals),coats=get(Field.coats);
    if(index<mares) {
      Do.channel(Channel.variant,(get(Field.start)+index)%coats);Do.channel(Channel.radius,11);Do.channel(Channel.place,0);
    } else if(index<mares+foals) {
      const foal=index-mares;
      Do.channel(Channel.variant,coats+foal%2);Do.channel(Channel.radius,3);Do.channel(Channel.place,1);
      Do.channel(Channel.mother,foal%Math.max(1,mares));
    } else {
      Do.channel(Channel.variant,coats+2);Do.channel(Channel.radius,4);Do.channel(Channel.place,2);
      Do.channel(Channel.x,16);Do.channel(Channel.z,4);Do.channel(Channel.yaw,0);
    }
  } else if(signal==Signal.foal) {
    Do.channel(Channel.x,-2+4*Read.random());Do.channel(Channel.z,-2+4*Read.random());
  } else if(signal==Signal.pack) {
    Do.channel(Channel.accept,(get(Field.elite)!=0||get(Field.packs)<2)&&get(Field.groups)<8
      &&get(Field.variants)==(get(Field.elite)!=0?5:3)&&get(Field.bodies)+get(Field.variants)<=64?1:0);
  } else if(signal==Signal.bond) {
    Do.channel(Channel.accept,get(Field.bonds)==0&&Math.abs(get(Field.x))<=250&&Math.abs(get(Field.z))<=250?1:0);
    Do.channel(Channel.scale,get(Field.elite)!=0?1.3:0);
  } else if(signal==Signal.restoreBounds) {
    Do.channel(Channel.accept,get(Field.packs)<=2&&get(Field.groups)<=8&&get(Field.elites)<=64
      &&get(Field.retired)<=64&&get(Field.dormant)<=64&&get(Field.unique)!=0?1:0);
  } else if(signal==Signal.restorePack) {
    Do.channel(Channel.accept,get(Field.herd)==get(Field.expected)&&get(Field.variants)==(get(Field.elite)!=0?5:3)?1:0);
  } else if(signal==Signal.restoreBody) {
    Do.channel(Channel.accept,get(Field.id)>=get(Field.initial)&&get(Field.id)<get(Field.nextId)&&get(Field.retired)==0?1:0);
  } else if(signal==Signal.restoreBond) {
    Do.channel(Channel.accept,get(Field.variant)!=0?1:0);
  } else if(signal==Signal.dog) {
    const px=get(Field.px),pz=get(Field.pz),cx=get(Field.cx),cz=get(Field.cz),dt=get(Field.dt);
    let bark=get(Field.bark)-dt,rest=get(Field.rest),snarl=0.0,low=0.0;
    let tx=cx,tz=cz,yaw=0.0,speed=0.0,turn=3.0,path=-1.0,state=0.0,look=.5;
    let lx=cx,ly=get(Field.py),lz=cz,emit=0.0;
    if(get(Field.wolf)!=0&&get(Field.distance)<35) {
      tx=(get(Field.wx)+cx)/2;tz=(get(Field.wz)+cz)/2;
      path=.8;speed=distance2(tx-px,tz-pz)>3?7.5:0;turn=5;state=1;snarl=1;low=.4;
      lx=get(Field.wx);ly=get(Field.wy);lz=get(Field.wz);look=1;
      if(bark<=0){bark=.5+Read.random()*.6;emit=1;}
    } else if(get(Field.straggler)!=0) {
      const sx=get(Field.sx),sz=get(Field.sz),ox=sx-cx,oz=sz-cz,length=distance2(ox,oz),od=length==0?1:length;
      tx=sx+ox/od*3.5;tz=sz+oz/od*3.5;
      const bd=distance2(tx-px,tz-pz);low=.8;state=2;
      if(bd>1){path=bd>4?1:0;yaw=heading(tx-px,tz-pz);speed=bd>8?7.5:3;turn=5;}
      else{yaw=heading(-ox,-oz);turn=3;}
      lx=sx;ly=get(Field.sy);lz=sz;look=.8;
    } else {
      rest-=dt;
      if(rest>0){yaw=heading(cx-px,cz-pz);turn=2;}
      else {
        if(rest< -20&&Read.random()<.02)rest=6+Read.random()*8;
        const angle=heading(px-cx,pz-cz)+.35;
        if(Read.radial(angle,16)!=2)unreachable();
        tx=cx+List.at(0);tz=cz+List.at(1);path=2;speed=3.4;state=3;
        lx=get(Field.playerX);ly=get(Field.playerY);lz=get(Field.playerZ);
        look=Math.sqrt((lx-px)*(lx-px)+(ly-get(Field.py))*(ly-get(Field.py))+(lz-pz)*(lz-pz))<6?.8:0;
      }
    }
    Do.channel(Channel.bark,bark);if(state==0||state==3)Do.channel(Channel.rest,rest);Do.channel(Channel.snarl,snarl);Do.channel(Channel.low,low);
    Do.channel(Channel.x,tx);Do.channel(Channel.z,tz);Do.channel(Channel.yaw,yaw);Do.channel(Channel.speed,speed);
    Do.channel(Channel.turn,turn);Do.channel(Channel.path,path);Do.channel(Channel.state,state);
    Do.channel(Channel.lookX,lx);Do.channel(Channel.lookY,ly);Do.channel(Channel.lookZ,lz);Do.channel(Channel.look,look);Do.channel(Channel.emit,emit);
  }
}
