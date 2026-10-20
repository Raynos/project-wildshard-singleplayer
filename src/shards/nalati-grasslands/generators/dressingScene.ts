import * as THREE from 'three';
import { zlibSync } from 'fflate';
import { SceneDressingSchema, SceneBakedGeometrySchema, SceneDressingContactsSchema, type SceneDressingRows } from '@wildshard/format/sceneDressing';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { nameBlob } from '@wildshard/sdk/blobs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { writeGeometry, join } from './geometryWriter';
import preparedInput from '../data/placeRuntime.generated.json' with {type:'json'};
import scenesInput from '../data/poiScenes.generated.json' with {type:'json'};
import specimensInput from '../data/specimens.generated.json' with {type:'json'};
import paintInput from '../data/poiPaint.json' with {type:'json'};
import coverInput from '../data/cover.generated.json' with {type:'json'};
import * as v from 'valibot';
import { SpecimenCatalogueSchema, PackedSpecimenSchema, SpecimenMaterialSchema, SpecimenAssetSchema } from '@wildshard/format/specimenCatalogue';
import { AmbientFlockSchema, AmbientPerchesSchema } from '@wildshard/format/ambientLife';
import { PrivateSceneSchema } from '@wildshard/format/clientChannels';

const text=v.string(),number=v.number(),xyz=v.tuple([number,number,number]);
const memberSchema=v.object({draw:v.picklist(['instanced','merged']),placements:v.array(v.object({x:number,y:number,z:number,yaw:v.exactOptional(number),heading:v.exactOptional(v.tuple([number,number])),matrix:v.exactOptional(v.array(number))})),boxes:v.array(number),floors:v.array(v.unknown()),solid:SceneDressingContactsSchema,descs:SceneDressingContactsSchema});
const place=v.object({name:text,tris:number,effects:v.array(v.tupleWithRest([text,xyz],v.unknown())),members:v.array(v.tuple([text,memberSchema])),meshes:v.array(v.object({material:text,offset:number,geometry:SceneBakedGeometrySchema}))});
const preparedSchema=v.object({places:v.object({rows:v.array(place)}),dressing:v.object({rows:v.array(v.object({key:text,offset:number,geometry:SceneBakedGeometrySchema}))})});
const materialsSchema=v.record(text,SpecimenMaterialSchema);
const specimensSchema=v.object({catalogue:SpecimenCatalogueSchema,packed:PackedSpecimenSchema,materials:materialsSchema,assets:v.record(text,SpecimenAssetSchema)});
const profileSchema=v.object({catalogue:SpecimenCatalogueSchema,packed:PackedSpecimenSchema,life:v.array(v.object({kind:text,row:AmbientFlockSchema,perches:AmbientPerchesSchema}))});
const coverSchema=v.object({phone:profileSchema,desktop:profileSchema,materials:materialsSchema,butterflies:v.object({phone:number,desktop:number}),hue:v.array(v.union([text,number])),raptors:number});
const paintSchema=v.object({rows:v.array(v.object({key:text,data:text,geometry:SceneBakedGeometrySchema})),contacts:v.record(text,v.record(text,v.object({points:text,origins:v.array(v.tuple([number,number,number,number]))})))});
// Shared authoring metadata is emitted alongside the runtime boot descriptors.
const prepared=v.parse(preparedSchema,preparedInput);
const scenes=v.parse(v.record(text,PrivateSceneSchema),scenesInput);
const specimens=v.parse(specimensSchema,specimensInput);
const paint=v.parse(paintSchema,paintInput);
const cover=v.parse(coverSchema,coverInput);

const encoded=(raw:Uint8Array):string=>{let encodedText='';for(const byte of zlibSync(raw))encodedText+=String.fromCodePoint(byte);return btoa(encodedText);};
const id=(name:string)=>`nalati-grasslands/${name}`;

