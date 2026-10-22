import cragRows from '../data/cragRock.generated.json' with {type:'json'};
import paintedTextures from '../data/paintedTextures.json' with {type:'json'};
import layout from '../data/layout.generated.json' with {type:'json'};
import decorative from '../data/decorative.generated.json' with {type:'json'};
import metrics from '../data/modelMetrics.json' with {type:'json'};
import { ClientChannels } from '@wildshard/sdk/clientChannels';
import { NALATI_FAR_HERD_CHANNELS } from './clientMotion';
import { POI_CLEARINGS } from './clearings';
import { KOKPAR, KURGANS, SUMMER_YURTS } from './layout';
import * as THREE from 'three';
import { unzlibSync, zlibSync } from 'fflate';
import { SceneDressingSchema, SceneBakedGeometrySchema,SceneFloorSchema, SceneDressingContactsSchema, type SceneDressingRows } from '@wildshard/format/sceneDressing';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { nameBlob } from '@wildshard/sdk/blobs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { writeGeometry, join } from './geometryWriter';
import preparedInput from '../data/placeRuntime.generated.json' with {type:'json'};
import scenesInput from '../data/poiScenes.generated.json' with {type:'json'};
import specimensInput from '../data/specimens.generated.json' with {type:'json'};
import paintInput from '../data/poiPaint.json' with {type:'json'};
import coverInput from '../data/cover.generated.json' with {type:'json'};
import atlases from '../data/signAtlases.json' with {type:'json'};
import balbal from '../data/balbalSpecimen.generated.json' with {type:'json'};
import * as v from 'valibot';
import { SpecimenCatalogueSchema, PackedSpecimenSchema, SpecimenMaterialSchema, SpecimenAssetSchema } from '@wildshard/format/specimenCatalogue';
import { AmbientFlockSchema, AmbientPerchesSchema } from '@wildshard/format/ambientLife';
import { PrivateSceneSchema } from '@wildshard/format/clientChannels';

const text=v.string(),number=v.number(),xyz=v.tuple([number,number,number]);
const memberSchema=v.object({draw:v.picklist(['instanced','merged']),placements:v.array(v.object({x:number,y:number,z:number,yaw:v.exactOptional(number),heading:v.exactOptional(v.tuple([number,number])),matrix:v.exactOptional(v.array(number))})),boxes:v.array(number),floors:v.array(SceneFloorSchema),solid:v.array(v.unknown()),descs:v.array(v.unknown())});
const place=v.object({name:text,tris:number,anchors:v.optional(v.object({riders:v.optional(v.array(v.object({t:number,k:number,w:number,bob:number})),[])}),{riders:[]}),instances:v.array(v.tuple([text,v.object({asset:SpecimenAssetSchema,scene:PrivateSceneSchema})])),effects:v.array(v.tupleWithRest([text,xyz],v.unknown())),members:v.array(v.tuple([text,memberSchema])),meshes:v.array(v.object({material:text,offset:number,geometry:SceneBakedGeometrySchema}))});
const preparedSchema=v.object({places:v.object({rows:v.array(place)}),dressing:v.object({rows:v.array(v.object({key:text,offset:number,geometry:SceneBakedGeometrySchema}))})});
const materialsSchema=v.record(text,SpecimenMaterialSchema);
const specimensSchema=v.object({catalogue:SpecimenCatalogueSchema,packed:PackedSpecimenSchema,materials:materialsSchema,assets:v.record(text,SpecimenAssetSchema)});
const profileSchema=v.object({catalogue:SpecimenCatalogueSchema,packed:PackedSpecimenSchema,life:v.array(v.object({kind:text,row:AmbientFlockSchema,perches:AmbientPerchesSchema}))});
const coverSchema=v.object({phone:profileSchema,desktop:profileSchema,materials:materialsSchema,butterflies:v.object({phone:number,desktop:number}),hue:v.array(v.union([text,number])),raptors:number});
const paintSchema=v.object({glacierSnout:v.object({x:number,y:number,z:number}),rows:v.array(v.object({key:text,data:text,geometry:SceneBakedGeometrySchema})),contacts:v.record(text,v.record(text,v.object({points:text,origins:v.array(v.tuple([number,number,number,number]))})))});
// Shared authoring metadata is emitted alongside the runtime boot descriptors.
const prepared=v.parse(preparedSchema,{...preparedInput,places:{rows:preparedInput.places.rows.filter(row=>['camp','bridge','roads','summerCamp','kurgans','eagleRock','cairn','crags','watchtower','dressing-statics','dressing-clutter','kokpar','outcrops'].includes(row.name))}});
const scenes=v.parse(v.record(text,PrivateSceneSchema),scenesInput);
const specimens=v.parse(specimensSchema,specimensInput);
const paint=v.parse(paintSchema,paintInput);
const cover=v.parse(coverSchema,coverInput);
// the places' anchors and the camp smoke's baked puffs (bake-place-runtime.mjs)
const spot=v.object({x:number,y:number,z:number}),placed=v.parse(v.object({places:v.object({rows:v.array(v.object({name:text,
  anchors:v.optional(v.object({entrance:v.exactOptional(v.object({...spot.entries,facing:number})),ledges:v.exactOptional(v.array(v.object({...spot.entries,r:number}))),
    balbalSpots:v.exactOptional(v.array(v.object({x:number,z:number,yaw:number,scale:number})))}),{}),
  members:v.array(v.tuple([text,v.object({placements:v.array(spot)})]))}))}),
  view:v.object({smoke:v.object({centre:xyz,radius:number,attributes:v.object({aEmitter:v.array(number),aSeed:v.array(number),aCfg:v.array(number)})})})}),preparedInput);

