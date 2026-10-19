import { Signal, Field, Channel, Read, Do } from './generated/nalatiTitanRules';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function put(id:i32,value:f64):void{Do.channel(id,value);}
// Event projections; retained state belongs to the native binding at <= 10 Hz.
export function onSignal(signal:i32,value:f64,source:i32):void {
if(signal==Signal.couple){
    let mask:i32=0,left:i32=0,aiming=false,index:i32=-1,hp=f(Field.hp),cd=f(Field.cd)-f(Field.dt);
    for(let i:i32=1;i<=i32(f(Field.count));i++){
      if(Read.field(i,Field.hit)==0){mask|=1<<(i-1);if(f(Field.invuln)==0)hp=Math.max(1,hp-f(Field.chip));continue;}
      left++;const mode=Read.field(i,Field.mode);if(mode==1||mode==2)aiming=true;if(mode==0&&index<0)index=i-1;
    }
    if(aiming||cd>0)index=-1;
    if(index>=0){
      const x=Read.field(index+1,Field.x),z=Read.field(index+1,Field.z),dx=f(Field.px)-x,dz=f(Field.pz)-z,l=Math.max(.00001,Math.sqrt(dx*dx+dz*dz));
      put(Channel.x0,x);put(Channel.z0,z);put(Channel.x1,f(Field.px)+dx/l*22);put(Channel.z1,f(Field.pz)+dz/l*22);cd=3+Read.random()*1.5;
    }
    put(Channel.mask,mask);put(Channel.left,left);put(Channel.hp,hp);put(Channel.cd,cd);put(Channel.index,index);
    put(Channel.broke,left==0?1:0);
  } else if(signal==Signal.heart){
    const phase=f(Field.phase),open=f(Field.fighting)>0&&f(Field.invuln)==0&&(phase==0?f(Field.mode)==3:phase==1?f(Field.broke)>0:true);
    const amount=f(Field.amount),hp=f(Field.hp);
    put(Channel.open,open?1:0);put(Channel.hp,open?Math.max(0,hp-amount*(amount>=f(Field.fullDraw)?f(Field.fullDrawMul):1)):hp);
  } else if(signal==Signal.boundary){
    const dx=f(Field.px)-f(Field.cx),dz=f(Field.pz)-f(Field.cz),distance=Math.sqrt(dx*dx+dz*dz),radius=f(Field.radius),armed=f(Field.armed)>0,mounted=f(Field.mounted)>0,storm=f(Field.storm)>0;
    const disarm=armed&&(!storm||distance>radius+30),wall=f(Field.engaged)>0&&f(Field.sealed)>0&&distance>radius-2.5&&!mounted;
    const cd=f(Field.wall)-f(Field.dt),k=distance>0?(radius-4)/distance:0;
    put(Channel.disarm,disarm?1:0);put(Channel.x,wall?f(Field.cx)+(f(Field.px)-f(Field.cx))*k:f(Field.px));put(Channel.z,wall?f(Field.cz)+(f(Field.pz)-f(Field.cz))*k:f(Field.pz));
    put(Channel.hurt,wall&&cd<=0?1:0);put(Channel.wall,wall&&cd<=0?1.2:cd);put(Channel.clear,f(Field.victory)>0&&f(Field.tied)>0?1:0);
    put(Channel.radius,f(Field.engaged)>0||(armed&&f(Field.tied)>0)?0:4.6);put(Channel.label,!mounted?1:!storm?2:0);
  } else if(signal==Signal.kingDoor){
    const dx=f(Field.px)-f(Field.ex),dz=f(Field.pz)-f(Field.ez),fx=-Math.sin(f(Field.facing)),fz=-Math.cos(f(Field.facing)),lz=-(dx*fx+dz*fz),lx=dx*fz-dz*fx;
    put(Channel.enter,lz>.8&&lz<3&&Math.abs(lx)<1.3&&Math.abs(f(Field.y)-f(Field.ey))<1.5?1:0);
    put(Channel.exit,f(Field.volume)==0?1:f(Field.corridor)>f(Field.land)-.7&&f(Field.engaged)==0?2:0);
    put(Channel.slow,f(Field.inside)>0&&f(Field.sand)>.12&&Math.abs(f(Field.floor)-(f(Field.cy)+f(Field.sand)))<.05?1:0);
  } else if(signal==Signal.riderDamage){
 const dx=f(Field.x)-f(Field.px),dz=f(Field.z)-f(Field.pz),melee=dx*dx+dz*dz<25*f(Field.radius)*f(Field.radius);
 put(Channel.alpha,melee?(f(Field.open)>0?3:1):.5);
}

}