/** Existing baked shapes and placements become Z2 rows; no page-side scatter or model constructors. */
export function dressingScene(tier:'phone'|'desktop'):SceneDressingRows {
  const phone=tier==='phone',profile=cover[tier];
  const geometry:Record<string,unknown>={},materials:Record<string,unknown>={};
  const shape=(key:string)=>{const row=prepared.dressing.rows.find(candidate=>candidate.key===key);if(row===undefined)throw new Error(`Missing dressing shape ${key}`);return{kind:'baked',url:'/assets/nalati/baked/dressing.bin',offset:row.offset,row:row.geometry};};
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
  const statics:unknown[]=['dressing-statics','dressing-clutter'].map(name=>{
    const row=prepared.places.rows.find(candidate=>candidate.name===name),recipe=Object.entries(scenes).find(([key])=>key===name)?.[1];if(row===undefined||recipe===undefined)throw new Error('Missing dressing scene');
    const geo:Record<string,string>={},mats:Record<string,string>={};
    for(const [i,mesh]of row.meshes.entries()){
      const key=`${name}.${i}`;geometry[key]={kind:'baked',url:'/assets/nalati/baked/places.bin',offset:mesh.offset,row:mesh.geometry};geo[`mesh-${i}`]=key;mats[mesh.material]=mesh.material;
      const material=Object.entries(specimens.materials).find(([materialKey])=>materialKey===mesh.material)?.[1];if(material===undefined)throw new Error('Missing dressing static paint');materials[mesh.material]={kind:'specimen',row:material};
    }
    return{name,recipe,geometry:geo,materials:mats,tris:row.tris,members:row.members.map(([model,member])=>{if(member.floors.length>0)throw new Error('Dressing needs a declared floor');return{model,draw:member.draw,placements:member.placements,boxes:member.boxes,contacts:[...member.solid,...member.descs]};})};
  });
  const cloth=clothGeometry();geometry['cloth']={kind:'inline',...cloth};materials['cloth']={kind:'look',look:'nalati-cloth'};
  statics.push({name:'cloth',recipe:{version:1,root:'root',materials:[{kind:'port',id:'paint',source:'paint'}],nodes:[{kind:'group',id:'root',children:['cloth']},{kind:'mesh',id:'cloth',geometry:'shape',material:'paint',missing:'empty',castShadow:true,receiveShadow:true}]},geometry:{shape:'cloth'},materials:{paint:'cloth'},tris:cloth.row.indexCount/3,members:[]});
  geometry['wing']={kind:'packed',source:'cover',key:'wing'};geometry['halfBird']={kind:'packed',source:'cover',key:'halfBird'};
  materials['butterfly']={kind:'painterly',rim:.3,bands:.5,shade:.6,emissive:0x101010};materials['raptor']={kind:'painterly',rim:.6,bands:.6};
  const result={name:'nalati-dressing',catalogues:[{rows:specimens.catalogue,packed:specimens.packed,materials:specimens.materials},{rows:profile.catalogue,packed:profile.packed,materials:cover.materials}],packs:{cover:{rows:profile.packed,materials:cover.materials}},geometry,materials,layers,statics,
    wings:{groups:profile.life,layers:[{id:'butterfly',capacity:cover.butterflies[tier],palette:cover.hue,flap:[12,1.15,.25],geometry:'wing',material:'butterfly'},{id:'raptor',capacity:cover.raptors,palette:[],flap:null,geometry:'halfBird',material:'raptor'}]},
    motes:{name:'nalati-dress-pollen',count:phone?380:900,seed:0x9011e,look:'nalati-motes',drift:.35,driftParam:'drift',pixelParam:'px'},animations:[{look:'nalati-cloth',timeParam:'clothTime',windParam:'clothWind',windScale:.7,windMax:1.2}]};
  const payload:unknown=JSON.parse(encodeCanonicalJson(result));return v.parse(SceneDressingSchema,payload);
}

/** Capture static strip attributes once; the existing cloth graph owns all movement. */
function clothGeometry(){
  const source=prepared.places.rows.find(row=>row.name==='dressing-statics');if(source===undefined)throw new Error('Missing dressing cloth');
  const A:number[]=[],S:number[]=[],P:number[]=[],F:number[]=[],col:number[]=[],index:number[]=[],bounds=new THREE.Box3();let strips=0,maxLen=0;
  for(const effect of source.effects){
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
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(A.length/4*3),3));
  for(const[name,data,width]of[['aClothA',A,4],['aClothS',S,4],['aClothP',P,4],['aClothF',F,2],['color',col,3]]as const)geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,width));geometry.setIndex(index);
  const sphere=new THREE.Sphere();bounds.getBoundingSphere(sphere);sphere.radius+=maxLen;
  const blocks:Uint8Array[]=[],row=writeGeometry(geometry,blocks,'dressing cloth');geometry.dispose();
  return{row,data:encoded(join(blocks)),sphere:[sphere.center.x,sphere.center.y,sphere.center.z,sphere.radius]};
}

/** Tier rows are separate JSON loans, keeping the unchanged bounded JSON budget. */
export function dressingSceneBlobs():ReturnType<typeof nameBlob>[] {return(['phone','desktop']as const).map(tier=>nameBlob(`world/dressing-${tier}.json`,'json',new TextEncoder().encode(encodeCanonicalJson(dressingScene(tier))),{jsonSchema:namedJsonSchema(SceneDressingSchema)}));}
