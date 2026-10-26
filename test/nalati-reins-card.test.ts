import {expect,test} from 'vitest';
import {encodeCanonicalJson,hashImmutableBytes} from '../src/sdk/immutable';
import {unzlibSync} from 'fflate';
import {readBakedGeometry} from '../src/game/plugin/geometry';
import {reinsCard,reinsCardBinary} from '../src/shards/nalati-grasslands/generators/reinsCard';
import reins from '../src/shards/nalati-grasslands/data/reins.json' with {type:'json'};

test('the reins card bakes both straps, double-faced, standing on y 0',()=>{
  const row=reinsCard().rows[0];if(row?.source.kind!=='inline')throw new Error('Missing inline reins');
  const strap=(reins.span*3+1)*2;
  expect(row.source.geometry).toMatchObject({count:2*strap,indexCount:2*reins.span*3*6});
  expect(row.source.material).toMatchObject({family:'painterly',rim:reins.paint.rim,bands:reins.paint.bands,side:'double'});
  const compressed=Uint8Array.from(atob(row.source.data),c=>c.codePointAt(0)??0),raw=unzlibSync(compressed);
  expect([compressed.byteLength,hashImmutableBytes(compressed)]).toEqual([617,'f24be3bb0f7cd28875595567133b333fb8802638afe5a8dd1b2142b9778b2da8']);
  expect([raw.byteLength,hashImmutableBytes(raw)]).toEqual([3024,'bf5749fc2dd6f8160197c903a85a8ac293f5eaf709126c2eded4ad0f9ce57714']);
  const book=new TextEncoder().encode(encodeCanonicalJson(reinsCard()));
  expect([book.byteLength,hashImmutableBytes(book)]).toEqual([1330,'3af9ee0c8c9b96fc3cdf8d09db57553d42c8dc9486c5cea61f35095749bf2927']);
  const geometry=readBakedGeometry(raw,0,row.source.geometry);
  geometry.computeBoundingBox();const box=geometry.boundingBox;if(box===null)throw new Error('Missing reins bounds');
  expect(box.min.y).toBeCloseTo(0,5);expect(box.min.x+box.max.x).toBeCloseTo(0,5);expect(box.max.z-box.min.z).toBeGreaterThan(.5);
  geometry.dispose();
});


test('the file declaration retains every original geometry byte and metadata field',()=>{
  const native=reinsCardBinary(),before=reinsCard(),old=before.rows[0],row=native.book.rows[0];
  if(old?.source.kind!=='inline'||row?.source.kind!=='file')throw new Error('Missing reins transport');
  const {data,kind:oldKind,...oldSource}=old.source,{file,kind,...source}=row.source;
  expect(oldKind).toBe('inline');expect(kind).toBe('file');
  expect(file).toBe('models/specimens/reins.bin');
  expect({...row,source}).toEqual({...old,source:oldSource});
  expect(native.book.materials).toEqual(before.materials);
  expect(native.bytes).toEqual(unzlibSync(Uint8Array.from(atob(data),c=>c.codePointAt(0)??0)));
  expect([native.bytes.byteLength,hashImmutableBytes(native.bytes)]).toEqual([3024,'bf5749fc2dd6f8160197c903a85a8ac293f5eaf709126c2eded4ad0f9ce57714']);
});

test('raw producer calls own detached bytes and declarations',()=>{
  const first=reinsCardBinary(),second=reinsCardBinary();
  expect(first.bytes).not.toBe(second.bytes);expect(first.book).not.toBe(second.book);
  first.bytes.fill(0);first.book.rows.length=0;
  expect(hashImmutableBytes(second.bytes)).toBe('bf5749fc2dd6f8160197c903a85a8ac293f5eaf709126c2eded4ad0f9ce57714');
  expect(second.book.rows).toHaveLength(1);
});