const encoded=(raw:Uint8Array):string=>{let encodedText='';for(const byte of zlibSync(raw))encodedText+=String.fromCodePoint(byte);return btoa(encodedText);};
const id=(name:string)=>`nalati-grasslands/${name}`;
const preparedContacts=(inputs:readonly unknown[])=>{
  const contacts=v.parse(SceneDressingContactsSchema,inputs.map(input=>{const parsed=v.parse(v.looseObject({heading:v.exactOptional(v.tuple([number,number]))}),input),{heading,...contact}=parsed;return heading===undefined?contact:Object.assign(contact,{yaw:Math.atan2(...heading)});}));
  const hulls=contacts.filter(row=>row.kind==='hull');
  if(hulls.length===0||hulls.length!==contacts.length||hulls.some(row=>row.surface!=='rock'||row.yaw!==undefined||row.rot!==undefined))return contacts;
  return{kind:'packed-hulls',data:encoded(new Uint8Array(Float32Array.from(hulls.flatMap(row=>row.points)).buffer)),origins:hulls.map(row=>[row.x,row.y,row.z,row.points.length]),surface:'rock'};
};


/** Existing baked shapes and placements become Z2 rows; no page-side scatter or model constructors. */
function compileDressingScene(tier:'phone'|'desktop') {
  const phone=tier==='phone',profile=cover[tier];
  const geometry:Record<string,unknown>={},materials:Record<string,unknown>={},addresses:number[]=[];
  const baked=(url:string,offset:number,row:v.InferOutput<typeof SceneBakedGeometrySchema>)=>({kind:'baked',url,address:{file:`world/dressing-addresses-${tier}.bin`,word:addresses.push(offset)-1},row});
  const shape=(key:string)=>{const row=prepared.dressing.rows.find(candidate=>candidate.key===key);if(row===undefined)throw new Error(`Missing dressing shape ${key}`);return baked('/assets/nalati/baked/dressing.bin',row.offset,row.geometry);};
  const actor=(key:string)=>{const row=paint.rows.find(candidate=>candidate.key===key);if(row===undefined)throw new Error(`Missing dressing actor ${key}`);return{kind:'inline',data:row.data,row:row.geometry};};
  for(const key of ['boulder','boulder-tall','slab'])geometry[key]=actor(`dressing:${tier}:${key}`);
  for(const [name,key]of [['stone','stone'],['juniper','juniper'],['rose',phone?'rose:lite':'rose'],['willow','willow'],['lupin',phone?'lupin:lite':'lupin'],['daisy','daisy'],['reed','reed']])if(name!==undefined&&key!==undefined)geometry[name]=shape(key);
  for(const [name,key]of [['boulder','boulder-1'],['boulder-tall','boulder-2'],['slab','boulder-3']] as const)materials[name]={kind:'asset',row:specimens.assets[key]};
  materials['rock']={kind:'painterly',rim:.3,bands:.8};materials['shrub']={kind:'painterly',rim:.5,bands:.7,sway:.05};
  materials['flower']={kind:'painterly',rim:.45,bands:.6,sway:.3};materials['reed']={kind:'painterly',rim:.5,bands:.6,sway:.1};
  const contacts=(name:string)=>{
    const row=Object.entries(paint.contacts[tier]??{}).find(([key])=>key===name)?.[1];if(row===undefined)throw new Error(`Missing dressing contacts ${name}`);
    return{kind:'packed-hulls',data:row.points,origins:row.origins,surface:'rock'};
  };
  const layers=[
    ...(['boulder','boulder-tall','slab'] as const).map(name=>({id:`nalati-dress-${name}`,model:id(name==='boulder-tall'?'boulder':name),geometry:name,material:name,file:`world/dressing-${name==='boulder-tall'?'boulder':name}.json`,binary:false,far:phone?.6:1,castShadow:true,keepNear:40,contacts:contacts(name),
      select:{modulo:name==='slab'?1:3,remainder:name==='slab'?0:2,equal:name!=='boulder'}})),
    ...(['stone','juniper','rose','willow','lupin','daisy','reed'] as const).map(name=>({id:`nalati-dress-${name}`,model:id(({rose:'wild-rose',willow:'dwarf-willow',reed:'reed'} as Record<string,string>)[name]??name),geometry:name,material:name==='stone'?'rock':name==='reed'?'reed':name==='lupin'||name==='daisy'?'flower':'shrub',file:`world/dressing-${name}.${name==='stone'||name==='daisy'?'bin':'json'}`,binary:name==='stone'||name==='daisy',far:phone?(name==='stone'||name==='lupin'||name==='daisy'?.55:.6):1,castShadow:!phone&&['juniper','rose','willow'].includes(name),keepNear:26,contacts:[]})),
  ];
  const statics:unknown[]=['camp','bridge','roads','summerCamp','kurgans','eagleRock','cairn','crags','watchtower','dressing-statics','dressing-clutter','kokpar','outcrops'].map(name=>{
    const row=prepared.places.rows.find(candidate=>candidate.name===name),recipe=Object.entries(scenes).find(([key])=>key===name)?.[1];if(row===undefined||recipe===undefined)throw new Error('Missing dressing scene');
    const geo:Record<string,string>={},mats:Record<string,string>={};
    for(const [i,mesh]of row.meshes.entries()){
      const key=`${name}.${i}`;geometry[key]=baked('/assets/nalati/baked/places.bin',mesh.offset,mesh.geometry);geo[`mesh-${i}`]=key;mats[mesh.material]=mesh.material;
      if(mesh.material==='yard'){const path=specimens.materials['path'];if(path===undefined)throw new Error('Missing yard tile');materials['yard']={kind:'specimen',row:{...path,id:'nalati-yard',rim:0,bands:.6,transparent:true,depthWrite:false,polygonOffset:[-2,-2],textureFallback:[200,160,120,255]}};continue;}
      const material=Object.entries(specimens.materials).find(([materialKey])=>materialKey===mesh.material)?.[1];if(material===undefined)throw new Error('Missing dressing static paint');materials[mesh.material]={kind:'specimen',row:material};
    }
    const copied=structuredClone(recipe),root=copied.nodes.find(node=>node.id===copied.root);
    if(name==='roads'){
      // the signposts' painted lettering, between the posts and their wood (the atlas on the painterly material)
      const label=paint.rows.find(candidate=>candidate.key==='sign-labels:roads');if(label===undefined||root?.kind!=='group')throw new Error('Missing road lettering');
      geometry['roads.lettering']={kind:'inline',data:label.data,row:label.geometry};materials['roads.lettering']={kind:'lettering',...atlases.roads,rim:.2};geo['lettering']='roads.lettering';mats['lettering']='roads.lettering';
      copied.materials.push({kind:'port',id:'lettering',source:'lettering'});copied.nodes.push({kind:'mesh',id:'lettering',name:'nalati-signs',geometry:'lettering',material:'lettering',missing:'empty',castShadow:false,receiveShadow:true,children:[]});root.children.splice(1,0,'lettering');
    }
    for(const [index,[,instance]]of row.instances.entries()){
      if(root?.kind!=='group')throw new Error('Static instances require their declared group');
      const mesh=instance.scene.nodes.find(node=>node.id===instance.scene.root);if(mesh?.kind!=='mesh')throw new Error('Static asset instance needs its declared mesh');
      const key=`${name}.instance.${index}`;geometry[key]={kind:'asset',row:instance.asset};materials[key]={kind:'asset',row:instance.asset};geo[key]=key;mats[key]=key;
      copied.materials.push({kind:'port',id:key,source:key});copied.nodes.push({...mesh,id:key,geometry:key,material:key});root.children.push(key);
    }
    return{name,recipe:copied,geometry:geo,materials:mats,anchors:placeAnchors(name),tris:row.tris+(name==='kokpar'?6*(phone?metrics.farTriangles['kokpar-rider']:metrics.triangles['kokpar-rider']):0),members:row.members.map(([model,member])=>({model,draw:member.draw,placements:member.placements,boxes:member.boxes,floors:member.floors,contacts:preparedContacts([...member.solid,...member.descs])}))};
  });
  const cloth=clothGeometry();geometry['cloth']={kind:'inline',...cloth};materials['cloth']={kind:'look',look:'nalati-cloth'};
  statics.push({name:'cloth',recipe:{version:1,root:'root',materials:[{kind:'port',id:'paint',source:'paint'}],nodes:[{kind:'group',id:'root',children:['cloth']},{kind:'mesh',id:'cloth',geometry:'shape',material:'paint',missing:'empty',castShadow:true,receiveShadow:true}]},geometry:{shape:'cloth'},materials:{paint:'cloth'},tris:cloth.row.indexCount/3,members:[]});
  geometry['wing']={kind:'packed',source:'cover',key:'wing'};geometry['halfBird']={kind:'packed',source:'cover',key:'halfBird'};
  materials['butterfly']={kind:'painterly',rim:.3,bands:.5,shade:.6,emissive:0x101010};materials['raptor']={kind:'painterly',rim:.6,bands:.6};
  const bowl=bowlScene(tier,geometry,materials);statics.push(...bowl.statics);
  const crags=cragRows[tier],cragGeometry:Record<string,string>={};
  for(const part of crags.meshes){geometry[part.key]=baked('/assets/nalati/baked/crags.bin',part.offset,v.parse(SceneBakedGeometrySchema,part.row));cragGeometry[part.key]=part.key;}
  const rockTexture=specimens.materials['rock']?.texture,snowTexture=specimens.materials['snow']?.texture;
  if(rockTexture===undefined||snowTexture===undefined)throw new Error('Missing prepared crag tiles');
  materials['crag']={kind:'look',look:phone?'nalati-crag-phone':'nalati-crag',params:{rockMean:paintedTextures.mean.rock,scale:[1/paintedTextures.metres.rock,1/paintedTextures.metres.snow],snowBand:[layout.SNOW_LINE-14,layout.SNOW_LINE-2]},textures:{rock:rockTexture,snow:snowTexture}};
  const firstCrag=crags.meshes[0];if(firstCrag===undefined)throw new Error('Missing prepared crag shape');
  const cragModel={model:{id:'nalati-grasslands/crag-rock',name:'Crag rock',category:'nature',pipeline:'code',file:'src/shards/nalati-grasslands/generators/bake-crag-rock.mjs',surface:'rock',defaults:{kind:'fin'},variants:[{id:'fin',label:'Fin',params:{}},{id:'rib',label:'Rib',params:{kind:'rib'}},{id:'tower',label:'Tower',params:{kind:'tower'}}]},geometry:firstCrag.key,material:'crag'};
  const cragPoints=Float32Array.from(crags.hulls.flatMap(row=>row.points)),cragContacts={kind:'packed-hulls',data:encoded(new Uint8Array(cragPoints.buffer)),origins:crags.hulls.map(row=>[row.x,row.y,row.z,row.points.length]),surface:'rock'};
  statics.push({name:'cragRocks',recipe:crags.recipe,geometry:cragGeometry,materials:{crag:'crag'},tris:crags.triangles,members:[{model:'nalati-grasslands/crag-rock',draw:'merged',placements:crags.placements,boxes:crags.boxes,contacts:cragContacts}]});
  const result={instances:bowl.instances,staticModels:[...bowl.staticModels,cragModel],name:'nalati-dressing',catalogues:[{rows:specimens.catalogue,packed:specimens.packed,materials:specimens.materials},{rows:balbal.catalogue},{rows:profile.catalogue,pack:'cover'}],packs:{cover:{rows:profile.packed,materials:cover.materials}},geometry,materials,layers,statics,
    wings:{groups:profile.life,layers:[{id:'butterfly',capacity:cover.butterflies[tier],palette:cover.hue,flap:[12,1.15,.25],geometry:'wing',material:'butterfly'},{id:'raptor',capacity:cover.raptors,palette:[],flap:null,geometry:'halfBird',material:'raptor'}]},
    sites:[{name:'balbals',model:'nalati-grasslands/balbal',rows:{...balbal.sites,generated:balbal.generated,sites:placed.places.rows.find(row=>row.name==='kurgans')?.anchors.balbalSpots??[]}}],
    emitters:[{name:'nalati-smoke',look:'nalati-camp-smoke',renderOrder:3,centre:placed.view.smoke.centre,radius:placed.view.smoke.radius,
      attributes:{aEmitter:{width:3,values:placed.view.smoke.attributes.aEmitter},aSeed:{width:4,values:placed.view.smoke.attributes.aSeed},aCfg:{width:4,values:placed.view.smoke.attributes.aCfg}},
      params:{wind:'wind',windClamp:8,shade:'shade',sun:'sunColour'}}],
    motes:{name:'nalati-dress-pollen',count:phone?380:900,seed:0x9011e,look:'nalati-motes',drift:.35,driftParam:'drift',pixelParam:'px'},animations:[{look:'nalati-cloth',timeParam:'clothTime',windParam:'clothWind',windScale:.7,windMax:1.2}]};
  const payload:unknown=JSON.parse(encodeCanonicalJson(result)),bytes=new Uint8Array(addresses.length*4),view=new DataView(bytes.buffer);
  addresses.forEach((offset,word)=>{if(!Number.isSafeInteger(offset)||offset<0||offset>0xffffffff)throw new Error('Invalid baked source address');view.setUint32(word*4,offset,true);});
  return{rows:v.parse(SceneDressingSchema,payload),addresses:bytes};
}

