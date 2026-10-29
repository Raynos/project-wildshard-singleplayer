import { BufferAttribute, BufferGeometry, Float16BufferAttribute, Matrix4 } from 'three';
import { bindHomeBuildCache, saveHomeBuildGeometry, readHomeBuildGeometry, homeBuildGeometryKeys, HOME_BUILD_CACHE_BYTES } from '../../src/game/shardfile/homeBuildCache';
import { emptyShardfile } from '../../src/sdk/author';
const source = emptyShardfile({slug:'cache-proof',name:'Cache proof',author:'Fixture',revision:1,seed:1});
const other = emptyShardfile({slug:'not-home',name:'Not home',author:'Fixture',revision:1,seed:1});
function check(value: boolean, message: string): void { if (!value) throw new Error(message); }
export async function proof(): Promise<object> {
  Reflect.set(globalThis,'__homeProofBuild','a');
  bindHomeBuildCache(source);
  const geometry = new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array([-0,2,3]),3));
  geometry.setAttribute('aPat',new Float16BufferAttribute(new Uint16Array([0x3800]),1));
  const views = new Map([['draw',{geometry,matrix:new Matrix4().makeTranslation(1.1234567891234,0,0)}]]);
  await saveHomeBuildGeometry(source,'whole:proof',views);
  const restored = await readHomeBuildGeometry(source,'whole:proof');
  check(restored?.get('draw')?.geometry.getAttribute('aPat').getX(0)===0.5,'Half numeric value changed');
  check(Object.is(restored?.get('draw')?.geometry.getAttribute('position').getX(0),-0),'Signed zero changed');
  check(restored?.get('draw')?.matrix.elements[12]===1.1234567891234,'Double matrix changed');
  const keys = await homeBuildGeometryKeys(source); check(keys?.has('whole:proof')===true,'Warm key missing');
  check(await readHomeBuildGeometry(other,'whole:proof')===null,'Neighbour was admitted to home cache');
  Reflect.set(globalThis,'__homeProofBuild','b'); bindHomeBuildCache(source);
  check(await readHomeBuildGeometry(source,'whole:proof')===null,'Old build restored');
  await saveHomeBuildGeometry(source,'whole:new',views);
  check((await homeBuildGeometryKeys(source))?.has('whole:proof')===false,'Old build accumulated');
  check((await homeBuildGeometryKeys(source))?.has('whole:new')===true,'New build missing');
  const large = new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(HOME_BUILD_CACHE_BYTES/4+1),3));
  await saveHomeBuildGeometry(source,'whole:oversize',new Map([['large',{geometry:large,matrix:new Matrix4()}]]));
  check(await readHomeBuildGeometry(source,'whole:oversize')===null,'Payload bound exceeded');
  for (let i=0;i<260;i++) await saveHomeBuildGeometry(source,`whole:small-${i}`,views);
  const bounded = await homeBuildGeometryKeys(source);
  check((bounded?.size ?? 999) <= 257,'Entry bound exceeded');
  const db = await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('ws-built-home-v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('Native IDB open failed'));});
  const transaction = db.transaction('geometry','readwrite');
  transaction.objectStore('geometry').put({identity:'wrong',bytes:0,snapshot:[]},'whole:new');
  await new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(new Error('Corruption write failed'));});
  check(await readHomeBuildGeometry(source,'whole:new')===null,'Foreign record restored');
  db.close(); geometry.dispose();large.dispose();for(const view of restored?.values()??[])view.geometry.dispose();
  return {half:0.5,signedZero:true,matrix:true,neighbourExcluded:true,buildInvalidation:true,oversizeRejected:true,foreignRecordRejected:true,entryBound:true,bound:HOME_BUILD_CACHE_BYTES};
}
