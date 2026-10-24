import { expect,test } from 'vitest';
import { layoutV2,writeV2Frame,createV2FrameWriter,validateV2Frame,relativeTickV2,V2_REGION_STRIDES,type V2Frame } from './scriptWireV2';

test('v2 layouts retain all 22 kinds and check absolute alignment, inactive regions and overflow', () => {
  const layout = layoutV2(8,1,new Map([[1,2],[2,4],[10,2]]));
  expect(layout.regions.map(row => row.stride)).toEqual(V2_REGION_STRIDES);expect(layout.regions).toHaveLength(22);
  for (const region of layout.regions) expect((layout.io+region.offset)%16).toBe(0);
  expect(layout.regions[13]).toMatchObject({ kind: 14,stride: 1,capacity: 0 });
  for (const capacities of [new Map([[0,1]]),new Map([[23,1]]),new Map([[1,-1]]),new Map([[1,Number.MAX_SAFE_INTEGER]])]) expect(() => layoutV2(8,1,capacities)).toThrow();
  expect(() => layoutV2(3,1,new Map())).toThrow();expect(() => layoutV2(65528,1,new Map())).toThrow();
});
test('v2 sim frames retain epoch-crossing sample stamps with no client clock fields', () => {
  const view = new DataView(new ArrayBuffer(65536)), layout = layoutV2(1024,1,new Map([[1,2],[7,1],[8,1],[9,1],[12,1],[13,3]]));
  const counts = new Map([[1,2],[7,1],[8,1],[9,1],[12,1],[13,3]]), tick = 2**30+3;
  const authority = writeV2Frame(view,layout,{ lane: 1,module: 1,sequence: 4,tick,due: 2 },counts);
  expect(view.getInt32(1024+28,true)).toBe(3);expect(view.getFloat64(1024+104,true)).toBe(2**30);
  expect(relativeTickV2(2**30-1,2**30)).toBe(-1);expect(relativeTickV2(Number.MAX_SAFE_INTEGER,Math.floor(Number.MAX_SAFE_INTEGER/2**30)*2**30)).toBe(2**30-1);
  expect(() => relativeTickV2(0,2**32)).toThrow('i32 epoch');
  for (const offset of [80,88,112,116,120,124]) expect(view.getUint32(1024+offset,true)).toBe(0);
  expect(validateV2Frame(view,layout,authority)[6]).toBe(1);
  view.setUint32(1024+68,100,true);expect(() => validateV2Frame(view,layout,authority)).toThrow('call envelope');
});
test('v2 refuses every mutated header input byte and every directory authority field', () => {
  const view = new DataView(new ArrayBuffer(65536)), layout = layoutV2(1024,1,new Map([[1,1],[10,2]]));
  const write = () => writeV2Frame(view,layout,{ lane: 1,module: 1,sequence: 1,tick: 60,due: 1 },new Map([[1,1]]));
  for (let byte = 0; byte < 128; byte++) {
    if (byte >= 56 && byte < 68 || byte >= 72 && byte < 80) continue;
    const authority = write();view.setUint8(1024+byte,view.getUint8(1024+byte)^1);expect(() => validateV2Frame(view,layout,authority)).toThrow('call envelope');
  }
  for (let kind = 0; kind < 22; kind++) for (const field of [0,4,8,12,20]) {
    const authority = write(), at = 1024+128+kind*24+field;view.setUint32(at,view.getUint32(at,true)+1,true);
    expect(() => validateV2Frame(view,layout,authority)).toThrow('region directory');
  }
  const authority = write();view.setUint32(1024+128+9*24+16,3,true);expect(() => validateV2Frame(view,layout,authority)).toThrow('directory');
});
test('v2 output counts agree with trusted capacity and view frames cannot publish sim commands', () => {
  const view = new DataView(new ArrayBuffer(65536)), layout = layoutV2(1024,1,new Map([[1,1],[10,2],[11,1],[17,1],[18,2]]));
  const authority = writeV2Frame(view,layout,{ lane: 3,module: 1,sequence: 1,tick: 60,due: 1,dt: 1/60,alpha: .5,frame: 1 },new Map([[1,1]]));
  expect(validateV2Frame(view,layout,authority)[16]).toBe(1);
  view.setUint32(1024+128+17*24+16,1,true);view.setUint32(1024+76,1,true);expect(() => validateV2Frame(view,layout,authority)).toThrow('output bank');
  view.setUint32(1024+128+17*24+16,2,true);view.setUint32(1024+76,2,true);expect(validateV2Frame(view,layout,authority)[17]).toBe(2);
  const transforms = layout.regions[16];if (transforms === undefined) throw new Error('Missing transform metadata');
  view.setUint32(1024+transforms.offset+12,1,true);expect(() => validateV2Frame(view,layout,authority)).toThrow('transform count');
  view.setUint32(1024+72,1,true);expect(() => validateV2Frame(view,layout,authority)).not.toThrow();
  view.setUint32(1024+56,1,true);view.setUint32(1024+128+9*24+16,1,true);expect(() => validateV2Frame(view,layout,authority)).toThrow('cannot publish sim');
});


