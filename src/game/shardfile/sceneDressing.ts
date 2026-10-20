import { SceneInstanceFields } from './sceneInstances';
import * as THREE from 'three';
import * as v from 'valibot';
import { unzlibSync } from 'fflate';
import { SceneDressingSchema, SceneScatterPoseSchema, type SceneDressingRows } from '@wildshard/format/sceneDressing';
import { FrameCamera } from '@wildshard/engine/world/frameCamera';
import { modelContext, defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import { withOwner } from '@wildshard/engine/app/ownership';
import { painterlyMaterial, painterlyUniforms } from '@wildshard/engine/world/painterly';
import { wind } from '@wildshard/engine/world/steppeWind';
import { Rng } from '@wildshard/engine/core/rng';
import { buildYield } from '@wildshard/engine/core/workSlice';
import { scatterLayer, instanceBoxes, type ScatterLayer } from '@wildshard/engine/render/scatterInstances';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { createPackedSpecimens, defineSpecimenCatalogue, loadBoundSpecimen, loadSpecimenTexture, specimenMaterial } from '../models/specimenCatalogue';
import { fetchLaneBake, readBakedGeometry, bakedGeometryBytes } from '../plugin/geometry';
import { createClientScene } from '../plugin/ui';
import { AmbientWingField } from '../ambient/wingField';
import { hasLentLook, lendLooks, lentLook, lentMappedLook, setLentParam, setLentTexture } from './lentLooks';
import { runtimeLookMaterials } from './runtimeProduct';
import type { Scope } from '@wildshard/engine/app/scope';
import type { ShardContext } from '../plugin/context';

const books = new WeakMap<Scope,WeakMap<ShardContext['product'],SceneDressing>>();
const contacts = (input: readonly unknown[]) => readColliderRows(input, {kinds:['box','treads','hull','capsule','ball','trimesh'],surfaces:['sand','wetSand','grass','rock','planks','stone','water','wood','metal','flesh','shell','ground','edge','felt','earth']});

/** Numeric table decoder for dense scatter poses, preserving authored float64 values. */
export function readSceneNumericTable(bytes: Uint8Array): Record<string, number>[] {
  const invalid = new Error('Invalid scene numeric table');
  if (bytes.byteLength < 16) throw invalid;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0,true) !== 0x3150444e) throw invalid;
  const count=view.getUint32(4,true),width=view.getUint32(8,true),header=view.getUint32(12,true);
  if(count>100000||width<1||width>32||header>2048||header<1||bytes.length!==16+header+count*width*8)throw invalid;
  const keys=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(16,16+header)).split('\0');
  if(keys.length!==width||new Set(keys).size!==width||keys.some(key=>!/^[a-zA-Z][a-zA-Z0-9]{0,30}$/u.test(key)))throw invalid;
  return Array.from({length:count},(_,row)=>Object.fromEntries(keys.map((key,column)=>{
    const value=view.getFloat64(16+header+(row*width+column)*8,true);if(!Number.isFinite(value))throw invalid;return[key,value];
  })));
}

/** Dense little-endian source addresses keep byte offsets out of bounded JSON rows. */
export function readSceneGeometryAddress(bytes:Uint8Array,word:number):number{
  if(!Number.isSafeInteger(word)||word<0||bytes.byteLength%4!==0||word>=bytes.byteLength/4)throw new Error('Invalid scene geometry address');
  return new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(word*4,true);
}

/** Client-only Z2 projection over baked geometry, immutable scatter rows and the existing ambient host. */
export class SceneDressing {
  readonly group = new THREE.Group();
  readonly layers: ScatterLayer[] = [];
  readonly placed: Placed[] = [];
  readonly pieces=new Map<string,{name:string;object:THREE.Object3D;tris:number;placed:Placed[]}>();
  readonly props: THREE.Mesh[] = [];
  propTris = 0;
  private readonly frame = new FrameCamera(this.group);
  private readonly frustum = new THREE.Frustum();
  private readonly matrix = new THREE.Matrix4();
  private readonly lastPosition = new THREE.Vector3(1e9,0,0);
  private readonly lastDirection = new THREE.Vector3();
  private readonly position = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly size = new THREE.Vector2();
  private readonly drift: [number,number] = [0,0];
  private time = 0;
  private instances:SceneInstanceFields|undefined;
  private wings: AmbientWingField | undefined;
  private constructor(private readonly ctx: ShardContext, private readonly rows: SceneDressingRows) { this.group.name=rows.name; }

