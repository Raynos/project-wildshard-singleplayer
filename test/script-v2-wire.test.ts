import { expect,test } from 'vitest';
import { layoutV2,writeV2Frame,validateV2Frame,relativeTickV2,V2_REGION_STRIDES } from '../src/format/scriptWireV2';

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
