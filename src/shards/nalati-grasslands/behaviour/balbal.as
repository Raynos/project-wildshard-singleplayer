import { Signal, Field, Channel, Read, Do } from './generated/nalatiBalbal';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function put(id:i32,value:f64):void{Do.channel(id,value);}
export function onSignal(signal:i32,value:f64,source:i32):void {
  if(signal==Signal.damage){
    const open=f(Field.open)==1?1.25:1;
    put(Channel.damage,f(Field.field)==1&&f(Field.rise)<.6?.25:f(Field.range)>4.2?.5*open:f(Field.piercing)==1?(f(Field.crack)==1?2.5:1)*open:1.5*open);return;
  }
  const dt=f(Field.dt),field=f(Field.field)==1,px=f(Field.px),py=f(Field.py),pz=f(Field.pz),ay=f(Field.ay),yaw0=f(Field.yaw);
  let x=f(Field.x),z=f(Field.z),st=f(Field.st),t=f(Field.t)+dt,cd=Math.max(0,f(Field.cd)-dt),rise=f(Field.rise),emerge=f(Field.emerge),hit=f(Field.hit);
  let sound=0.0,start=0.0,cancel=0.0,strike=0.0,gone=f(Field.gone),slam=f(Field.slamT),state=f(Field.state),look=1.0,path=0.0;
  let yaw=yaw0,speed=0.0,turn=0.0,motion=0.0;
  if(f(Field.init)!=1){st=field?0:6;t=dt;cd=Math.max(0,1.2-dt);emerge=field?1:0;state=0;if(field)sound=1;}
  const dx=px-x,dz=pz-z,d=Math.sqrt(dx*dx+dz*dz),toPlayer=f(Field.bearing),hx=f(Field.homeX),hz=f(Field.homeZ);
  const fromHome=Math.sqrt((px-hx)*(px-hx)+(pz-hz)*(pz-hz)),toHome=Math.sqrt((hx-x)*(hx-x)+(hz-z)*(hz-z)),homeDir=f(Field.homeBearing),high=Math.abs(py-ay)>8,calm=f(Field.calm)==1,dawn=f(Field.dawn)==1;
  look=st==0||st==6||st==5?.3:1;
  const open=st==3&&f(Field.attack)>.58?1:0;
  if(field&&dawn&&st!=5&&st!=4&&st!=3){st=4;t=0;}
  if(st==0){rise=Math.min(1,rise+dt/3.4);motion=1;turn=.5;if(rise>=1){st=1;t=0;}}
  else if(st==6){const duration=f(Field.emergeT);emerge=Math.min(1,t/duration);motion=1;speed=.9;turn=.5;if(t>=duration){st=2;emerge=1;sound=1;}}
  else if(st==1){state=1;motion=1;yaw=f(Field.homeYaw);turn=1.2;if(!calm&&!high&&d<28&&(!field||fromHome<48)){st=2;t=0;sound=1;}}
  else if(st==2){
    state=2;
    if(field&&(fromHome>48||d>42||calm||high)){st=4;t=0;}
    else if(d<2.6&&cd<=0){st=3;hit=0;slam=0;start=1;motion=1;yaw=toPlayer;turn=3;sound=2;}
    else{motion=1;path=field?1:0;yaw=toPlayer;speed=d>2.6*.8?1.25:0;turn=2.2;}
  }else if(st==4){
    state=3;
    if(!field)st=2;
    else if(!dawn&&!calm&&!high&&d<28*.6&&fromHome<48)st=2;
    else if(toHome<.7){
      x=hx;z=hz;motion=1;yaw=f(Field.homeYaw);turn=1.5;
      const off=f(Field.homeOff);
      if(Math.abs(off)<.15){st=dawn?5:1;t=0;if(dawn)sound=1;}
    }else{motion=1;path=1;yaw=homeDir;speed=dawn?1.25*1.3:1.25;turn=2.2;}
  }else if(st==5){state=0;motion=1;yaw=f(Field.homeYaw);turn=1;rise=Math.max(0,rise-dt/3);if(rise<=0)gone=1;}
  if(f(Field.bounds)==1&&st!=6){x=Math.max(f(Field.minX),Math.min(f(Field.maxX),x));z=Math.max(f(Field.minZ),Math.min(f(Field.maxZ),z));}
  if(st==3&&start==0){
    state=4;const p=f(Field.attack);motion=1;yaw=toPlayer;speed=0;turn=p<.52*.8?1.1:0;
    if(p>=(.52+.58)/2&&hit!=1){
      hit=1;slam=1;const off=f(Field.hitOff);
      strike=d<=3.1*f(Field.scale)/1.18+.4&&Math.abs(off)<.96&&Math.abs(py-ay)<2.2?1:0;sound=3;
    }
    if(p>=1||p<0){cancel=1;st=2;cd=1.4;}
  }
  put(Channel.st,st);put(Channel.t,t);put(Channel.cd,cd);put(Channel.rise,rise);put(Channel.emerge,emerge);put(Channel.hit,hit);put(Channel.gone,gone);put(Channel.slamT,slam);put(Channel.open,open);
  put(Channel.x,x);put(Channel.z,z);put(Channel.yaw,yaw);put(Channel.speed,speed);put(Channel.turn,turn);put(Channel.motion,motion);put(Channel.path,path);
  put(Channel.state,state);put(Channel.look,look);put(Channel.sound,sound);put(Channel.start,start);put(Channel.cancel,cancel);put(Channel.strike,strike);put(Channel.damage,f(Field.dmg));
}