/** The places' gameplay anchors: the great kurgan's entrance, the crag ledges and the Wind Cairn's tie spot (3.6 m east, at its foot). */
function placeAnchors(name:string):Record<string,{x:number;y:number;z:number;r?:number;facing?:number}[]>{
  const row=placed.places.rows.find(candidate=>candidate.name===name),anchors=row?.anchors;
  if(name==='kurgans'&&anchors?.entrance!==undefined)return{entrance:[anchors.entrance]};
  if(name==='crags'&&anchors?.ledges!==undefined)return{ledges:anchors.ledges};
  const foot=row?.members.find(([model])=>model==='nalati-grasslands/wind-cairn')?.[1].placements[0];
  return name==='cairn'&&foot!==undefined?{tie:[{x:foot.x+3.6,y:foot.y,z:foot.z}]}:{};
}

/** Capture static strip attributes once; the existing cloth graph owns all movement. */
function clothGeometry(){
  // the places' own cloth (camp pole, yurt crowns, the cairn's strips) joins the dressing's in the one mesh
  const sources=['camp','summerCamp','eagleRock','cairn','dressing-statics','kokpar'].map(name=>{const row=prepared.places.rows.find(candidate=>candidate.name===name);if(row===undefined)throw new Error('Missing dressing cloth');return row;});
  const A:number[]=[],S:number[]=[],P:number[]=[],F:number[]=[],col:number[]=[],index:number[]=[],bounds=new THREE.Box3();let strips=0,maxLen=0;
  for(const effect of sources.flatMap(row=>row.effects)){
    const [kind,point]=effect;const a=effect[2],b=effect[3],color=effect[4],options=effect[5];
    if(kind==='emitter')continue;
    if(typeof a!=='number'||typeof b!=='number'||!(typeof color==='string'||typeof color==='number'))throw new Error('Invalid cloth rows');
    const x=point[0],y=point[1],z=point[2],opts=v.parse(v.record(v.string(),v.unknown()),options??{}),get=(key:string,base:number)=>{const value=opts[key];return typeof value==='number'?value:base;};
    const len=kind==='flag'?b:a,w=kind==='flag'?0:b,span=kind==='flag'?[0,-a,0]:kind==='strip'?[b,0,0]:[0,0,b];
    const droop=kind==='strip'?.8:get('droop',kind==='flag'?.25:.45),taper=kind==='strip'?.2:get('taper',kind==='flag'?0:.35);
    const phase=(x*1.7+z*2.3+strips*.61)%(Math.PI*2),seg=Math.max(2,Math.min(14,Math.round(len*5))),rows=seg+1,v0=A.length/4,c=new THREE.Color(color);strips++;bounds.expandByPoint(new THREE.Vector3(x,y,z));
    for(let i=0;i<seg;i++){const vertex=v0+i*2,bk=vertex+rows*2;index.push(vertex,vertex+2,vertex+1,vertex+1,vertex+2,vertex+3,bk,bk+1,bk+2,bk+1,bk+3,bk+2);}
    for(const face of[1,-1])for(let i=0;i<rows;i++)for(let j=0;j<2;j++){const shade=.92+.08*(1-i/rows);A.push(x,y,z,phase);S.push(...span,w);P.push(len,droop,taper,i/seg);F.push(j,face);col.push(c.r*shade,c.g*shade,c.b*shade);}
    maxLen=Math.max(maxLen,len+Math.hypot(...span)+w);
  }
  const geometry=new THREE.BufferGeometry();for(const name of ['position','normal'])geometry.setAttribute(name,new THREE.Float32BufferAttribute(new Float32Array(A.length/4*3),3));
  for(const[name,data,width]of[['aClothA',A,4],['aClothS',S,4],['aClothP',P,4],['aClothF',F,2],['color',col,3]]as const)geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,width));geometry.setIndex(index);
  const sphere=new THREE.Sphere();bounds.getBoundingSphere(sphere);sphere.radius+=maxLen;
  const blocks:Uint8Array[]=[],row=writeGeometry(geometry,blocks,'dressing cloth');geometry.dispose();
  return{row,data:encoded(join(blocks)),sphere:[sphere.center.x,sphere.center.y,sphere.center.z,sphere.radius]};
}