test('view frame preparation clears dirty flags without erasing persistent matrices or channels', () => {
  const view = new DataView(new ArrayBuffer(65536)), layout = layoutV2(1024,1,new Map([[1,1],[17,1],[18,1]]));
  const transform = layout.regions[16], channels = layout.regions[17]; if (transform === undefined || channels === undefined) throw new Error('Missing view metadata');
  view.setUint32(1024+transform.offset+12,1,true); view.setFloat32(1024+transform.offset+16,2,true);view.setFloat64(1024+channels.offset,8,true);
  const authority = writeV2Frame(view,layout,{ lane: 3,module: 1,sequence: 2,tick: 61,due: 1,dt: 1/60,alpha: .5,frame: 2 },new Map([[1,1]]));
  expect(view.getUint32(1024+transform.offset+12,true)).toBe(0);expect(view.getFloat32(1024+transform.offset+16,true)).toBe(2);expect(view.getFloat64(1024+channels.offset,true)).toBe(8);
  expect(validateV2Frame(view,layout,authority)[17]).toBe(0);
});

test('input counts remain immutable in a subview and call authorities stay detached', () => {
  const bytes = new Uint8Array(65536+32);bytes.fill(0xab);
  const view = new DataView(bytes.buffer,32,65536), layout = layoutV2(1024,1,new Map(V2_REGION_STRIDES.map((_,index) => [index+1,2])));
  const inputs = [1,2,4,5,6,7,8,9,12,13,14,15,16,19,21], counts = new Map(inputs.map(kind => [kind,1]));
  const frame = { lane: 3,module: 1,sequence: 1,tick: 2**30+3,due: 1,dt: -0,alpha: -0,frame: 1 } as const;
  for (const kind of inputs) {
    const authority = writeV2Frame(view,layout,frame,counts);
    expect(validateV2Frame(view,layout,authority)[kind-1]).toBe(1);
    view.setUint32(layout.io+128+(kind-1)*24+16,0,true);
    expect(() => validateV2Frame(view,layout,authority)).toThrow('region directory');
  }
  const authority = writeV2Frame(view,layout,frame,counts), header = authority.header.slice();
  expect(Object.is(view.getFloat64(layout.io+80,true),-0)).toBe(true);
  expect(Object.is(view.getFloat64(layout.io+88,true),-0)).toBe(true);
  writeV2Frame(view,layout,{ ...frame,sequence: 2 },counts);
  expect(authority.header).toEqual(header);expect(Object.isFrozen(authority.counts)).toBe(true);
  expect(() => validateV2Frame(view,layout,authority)).toThrow('call envelope');
  expect(bytes.subarray(0,32)).toEqual(new Uint8Array(32).fill(0xab));
});


