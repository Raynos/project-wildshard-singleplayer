import { Signal,Field,Channel,Read,Do } from './generated/nalatiTitanCombined';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function put(id:i32,value:f64):void{Do.channel(id,value);}
// The existing twelve samples remain oldest-first; no catch-up or quantization.
@inline export function trailEntry(signal:i32):void{
 if(signal==Signal.arenaTrailPick){
  const index=f(Field.index);
  if(index==0&&index<f(Field.count)){put(Channel.x,f(Field.trailX0));put(Channel.z,f(Field.trailZ0));return;}
  if(index==1&&index<f(Field.count)){put(Channel.x,f(Field.trailX1));put(Channel.z,f(Field.trailZ1));return;}
  if(index==2&&index<f(Field.count)){put(Channel.x,f(Field.trailX2));put(Channel.z,f(Field.trailZ2));return;}
  if(index==3&&index<f(Field.count)){put(Channel.x,f(Field.trailX3));put(Channel.z,f(Field.trailZ3));return;}
  if(index==4&&index<f(Field.count)){put(Channel.x,f(Field.trailX4));put(Channel.z,f(Field.trailZ4));return;}
  if(index==5&&index<f(Field.count)){put(Channel.x,f(Field.trailX5));put(Channel.z,f(Field.trailZ5));return;}
  if(index==6&&index<f(Field.count)){put(Channel.x,f(Field.trailX6));put(Channel.z,f(Field.trailZ6));return;}
  if(index==7&&index<f(Field.count)){put(Channel.x,f(Field.trailX7));put(Channel.z,f(Field.trailZ7));return;}
  if(index==8&&index<f(Field.count)){put(Channel.x,f(Field.trailX8));put(Channel.z,f(Field.trailZ8));return;}
  if(index==9&&index<f(Field.count)){put(Channel.x,f(Field.trailX9));put(Channel.z,f(Field.trailZ9));return;}
  if(index==10&&index<f(Field.count)){put(Channel.x,f(Field.trailX10));put(Channel.z,f(Field.trailZ10));return;}
  if(index==11&&index<f(Field.count)){put(Channel.x,f(Field.trailX11));put(Channel.z,f(Field.trailZ11));return;}
  put(Channel.x,f(Field.x));put(Channel.z,f(Field.z));return;
 }
 const elapsed=f(Field.elapsed)+f(Field.dt);if(elapsed+1e-9<f(Field.every)){put(Channel.elapsed,elapsed);return;}
 const capacity=f(Field.capacity),count=f(Field.count),full=count>=capacity;
 put(Channel.elapsed,0);put(Channel.count,Math.min(capacity,count+1));
 put(Channel.trailX0,0>=capacity?f(Field.trailX0):full?(0==capacity-1?f(Field.x):f(Field.trailX1)):count==0?f(Field.x):f(Field.trailX0));
 put(Channel.trailZ0,0>=capacity?f(Field.trailZ0):full?(0==capacity-1?f(Field.z):f(Field.trailZ1)):count==0?f(Field.z):f(Field.trailZ0));
 put(Channel.trailX1,1>=capacity?f(Field.trailX1):full?(1==capacity-1?f(Field.x):f(Field.trailX2)):count==1?f(Field.x):f(Field.trailX1));
 put(Channel.trailZ1,1>=capacity?f(Field.trailZ1):full?(1==capacity-1?f(Field.z):f(Field.trailZ2)):count==1?f(Field.z):f(Field.trailZ1));
 put(Channel.trailX2,2>=capacity?f(Field.trailX2):full?(2==capacity-1?f(Field.x):f(Field.trailX3)):count==2?f(Field.x):f(Field.trailX2));
 put(Channel.trailZ2,2>=capacity?f(Field.trailZ2):full?(2==capacity-1?f(Field.z):f(Field.trailZ3)):count==2?f(Field.z):f(Field.trailZ2));
 put(Channel.trailX3,3>=capacity?f(Field.trailX3):full?(3==capacity-1?f(Field.x):f(Field.trailX4)):count==3?f(Field.x):f(Field.trailX3));
 put(Channel.trailZ3,3>=capacity?f(Field.trailZ3):full?(3==capacity-1?f(Field.z):f(Field.trailZ4)):count==3?f(Field.z):f(Field.trailZ3));
 put(Channel.trailX4,4>=capacity?f(Field.trailX4):full?(4==capacity-1?f(Field.x):f(Field.trailX5)):count==4?f(Field.x):f(Field.trailX4));
 put(Channel.trailZ4,4>=capacity?f(Field.trailZ4):full?(4==capacity-1?f(Field.z):f(Field.trailZ5)):count==4?f(Field.z):f(Field.trailZ4));
 put(Channel.trailX5,5>=capacity?f(Field.trailX5):full?(5==capacity-1?f(Field.x):f(Field.trailX6)):count==5?f(Field.x):f(Field.trailX5));
 put(Channel.trailZ5,5>=capacity?f(Field.trailZ5):full?(5==capacity-1?f(Field.z):f(Field.trailZ6)):count==5?f(Field.z):f(Field.trailZ5));
 put(Channel.trailX6,6>=capacity?f(Field.trailX6):full?(6==capacity-1?f(Field.x):f(Field.trailX7)):count==6?f(Field.x):f(Field.trailX6));
 put(Channel.trailZ6,6>=capacity?f(Field.trailZ6):full?(6==capacity-1?f(Field.z):f(Field.trailZ7)):count==6?f(Field.z):f(Field.trailZ6));
 put(Channel.trailX7,7>=capacity?f(Field.trailX7):full?(7==capacity-1?f(Field.x):f(Field.trailX8)):count==7?f(Field.x):f(Field.trailX7));
 put(Channel.trailZ7,7>=capacity?f(Field.trailZ7):full?(7==capacity-1?f(Field.z):f(Field.trailZ8)):count==7?f(Field.z):f(Field.trailZ7));
 put(Channel.trailX8,8>=capacity?f(Field.trailX8):full?(8==capacity-1?f(Field.x):f(Field.trailX9)):count==8?f(Field.x):f(Field.trailX8));
 put(Channel.trailZ8,8>=capacity?f(Field.trailZ8):full?(8==capacity-1?f(Field.z):f(Field.trailZ9)):count==8?f(Field.z):f(Field.trailZ8));
 put(Channel.trailX9,9>=capacity?f(Field.trailX9):full?(9==capacity-1?f(Field.x):f(Field.trailX10)):count==9?f(Field.x):f(Field.trailX9));
 put(Channel.trailZ9,9>=capacity?f(Field.trailZ9):full?(9==capacity-1?f(Field.z):f(Field.trailZ10)):count==9?f(Field.z):f(Field.trailZ9));
 put(Channel.trailX10,10>=capacity?f(Field.trailX10):full?(10==capacity-1?f(Field.x):f(Field.trailX11)):count==10?f(Field.x):f(Field.trailX10));
 put(Channel.trailZ10,10>=capacity?f(Field.trailZ10):full?(10==capacity-1?f(Field.z):f(Field.trailZ11)):count==10?f(Field.z):f(Field.trailZ10));
 put(Channel.trailX11,11>=capacity?f(Field.trailX11):full?(11==capacity-1?f(Field.x):f(Field.trailX11)):count==11?f(Field.x):f(Field.trailX11));
 put(Channel.trailZ11,11>=capacity?f(Field.trailZ11):full?(11==capacity-1?f(Field.z):f(Field.trailZ11)):count==11?f(Field.z):f(Field.trailZ11));
}