/** Tier rows are separate JSON loans, keeping the unchanged bounded JSON budget. */
export function dressingSceneBlobs():ReturnType<typeof nameBlob>[] {return(['phone','desktop']as const).flatMap(tier=>{const result=compileDressingScene(tier);return[nameBlob(`world/dressing-${tier}.json`,'json',new TextEncoder().encode(encodeCanonicalJson(result.rows)),{jsonSchema:namedJsonSchema(SceneDressingSchema)}),nameBlob(`world/dressing-addresses-${tier}.bin`,'bin',result.addresses)];});}

/** Admitted tier rows for catalogue and format consumers. */
export function dressingScene(tier:'phone'|'desktop'):SceneDressingRows{return compileDressingScene(tier).rows;}

/** Decorative poses keep the existing visual programs and RNG continuation; none owns gameplay actors. */
function bowlScene(tier:'phone'|'desktop',geometry:Record<string,unknown>,materials:Record<string,unknown>){
  const phone=tier==='phone',data=decorative[tier],statics:unknown[]=[],instances:unknown[]=[];
  const empty=(name:string,tris:number,members:unknown[],groupName=`nalati-${name}`)=>({name,tris,members,geometry:{},materials:{},recipe:{version:1,root:'root',materials:[],nodes:[{kind:'group',id:'root',name:groupName,children:[]}]}});
  const putMember=(model:string,member:typeof data.horses.member)=>({model,draw:member.draw,placements:member.placements,boxes:member.boxes,contacts:[...member.solid,...member.descs]});
  statics.push(empty('farHerds',data.horses.total*metrics.farTriangles['horse-wild'],[putMember('nalati-grasslands/herd-horse',data.horses.member)],'nalati-far-herds'));
  geometry['herd-horse']={kind:'asset',row:specimens.assets['herdHorse']};materials['herd-horse']={kind:'asset',row:specimens.assets['herdHorse']};
  const blocked=[...POI_CLEARINGS.map(row=>({x:row.x,z:row.z,r:row.r+4})),...KURGANS.map(row=>({x:row.x,z:row.z,r:row.r+3})),{x:SUMMER_YURTS.x,z:SUMMER_YURTS.z,r:20}];
  const palette=[[.78,.55,.42],[1,.62,.42],[1,1,1],[1.25,1.22,1.18],[.32,.3,.3],[1.15,1.08,.95]];
  const drift=NALATI_FAR_HERD_CHANNELS[0],commit=NALATI_FAR_HERD_CHANNELS[1];if(drift===undefined||commit===undefined)throw new Error('Missing decorative pose programs');
  for(const [index,herd]of data.horses.herds.entries()){
    const state=(slot:number)=>({kind:'state',slot}),frame=(property:string)=>({kind:'frame',property}),constant=(value:number)=>({kind:'constant',value});
    instances.push({id:`nalati-far-herd.${index}`,name:'nalati-far-herd',group:'farHerds',geometry:'herd-horse',material:'herd-horse',step:.25,initialCredit:1,clock:'elapsed',random:{id:'far-herds',state:data.horses.random},
      states:herd.horses.map(h=>[h.x,h.z,h.yaw,h.turn,h.speed,h.s,h.c]),pose:{x:0,z:1,yaw:2,scale:5,colour:6},blocked,palette,ground:-.04,near:45,far:phone?165+herd.r:null,
      bounds:[herd.x,1,herd.z,herd.r*1.6+6],groundBounds:true,castShadow:false,receiveShadow:true,attributes:[],
      programs:[{row:drift,inputs:[state(0),state(1),state(2),state(3),state(4),constant(herd.x),constant(herd.z),constant(herd.r),{kind:'random'}],outputs:[]},
        {row:commit,inputs:[state(0),state(1),frame('yaw'),frame('x'),frame('z'),frame('turn'),{kind:'blocked'}],outputs:[{property:'x',slot:0},{property:'z',slot:1},{property:'yaw',slot:2},{property:'turn',slot:3}]}]});
  }
  const riders=prepared.places.rows.find(row=>row.name==='kokpar')?.anchors.riders;if(riders===undefined)throw new Error('Missing declared riders');
  const asset=phone?specimens.assets['kokparRiderFar']:specimens.assets['kokparRider'];geometry['riders']={kind:'asset',row:asset};materials['riders-source']={kind:'asset',row:asset};materials['riders']={kind:'mapped',look:'nalati-riders',over:'riders-source'};
  instances.push({id:'nalati-kokpar-riders',group:'kokpar',geometry:'riders',material:'riders',step:0,initialCredit:0,clock:'world',states:riders.map((r,i)=>[r.t,r.k,r.w,i,0,0,0,0,0,0]),pose:{x:4,z:5,yaw:6,y:7,pitch:8,roll:9},
    blocked:[],palette:[],ground:0,near:0,far:null,bounds:[KOKPAR.x,1.5,KOKPAR.z,Math.max(KOKPAR.rx,KOKPAR.rz)+5],groundBounds:true,castShadow:!phone,receiveShadow:true,
    uniform:{look:'nalati-riders',param:'clock'},attributes:[{name:'aPhase',width:1,values:riders.map((_,i)=>i*1.7)}],programs:[{row:kokparPose(),inputs:[{kind:'state',slot:0},{kind:'state',slot:1},{kind:'state',slot:2},{kind:'state',slot:3}],outputs:[{property:'value',slot:0},{property:'x',slot:4},{property:'z',slot:5},{property:'yaw',slot:6},{property:'y',slot:7},{property:'pitch',slot:8},{property:'roll',slot:9}]}]});
  geometry['snow-lotus']={kind:'asset',row:specimens.assets['snowLotus']};materials['snow-lotus']={kind:'asset',row:specimens.assets['snowLotus']};
  const lotusScene=structuredClone(v.parse(PrivateSceneSchema,data.lotus.scene));lotusScene.nodes.push({kind:'group',id:'root',name:'nalati-snow-lotus',children:[lotusScene.root]});lotusScene.root='root';
  statics.push({name:'snowLotus',tris:data.lotus.poses.length*metrics.triangles['snow-lotus'],members:[putMember('nalati-grasslands/snow-lotus',data.lotus.member)],recipe:lotusScene,geometry:{model:'snow-lotus'},materials:{material:'snow-lotus'}});
  const fixed=paint.rows.find(row=>row.key==='glacier-snout:world'),specimen=paint.rows.find(row=>row.key==='glacier-snout:specimen');if(fixed===undefined||specimen===undefined)throw new Error('Missing glacier shapes');
  geometry['glacier']={kind:'inline',data:fixed.data,row:fixed.geometry};geometry['glacier-specimen']={kind:'inline',data:specimen.data,row:specimen.geometry};
  const raw=unzlibSync(Uint8Array.from(atob(fixed.data),c=>c.codePointAt(0)??0)),positions=fixed.geometry.attrs[0];
  if(positions?.[0]!=='position'||positions[1]!=='f32'||positions[2]!==3||positions[3])throw new Error('Glacier bounds require its first float32 position channel');
  const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),box=new THREE.Box3(),point=new THREE.Vector3();
  for(let i=0;i<fixed.geometry.count;i++)box.expandByPoint(point.set(view.getFloat32(i*12,true),view.getFloat32(i*12+4,true),view.getFloat32(i*12+8,true)));
  const boxes=[box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z];
  const staticModels=[{model:{id:'nalati-grasslands/glacier-snout',name:'Glacier snout',category:'nature',pipeline:'code',file:'src/shards/nalati-grasslands/generators/dressingScene.ts',surface:'ground',defaults:{}},geometry:'glacier-specimen',material:'poi'}];
  statics.push({name:'glacier',tris:fixed.geometry.indexCount/3,geometry:{shape:'glacier'},materials:{paint:'poi'},recipe:{version:1,root:'root',materials:[{kind:'port',id:'paint',source:'paint'}],nodes:[{kind:'mesh',id:'root',name:'nalati-glacier',geometry:'shape',material:'paint',missing:'empty',receiveShadow:true,castShadow:false}]},members:[{model:'nalati-grasslands/glacier-snout',draw:'single',placements:[paint.glacierSnout],boxes,contacts:[]}]});
  return{statics,staticModels,instances};
}

