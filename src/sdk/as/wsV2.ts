/** ABI v2 guest source. All reads and geometry stay inside Wasm; this does not
 * install a host or change any ABI-v0/v1 authoring source. */
import { V2_REGION_STRIDES } from '@wildshard/format/scriptWireV2';

export function v2CoreSource(io: number): string {
  if (!Number.isSafeInteger(io) || io < 0 || io%8 !== 0 || io > 4*65536-656) throw new Error('Invalid v2 SDK IO base');
  const strides = V2_REGION_STRIDES.map((stride,index) => `case ${index+1}:return ${stride};`).join('');
  return String.raw`
const IO:usize=${io};
let selected:i32=-1;
@external("env","__v2_fuel") declare function remainingFuel():i32;
let sliceStart:i32=-1;
@inline export function io():i32{return i32(IO);}
@inline function stride(kind:i32):u32{switch(kind){${strides}default:unreachable();}return 0;}
@inline function directory(kind:i32):usize{
  assert(kind>=1&&kind<=22);const d=IO+128+usize(kind-1)*24;
  assert(load<u32>(d)==u32(kind)&&load<u32>(d+8)==stride(kind));
  const off=load<u32>(d+4),cap=load<u32>(d+12),count=load<u32>(d+16),limit=usize(memory.size())*65536-IO;
  assert(off>=656&&usize(off)<=limit&&(IO+off)%16==0);
  assert(cap<=u32((limit-off)/stride(kind))&&count<=cap);return d;
}
@inline export function count(kind:i32):i32{return i32(load<u32>(directory(kind)+16));}
@inline export function row(kind:i32,index:i32):usize{
  const d=directory(kind);assert(index>=0&&u32(index)<load<u32>(d+16));
  return IO+load<u32>(d+4)+usize(index)*stride(kind);
}
@inline export function select(index:i32):void{row(1,index);selected=index;}
@inline export function beginBinding(index:i32):bool{
  select(index);const at=binding();if((load<u32>(at+12)&3)!=3)return false;
  store<u32>(IO+64,load<u32>(at));sliceStart=remainingFuel();return true;
}
@inline export function endBinding():void{
  const used=sliceStart-remainingFuel();assert(sliceStart>=0&&used>=0&&used<=load<i32>(binding()+56));sliceStart=-1;
}
@inline function binding():usize{assert(selected>=0);return row(1,selected);}
@inline export function handle():i32{return load<i32>(binding());}
@inline export function self():i32{return load<i32>(binding()+4);}
@inline export function player():i32{return load<i32>(binding()+8);}
@inline export function due():bool{return (load<u32>(binding()+12)&2)!=0;}
@inline export function previousTick():i32{return load<i32>(binding()+48);}
@inline export function currentTick():i32{return load<i32>(binding()+52);}
@inline export function absoluteTick(relative:i32):f64{return load<f64>(IO+104)+f64(relative);}
@inline export function beginState():void{
  selected=-1;sliceStart=-1;store<u32>(IO+64,0);const n=count(2),d=directory(3);assert(u32(n)<=load<u32>(d+12));
  store<u32>(d+16,u32(n));for(let i=0;i<n;i++)store<f64>(row(3,i),load<f64>(row(2,i)));
}
@inline function column(kind:i32,index:i32,base:usize):usize{
  const b=binding();assert(index>=0&&u32(index)<load<u32>(b+base+4));
  const start=load<u32>(b+base),n=u32(count(kind));assert(start<=n&&u32(index)<n-start);
  return row(kind,i32(start)+index);
}
@inline export function state(index:i32):f64{return load<f64>(column(2,index,16));}
@inline export function setState(index:i32,value:f64):void{store<f64>(column(3,index,16),value);}
@inline export function parameter(index:i32):f64{return load<f64>(column(4,index,24));}
@inline export function fieldId(index:i32):i32{return load<i32>(column(6,index,36));}
@inline export function fieldPresent(index:i32):bool{
  const present=load<u32>(column(6,index,36)+4);assert(present<=1);return present!=0;
}
@inline export function field(index:i32):f64{assert(fieldPresent(index));return load<f64>(column(6,index,36)+8);}
@inline function observation():usize{
  const b=binding(),at=row(5,load<i32>(b+32));assert(load<i32>(at)==load<i32>(b)&&load<i32>(at+4)==load<i32>(b+4));return at;
}
@inline export function target():i32{return load<i32>(observation()+8);}
@inline export function sampleTick():i32{return load<i32>(observation()+16);}
@inline export function observed(component:i32):f64{
  assert(component>=0&&component<9);const at=observation();
  const bit=component<4?0:component==4?1:component==5?2:component<8?3:4;
  assert((load<u32>(at+12)&(1<<bit))!=0);return load<f64>(at+24+usize(component)*8);
}
@inline export function playerHandle(index:i32):i32{return load<i32>(row(7,index));}
@inline export function playerSampleTick(index:i32):i32{return load<i32>(row(7,index)+8);}
@inline export function playerValue(index:i32,component:i32):f64{
  assert(component>=0&&component<8);const at=row(7,index),bit=component<4?0:component==4?1:component<7?2:3;
  assert((load<u32>(at+4)&(1<<bit))!=0);return load<f64>(at+16+usize(component)*8);
}
@inline export function edgeWord(index:i32,field:i32):i32{assert(field>=0&&field<4);return load<i32>(row(8,index)+usize(field)*4);}
@inline export function edgeValue(index:i32,axis:i32):f64{assert(axis>=0&&axis<2);return load<f64>(row(8,index)+16+usize(axis)*8);}
@inline export function eventWord(index:i32,field:i32):i32{assert(field>=0&&field<6);return load<i32>(row(9,index)+usize(field)*4);}
@inline export function eventValue(index:i32,field:i32):f64{assert(field>=0&&field<4);return load<f64>(row(9,index)+24+usize(field)*8);}
@inline function grid():usize{
  assert(count(14)>=64);const at=row(14,0);assert(load<u32>(at+56)==1&&load<u32>(at+44)==0&&load<u32>(at+60)==0);return at;
}
@inline export function gridWater():f64{return load<f64>(grid()+48);}
@inline export function gridHeight(x:f64,z:f64):f64{
  const at=grid(),cols=load<u32>(at+32),rows=load<u32>(at+36),base=load<u32>(at+40),offset=load<u32>(directory(14)+4),n=u32(count(14));
  assert(cols>=2&&rows>=2&&base>=offset+64&&base-offset<=n&&cols<=(n-(base-offset))/4/rows);
  const ox=load<f64>(at),oz=load<f64>(at+8),cx=load<f64>(at+16),cz=load<f64>(at+24);assert(cx>0&&cz>0);
  const ux=(x-ox)/cx,uz=(z-oz)/cz;assert(ux>=0&&uz>=0&&ux<=f64(cols-1)&&uz<=f64(rows-1));
  const ix=min(cols-2,u32(Math.floor(ux))),iz=min(rows-2,u32(Math.floor(uz))),fx=ux-f64(ix),fz=uz-f64(iz);
  const p=IO+base+usize(iz*cols+ix)*4;
  const h00=f64(load<f32>(p)),h10=f64(load<f32>(p+4)),h01=f64(load<f32>(p+usize(cols)*4)),h11=f64(load<f32>(p+usize(cols+1)*4));
  const a=h00+(h10-h00)*fx,b=h01+(h11-h01)*fx;return a+(b-a)*fz;
}
@inline export function distance(x:f64,z:f64,toX:f64,toZ:f64):f64{return Math.hypot(toX-x,toZ-z);}
@inline export function bearing(x:f64,z:f64,toX:f64,toZ:f64):f64{return Math.atan2(toX-x,toZ-z);}
@inline export function radialX(yaw:f64,radius:f64):f64{return Math.sin(yaw)*radius;}
@inline export function radialZ(yaw:f64,radius:f64):f64{return Math.cos(yaw)*radius;}
`;
}