test('owner-local writers freeze equal count shapes once while every header stays detached',()=>{
  const layout=layoutV2(1024,1,new Map([[1,2],[6,2],[21,2]])),write=createV2FrameWriter(layout);
  const view=new DataView(new ArrayBuffer(65536)),counts=new Map([[1,1],[6,-0]]);
  const frame:V2Frame={lane:2,module:1,sequence:1,tick:0,due:1};
  const first=write(view,frame,counts),saved=first.header.slice(),frozen=first.counts;
  expect(Object.isFrozen(frozen)).toBe(true);expect(Object.is(frozen[5],-0)).toBe(true);
  expect(Reflect.set(frozen,0,0)).toBe(false);
  for(let index=2;index<8;index++){
    const next=write(view,{...frame,sequence:index,tick:index},new Map(counts));
    expect(next.counts).toBe(frozen);expect(next.header).not.toBe(first.header);
    expect(first.header).toEqual(saved);expect(()=>validateV2Frame(view,layout,next)).not.toThrow();
  }
  counts.set(6,0);const changed=write(view,frame,counts);
  expect(changed.counts).not.toBe(frozen);expect(Object.is(changed.counts[5],0)).toBe(true);expect(Object.isFrozen(changed.counts)).toBe(true);
  expect(createV2FrameWriter(layout)(view,frame,counts).counts).not.toBe(changed.counts);
});
test('caller authority mutation and refused frames cannot poison a writer count template',()=>{
  const layout=layoutV2(1024,1,new Map([[1,2],[6,2]])),write=createV2FrameWriter(layout);
  const view=new DataView(new ArrayBuffer(65536)),counts=new Map([[1,1]]);
  const frame:V2Frame={lane:3,module:1,sequence:1,tick:4,due:1,dt:-0,alpha:-0,frame:1};
  const first=write(view,frame,counts),frozen=first.counts;
  first.header.fill(0xff);Reflect.set(first,'counts',Object.freeze(Array.from({length:22},()=>99)));
  expect(()=>write(view,{...frame,alpha:2},new Map([[1,2],[6,1]]))).toThrow('view clock');
  expect(()=>write(view,frame,new Map([[1,3]]))).toThrow('count');
  const next=write(view,frame,counts);expect(next.counts).toBe(frozen);
  expect(()=>validateV2Frame(view,layout,next)).not.toThrow();expect(Object.isFrozen(next.counts)).toBe(true);
});
test('retained-count writers preserve all frame bytes, subviews and partial refusal writes',()=>{
  const layout=layoutV2(1024,1,new Map(V2_REGION_STRIDES.map((_,index)=>[index+1,2]))),write=createV2FrameWriter(layout);
  const frames:V2Frame[]=[{lane:1,module:1,sequence:0,tick:0,due:1},{lane:2,module:2,sequence:3,tick:2**30+3,due:1},
    {lane:3,module:1,sequence:4,tick:2**31+7,due:1,dt:-0,alpha:-0,frame:5}];
  const counts=new Map([[1,1],[2,2],[6,1],[7,1],[21,1]]);
  for(const frame of frames){
    const left=new Uint8Array(65536+32).fill(0x7b),right=left.slice();
    const a=new DataView(left.buffer,32,65536),b=new DataView(right.buffer,32,65536);
    const old=writeV2Frame(a,layout,frame,counts),next=write(b,frame,counts);
    expect(right).toEqual(left);expect(next.header).toEqual(old.header);expect(next.counts).toEqual(old.counts);
    expect(Object.isFrozen(next.counts)).toBe(true);expect(validateV2Frame(b,layout,next)).toEqual(validateV2Frame(a,layout,old));
    if(frame.lane===3){
      expect(()=>writeV2Frame(a,layout,{...frame,dt:-1},counts)).toThrow('view clock');
      expect(()=>write(b,{...frame,dt:-1},counts)).toThrow('view clock');expect(right).toEqual(left);
    }
  }
});

test('nested count getters cannot overwrite the active scratch or any detached authority',()=>{
  const layout=layoutV2(1024,1,new Map([[1,2],[6,2]])),write=createV2FrameWriter(layout);
  const outerView=new DataView(new ArrayBuffer(65536)),innerView=new DataView(new ArrayBuffer(65536));
  const frame:V2Frame={lane:2,module:1,sequence:1,tick:0,due:1};
  let nested:ReturnType<typeof write>|undefined,entered=false;
  class ReentrantCounts extends Map<number,number>{
    override get(key:number):number|undefined{
      if(key===6&&!entered){entered=true;nested=write(innerView,frame,new Map([[1,2],[6,2]]));}
      return super.get(key);
    }
  }
  const outer=write(outerView,frame,new ReentrantCounts([[1,1],[6,-0]]));
  if(nested===undefined)throw new Error('Missing nested authority');
  const inner=nested;
  expect(outer.counts[0]).toBe(1);expect(Object.is(outer.counts[5],-0)).toBe(true);
  expect(nested.counts[0]).toBe(2);expect(nested.counts[5]).toBe(2);
  expect(()=>validateV2Frame(outerView,layout,outer)).not.toThrow();
  expect(()=>validateV2Frame(innerView,layout,inner)).not.toThrow();
  const saved=[...outer.counts];
  expect(()=>write(outerView,frame,new Map([[1,3]]))).toThrow('count');
  write(outerView,frame,new Map([[1,2],[6,1]]));
  expect(outer.counts).toEqual(saved);expect(Object.isFrozen(outer.counts)).toBe(true);
  expect(nested.counts[5]).toBe(2);
});