function kokparPose(){
  const b=new ClientChannels('nalati-kokpar.pose'),initial=b.read('t'),k=b.read('k'),speed=b.read('w'),index=b.read('i');
  const c=(value:number)=>b.constant(value),add=(a:number,z:number)=>b.binary('add',a,z),sub=(a:number,z:number)=>b.binary('sub',a,z),mul=(a:number,z:number)=>b.binary('mul',a,z),sin=(a:number)=>b.unary('sin',a),cos=(a:number)=>b.unary('cos',a);
  const t=add(initial,mul(speed,b.clock('delta'))),rc=c(Math.cos(KOKPAR.rot)),rs=c(Math.sin(KOKPAR.rot)),lx=mul(mul(cos(t),c(KOKPAR.rx)),k),lz=mul(mul(sin(t),c(KOKPAR.rz)),k),tx=mul(sin(t),c(-KOKPAR.rx)),tz=mul(cos(t),c(KOKPAR.rz));
  const phase=add(mul(b.clock('time'),c(2.2*Math.PI*2)),mul(index,c(1.7)));
  b.output('value',t);b.output('x',add(add(c(KOKPAR.x),mul(lx,rc)),mul(lz,rs)));b.output('z',add(sub(c(KOKPAR.z),mul(lx,rs)),mul(lz,rc)));
  b.output('yaw',add(b.binary('atan2',add(mul(tx,rc),mul(tz,rs)),add(mul(tx,c(-Math.sin(KOKPAR.rot))),mul(tz,rc))),mul(sin(phase),c(.025))));
  b.output('y',sub(mul(add(c(.5),mul(c(.5),sin(sub(mul(phase,c(2)),c(.4))))),c(.16)),c(.06)));
  b.output('roll',add(c(-.14),mul(sin(phase),c(.03))));b.output('pitch',mul(sin(add(phase,c(1.1))),c(.07)));return b.build();
}