  static async install(ctx: ShardContext, input: unknown): Promise<SceneDressing> {
    const rows=v.parse(SceneDressingSchema,input), owner=new SceneDressing(ctx,rows);
    let products=books.get(ctx.scope);if(products===undefined){products=new WeakMap();books.set(ctx.scope,products);}
    if(products.has(ctx.product)||ctx.scope.disposed)throw new Error('Scene dressing requires an unbound entered owner');
    await owner.build();products.set(ctx.product,owner);const installed=products;
    ctx.scope.onDispose(()=>{if(installed.get(ctx.product)===owner)installed.delete(ctx.product);owner.instances?.dispose();for(const piece of owner.pieces.values())piece.object.removeFromParent();owner.group.removeFromParent();});
    ctx.system({id:'client.scene.dressing',phase:'update',after:['main.world'],before:['engine.creatures.update'],run:dt=>owner.update(dt)});
    return owner;
  }
  static current(ctx: ShardContext): SceneDressing { const value=books.get(ctx.scope)?.get(ctx.product);if(value===undefined||ctx.scope.disposed)throw new Error('Scene dressing is not installed');return value; }

  private async build(): Promise<void> {
    const {ctx,rows}=this,world=ctx.game.runtime?.world;
    if(world===undefined||world===null)throw new Error('Scene dressing needs a world');
    for(const source of Object.values(rows.geometry))if(source.kind==='baked'&&!ctx.product.hasFile(source.address.file))throw new Error('Missing scene geometry address file');
    for(const row of rows.layers)if(!ctx.product.hasFile(row.file))throw new Error('Missing scene scatter file');
    const looks=[...Object.values(rows.materials).flatMap(row=>row.kind==='look'||row.kind==='mapped'?[row.look]:[]),...(rows.motes===undefined?[]:[rows.motes.look])];
    const missing=looks.filter(id=>!hasLentLook(id));if(missing.length>0)lendLooks(ctx.scope,await runtimeLookMaterials({scope:ctx.scope,game:ctx.game},ctx.product.shardfile,true,missing));
    const sky=world.sky, models=modelContext(sky), pause=()=>buildYield(ctx.scope);
    const definitions=new Map<string,ModelDef<object>>();
    for(const source of rows.catalogues){
      const catalogue=defineSpecimenCatalogue<Record<string,object>>(source.rows,source.packed,source.materials);
      for(const row of source.rows)definitions.set(row.model.id,catalogue.model(row.key));
    }
    const packs=new Map(Object.entries(rows.packs).map(([key,source])=>[key,createPackedSpecimens(source.rows)]));
    await Promise.all([...packs.values()].map(pack=>pack.load()));
    const bytes=new Map<string,Promise<Uint8Array>>(),addresses=new Map<string,Promise<Uint8Array>>(),geometry=new Map<string,THREE.BufferGeometry>(),materials=new Map<string,THREE.Material>();
    for(const [key,source]of Object.entries(rows.geometry)){
      let shape:THREE.BufferGeometry;
      if(source.kind==='asset'){shape=(await loadBoundSpecimen(sky,source.row)).geometry.clone();}
      else if(source.kind==='packed'){
        const sourceRows=rows.packs[source.source],part=sourceRows===undefined?undefined:packs.get(source.source)?.parts(source.key,models,sourceRows.materials)?.[0];
        if(part===undefined)throw new Error('Missing scene packed shape');shape=part.geometry;
      }else{
        let raw:Uint8Array;
        if(source.kind==='inline')raw=unzlibSync(Uint8Array.from(atob(source.data),c=>c.codePointAt(0)??0));
        else{let pending=bytes.get(source.url);if(pending===undefined){pending=fetchLaneBake(source.url);bytes.set(source.url,pending);}raw=await pending;}
        let offset=0;if(source.kind==='baked'){let pending=addresses.get(source.address.file);if(pending===undefined){pending=ctx.product.file(source.address.file);addresses.set(source.address.file,pending);}offset=readSceneGeometryAddress(await pending,source.address.word);}
        if(offset+bakedGeometryBytes(source.row)>raw.byteLength)throw new Error('Scene geometry address exceeds its source');
        const decoded=readBakedGeometry(raw,offset,source.row);
        if(source.row.expand){shape=decoded.toNonIndexed();decoded.dispose();shape.computeBoundingBox();shape.computeBoundingSphere();}else shape=decoded;
      }
      if(source.kind==='inline'&&source.sphere!==undefined)shape.boundingSphere=new THREE.Sphere(new THREE.Vector3(...source.sphere.slice(0,3)),source.sphere[3]);
      geometry.set(key,shape);ctx.scope.own(shape);await pause();
    }
    for(const [key,source]of Object.entries(rows.materials).sort((a,b)=>Number(a[1].kind==='mapped')-Number(b[1].kind==='mapped'))){
      const material=source.kind==='specimen'?specimenMaterial(sky,source.row):source.kind==='asset'?(await loadBoundSpecimen(sky,source.row)).material
        :source.kind==='look'?lentLook(source.look):source.kind==='mapped'?lentMappedLook(source.look,requiredMaterial(materials,source.over)):painterlyMaterial(sky,source);
      if(source.kind==='look'){
        for(const [name,value]of Object.entries(source.params??{}))setLentParam(source.look,name,value);
        for(const [name,row]of Object.entries(source.textures??{}))void loadSpecimenTexture(row).then(texture=>{if(!ctx.scope.disposed)setLentTexture(source.look,name,texture);return null;}).catch(()=>null);
      }
      materials.set(key,material);await pause();
    }
    const needGeometry=(id:string):THREE.BufferGeometry=>{const value=geometry.get(id);if(value===undefined)throw new Error(`Missing scene shape ${id}`);return value;};
    const needMaterial=(id:string):THREE.Material=>{const value=materials.get(id);if(value===undefined)throw new Error(`Missing scene paint ${id}`);return value;};
    const needModel=(id:string):ModelDef<object>=>{const value=definitions.get(id);if(value===undefined)throw new Error(`Missing scene model ${id}`);return value;};
    for(const row of rows.staticModels){const shape=needGeometry(row.geometry),material=needMaterial(row.material);
      const {surface,seed,variants,specimenYaw,...metadata}=row.model;
      definitions.set(row.model.id,defineModel<object>({...metadata,...(surface===undefined?{}:{surface}),...(seed===undefined?{}:{seed}),...(variants===undefined?{}:{variants}),...(specimenYaw===undefined?{}:{specimenYaw}),build:()=>[{geometry:shape.clone(),material,castShadow:false,receiveShadow:true}]}));}
    for(const row of rows.layers){
      const data=row.binary?readSceneNumericTable(await ctx.product.file(row.file)):await ctx.product.json<unknown>(row.file);
      const selection=row.select;
      const poses=v.parse(v.array(SceneScatterPoseSchema),data).filter((_,i)=>selection===undefined||(i%selection.modulo===selection.remainder)===selection.equal)
        .map(({solid,...pose})=>solid===undefined?pose:Object.assign(pose,{solid:true as const}));
      if(poses.length===0)continue;
      const layer=scatterLayer(row.id,needGeometry(row.geometry),needMaterial(row.material),poses,row.far,row.castShadow,row.keepNear);this.layers.push(layer);this.group.add(layer.mesh);
      const colliderRows=Array.isArray(row.contacts)?contacts(row.contacts):unpackHulls(row.contacts);
      const registered=withOwner(ctx.scope,()=>place(needModel(row.model),poses.map(it=>({x:it.x,y:it.y,z:it.z})),{
        ctx:models,draw:'instanced',registry:ctx.app.registry,drawnInto:{object:layer.mesh,boxes:instanceBoxes(layer.mesh.geometry,poses),colliders:colliderRows},piece:{solidFloor:true,split:{every:150,yieldTask:pause}},
      }));await registered.registered;this.placed.push(registered);await pause();
    }
    for(const row of rows.statics){
      const made=createClientScene(row.recipe,{geometry:new Map(Object.entries(row.geometry).map(([key,id])=>[key,needGeometry(id)])),materials:new Map(Object.entries(row.materials).map(([key,id])=>[key,needMaterial(id)]))});
      const piece={name:row.name,object:made.root,tris:row.tris,placed:[] as Placed[]};this.pieces.set(row.name,piece);
      this.group.add(made.root);this.props.push(...made.root.children.filter(meshObject));this.propTris+=row.tris;
      for(const member of row.members){
        const registered=withOwner(ctx.scope,()=>place(needModel(member.model),member.placements.map(({matrix,heading,...pose})=>({...pose,...(heading===undefined?{}:{yaw:Math.atan2(...heading)}),...(matrix===undefined?{}:{matrix:new THREE.Matrix4().fromArray(matrix)})})),{
          ctx:models,draw:member.draw,registry:ctx.app.registry,drawnInto:{object:made.root,boxes:Float32Array.from(member.boxes),colliders:Array.isArray(member.contacts)?contacts(member.contacts):unpackHulls(member.contacts)},piece:{solidFloor:true,split:{every:150,yieldTask:pause}},
        }));await registered.registered;this.placed.push(registered);piece.placed.push(registered);await pause();
      }
    }
    this.instances=new SceneInstanceFields(rows.instances,geometry,materials,new Map([...this.pieces].map(([key,piece])=>[key,piece.object])));
    if(rows.wings!==undefined){this.wings=new AmbientWingField(rows.wings,new Map(rows.wings.layers.map(row=>[row.id,needGeometry(row.geometry)])),new Map(rows.wings.layers.map(row=>[row.id,needMaterial(row.material)])));this.group.add(this.wings.group);}
    if(rows.motes!==undefined){const row=rows.motes,rng=new Rng(row.seed),seeds=Float32Array.from({length:row.count*4},()=>rng.next()),shape=new THREE.BufferGeometry();
      shape.setAttribute('position',new THREE.BufferAttribute(new Float32Array(row.count*3),3));shape.setAttribute('aSeed',new THREE.BufferAttribute(seeds,4));ctx.scope.own(shape);
      const points=new THREE.Points(shape,lentLook(row.look));points.name=row.name;points.frustumCulled=false;points.renderOrder=2;this.group.add(points);}
    ctx.root.add(this.group);
  }
  update(dt:number):void{
    const world=this.ctx.game.runtime?.world;if(world===null||world===undefined)return;
    const camera=this.frame.of(world.game.camera);camera.getWorldPosition(this.position);camera.getWorldDirection(this.direction);
    if(this.position.distanceToSquared(this.lastPosition)>1||this.direction.dot(this.lastDirection)<.9994){
      this.lastPosition.copy(this.position);this.lastDirection.copy(this.direction);camera.updateMatrixWorld();this.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.matrix);
      for(const layer of this.layers)layer.cull(this.frustum,this.position);
    }
    this.time+=dt;
    for(const row of this.rows.animations){const w=painterlyUniforms.uPWind.value;setLentParam(row.look,row.timeParam,this.time);setLentParam(row.look,row.windParam,[w.x,w.y,Math.min(row.windMax,w.z*row.windScale)]);}
    this.instances?.update(dt,world.player.position,painterlyUniforms.uPTime.value);
    this.wings?.update(dt,world.player.position);
    const row=this.rows.motes;
    if(row!==undefined){this.drift[0]+=wind.dirX*wind.speed*row.drift*dt;this.drift[1]+=wind.dirZ*wind.speed*row.drift*dt;
      world.game.renderer.getDrawingBufferSize(this.size);setLentParam(row.look,row.driftParam,this.drift);setLentParam(row.look,row.pixelParam,this.size.y/(2*Math.tan(world.game.camera.fov*Math.PI/360)));}
  }
  stats():{layers:Record<string,{total:number;visible:number;tris:number}>;propTris:number}{return{layers:Object.fromEntries(this.layers.map(row=>[row.name,{total:row.count,visible:row.visible,tris:row.tris}])),propTris:this.propTris};}
}
function meshObject(value:THREE.Object3D):value is THREE.Mesh{return value instanceof THREE.Mesh;}

function unpackHulls(row:Exclude<SceneDressingRows['layers'][number]['contacts'],readonly unknown[]>):ReturnType<typeof contacts>{
  const bytes=unzlibSync(Uint8Array.from(atob(row.data),c=>c.codePointAt(0)??0)),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let at=0;
  const rows=row.origins.map(([x,y,z,count])=>{const points=Array.from({length:count},(_,i)=>view.getFloat32((at+i)*4,true));at+=count;return{kind:'hull',x,y,z,points,surface:row.surface};});
  if(at*4!==bytes.length)throw new Error('Packed scene contacts differ from their origins');return contacts(rows);
}

function requiredMaterial(rows:ReadonlyMap<string,THREE.Material>,key:string):THREE.Material{const value=rows.get(key);if(value===undefined)throw new Error('Missing mapped scene material');return value;}
