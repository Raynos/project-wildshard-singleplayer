import {BufferAttribute,BufferGeometry,Float16BufferAttribute,Matrix4} from 'three';

/** Mixed raw channels and reordered/shared indices expose both copy runs and gaps. */
export function wholePartitionCase(storage:'none'|'u16'|'u32'): {geometry:BufferGeometry;transform:Matrix4} {
 const geometry=new BufferGeometry();
 geometry.setAttribute('position',new BufferAttribute(Float32Array.of(-230,0,-230,-229,0,-230,-230,0,-229,230,0,230,231,0,230,230,0,231,-0,1,0,1,1,0,0,1,1),3));
 geometry.setAttribute('normal',new BufferAttribute(Int16Array.from({length:36},(_,i)=>i%4===2?32767:i-17),4,true));
 geometry.setAttribute('uv',new Float16BufferAttribute(Uint16Array.from({length:18},(_,i)=>[0x8000,0x3c00,0x7e01][i%3]??0),2));
 geometry.setAttribute('color',new BufferAttribute(Uint8ClampedArray.from({length:36},(_,i)=>i*7),4,true));
 geometry.setAttribute('payload',new BufferAttribute(new Float32Array(Uint32Array.from({length:9},(_,i)=>i===0?0x7fa12345:i===1?0x80000000:0x3f800000+i).buffer),1));
 if(storage!=='none') {
  const indices=[3,4,5,0,2,1,0,1,2,4,5,3];
  geometry.setIndex(new BufferAttribute(storage==='u16'?Uint16Array.from(indices):Uint32Array.from(indices),1));
 }
 return {geometry,transform:new Matrix4().makeTranslation(1,0,2)};
}
