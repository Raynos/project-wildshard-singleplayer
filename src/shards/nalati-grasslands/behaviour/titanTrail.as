import { Signal,Field,Channel,Read,Do } from './generated/nalatiTitanCombined';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function put(id:i32,value:f64):void{Do.channel(id,value);}
// Read each retained sample once; keep exact oldest-first positions.
@inline export function trailEntry(signal:i32):void{
 if(signal==Signal.arenaTrailPick){
  const index=f(Field.index),count=f(Field.count);
  if(index>=0&&index<count){
   if(index==0){put(Channel.x,f(Field.trailX0));put(Channel.z,f(Field.trailZ0));return;}
   if(index==1){put(Channel.x,f(Field.trailX1));put(Channel.z,f(Field.trailZ1));return;}
   if(index==2){put(Channel.x,f(Field.trailX2));put(Channel.z,f(Field.trailZ2));return;}
   if(index==3){put(Channel.x,f(Field.trailX3));put(Channel.z,f(Field.trailZ3));return;}
   if(index==4){put(Channel.x,f(Field.trailX4));put(Channel.z,f(Field.trailZ4));return;}
   if(index==5){put(Channel.x,f(Field.trailX5));put(Channel.z,f(Field.trailZ5));return;}
   if(index==6){put(Channel.x,f(Field.trailX6));put(Channel.z,f(Field.trailZ6));return;}
   if(index==7){put(Channel.x,f(Field.trailX7));put(Channel.z,f(Field.trailZ7));return;}
   if(index==8){put(Channel.x,f(Field.trailX8));put(Channel.z,f(Field.trailZ8));return;}
   if(index==9){put(Channel.x,f(Field.trailX9));put(Channel.z,f(Field.trailZ9));return;}
   if(index==10){put(Channel.x,f(Field.trailX10));put(Channel.z,f(Field.trailZ10));return;}
   if(index==11){put(Channel.x,f(Field.trailX11));put(Channel.z,f(Field.trailZ11));return;}
  }
  put(Channel.x,f(Field.x));put(Channel.z,f(Field.z));return;
 }
 const elapsed=f(Field.elapsed)+f(Field.dt);if(elapsed+1e-9<f(Field.every)){put(Channel.elapsed,elapsed);return;}
 const capacity=f(Field.capacity),count=f(Field.count),full=count>=capacity,x=f(Field.x),z=f(Field.z);
 put(Channel.elapsed,0);put(Channel.count,Math.min(capacity,count+1));
 const replace0=0<capacity&&(full?0==capacity-1:count==0);
 put(Channel.trailX0,replace0?x:f(full&&0<capacity?Field.trailX1:Field.trailX0));
 put(Channel.trailZ0,replace0?z:f(full&&0<capacity?Field.trailZ1:Field.trailZ0));
 const replace1=1<capacity&&(full?1==capacity-1:count==1);
 put(Channel.trailX1,replace1?x:f(full&&1<capacity?Field.trailX2:Field.trailX1));
 put(Channel.trailZ1,replace1?z:f(full&&1<capacity?Field.trailZ2:Field.trailZ1));
 const replace2=2<capacity&&(full?2==capacity-1:count==2);
 put(Channel.trailX2,replace2?x:f(full&&2<capacity?Field.trailX3:Field.trailX2));
 put(Channel.trailZ2,replace2?z:f(full&&2<capacity?Field.trailZ3:Field.trailZ2));
 const replace3=3<capacity&&(full?3==capacity-1:count==3);
 put(Channel.trailX3,replace3?x:f(full&&3<capacity?Field.trailX4:Field.trailX3));
 put(Channel.trailZ3,replace3?z:f(full&&3<capacity?Field.trailZ4:Field.trailZ3));
 const replace4=4<capacity&&(full?4==capacity-1:count==4);
 put(Channel.trailX4,replace4?x:f(full&&4<capacity?Field.trailX5:Field.trailX4));
 put(Channel.trailZ4,replace4?z:f(full&&4<capacity?Field.trailZ5:Field.trailZ4));
 const replace5=5<capacity&&(full?5==capacity-1:count==5);
 put(Channel.trailX5,replace5?x:f(full&&5<capacity?Field.trailX6:Field.trailX5));
 put(Channel.trailZ5,replace5?z:f(full&&5<capacity?Field.trailZ6:Field.trailZ5));
 const replace6=6<capacity&&(full?6==capacity-1:count==6);
 put(Channel.trailX6,replace6?x:f(full&&6<capacity?Field.trailX7:Field.trailX6));
 put(Channel.trailZ6,replace6?z:f(full&&6<capacity?Field.trailZ7:Field.trailZ6));
 const replace7=7<capacity&&(full?7==capacity-1:count==7);
 put(Channel.trailX7,replace7?x:f(full&&7<capacity?Field.trailX8:Field.trailX7));
 put(Channel.trailZ7,replace7?z:f(full&&7<capacity?Field.trailZ8:Field.trailZ7));
 const replace8=8<capacity&&(full?8==capacity-1:count==8);
 put(Channel.trailX8,replace8?x:f(full&&8<capacity?Field.trailX9:Field.trailX8));
 put(Channel.trailZ8,replace8?z:f(full&&8<capacity?Field.trailZ9:Field.trailZ8));
 const replace9=9<capacity&&(full?9==capacity-1:count==9);
 put(Channel.trailX9,replace9?x:f(full&&9<capacity?Field.trailX10:Field.trailX9));
 put(Channel.trailZ9,replace9?z:f(full&&9<capacity?Field.trailZ10:Field.trailZ9));
 const replace10=10<capacity&&(full?10==capacity-1:count==10);
 put(Channel.trailX10,replace10?x:f(full&&10<capacity?Field.trailX11:Field.trailX10));
 put(Channel.trailZ10,replace10?z:f(full&&10<capacity?Field.trailZ11:Field.trailZ10));
 const replace11=11<capacity&&(full?11==capacity-1:count==11);
 put(Channel.trailX11,replace11?x:f(full&&11<capacity?Field.trailX11:Field.trailX11));
 put(Channel.trailZ11,replace11?z:f(full&&11<capacity?Field.trailZ11:Field.trailZ11));
}
