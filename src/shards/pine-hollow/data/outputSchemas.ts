import * as v from 'valibot';

// JSON-Schema-expressible structure. The full public validators also run before
// author emission and again against the copied runtime registry at publication.
const textNode = v.pipe(v.string(),v.maxLength(512));
const indexNode = v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(127));
const tripleNode = v.tuple([indexNode,indexNode,indexNode]);
const coeffNode = v.number();
const axisNode = v.tuple([coeffNode,coeffNode,coeffNode]);
const propertyNode = v.picklist(['x','y','z','yaw','pitch','roll','scaleX','scaleY','scaleZ','value','turn','visible']);
const exprNode = v.variant('op',[
 v.strictObject({op:v.literal('constant'),value:coeffNode}),v.strictObject({op:v.literal('clock'),value:v.picklist(['time','delta'])}),
 v.strictObject({op:v.picklist(['read','local']),index:indexNode}),
 v.strictObject({op:v.picklist(['neg','sin','cos','sqrt','abs']),a:indexNode}),
 v.strictObject({op:v.picklist(['add','sub','mul','div','mod','min','max','atan2','hypot','gt']),a:indexNode,b:indexNode}),
 v.strictObject({op:v.literal('hypot3'),a:indexNode,b:indexNode,c:indexNode}),
 v.strictObject({op:v.literal('sample'),a:indexNode,interpolation:v.picklist(['linear','smoothstep']),keys:v.pipe(v.array(v.tuple([coeffNode,coeffNode])),v.minLength(2),v.maxLength(32))}),
 v.strictObject({op:v.literal('select'),test:indexNode,yes:indexNode,no:indexNode}),
]);
const initialNode=v.variant('op',[v.strictObject({op:v.literal('constant'),value:coeffNode}),v.strictObject({op:v.literal('read'),index:indexNode})]);
const tubeNode=v.strictObject({kind:v.literal('tubeCurve'),target:textNode,segments:indexNode,radial:indexNode,from:tripleNode,to:tripleNode,extent:indexNode,wave:indexNode,
 bend:v.tuple([coeffNode,coeffNode]),ripple:axisNode,drop:v.tuple([coeffNode,coeffNode]),radius:v.tuple([coeffNode,coeffNode,coeffNode,coeffNode,coeffNode])});
const connectorNode=v.strictObject({target:textNode,from:tripleNode,to:tripleNode,at:v.exactOptional(tripleNode),scale:tripleNode,enabled:indexNode,aim:v.exactOptional(axisNode),
 turn:v.exactOptional(v.strictObject({axis:axisNode,radians:coeffNode,alternate:v.boolean()})),
 instances:v.exactOptional(v.strictObject({start:coeffNode,capacity:coeffNode,pitch:v.exactOptional(coeffNode)})),cache:v.exactOptional(indexNode)});
const programNode=v.strictObject({id:textNode,geometry:v.exactOptional(tubeNode),connectors:v.exactOptional(v.pipe(v.array(connectorNode),v.maxLength(32))),
 bindings:v.exactOptional(v.pipe(v.array(v.strictObject({property:propertyNode,target:textNode,order:v.exactOptional(v.picklist(['XYZ','YXZ','ZXY','ZYX','YZX','XZY']))})),v.maxLength(12))),
 reads:v.pipe(v.array(textNode),v.maxLength(32)),locals:v.exactOptional(v.pipe(v.array(v.strictObject({initial:initialNode,next:indexNode})),v.maxLength(8))),
 nodes:v.pipe(v.array(exprNode),v.minLength(1),v.maxLength(128)),channels:v.pipe(v.array(v.strictObject({property:propertyNode,value:indexNode})),v.maxLength(12))});
const Channels=v.pipe(v.array(programNode),v.maxLength(512));
const scenePose={children:v.array(textNode),position:v.exactOptional(axisNode),rotation:v.exactOptional(axisNode),scale:v.exactOptional(axisNode),order:v.exactOptional(v.picklist(['XYZ','YXZ','ZXY','ZYX','YZX','XZY'])),visible:v.exactOptional(v.boolean()),castShadow:v.exactOptional(v.boolean()),receiveShadow:v.exactOptional(v.boolean()),frustumCulled:v.exactOptional(v.boolean()),renderOrder:v.exactOptional(coeffNode)};
const PrivateSceneSchema=v.strictObject({version:v.literal(1),root:textNode,nodes:v.pipe(v.array(v.variant('kind',[
 v.strictObject({kind:v.literal('group'),id:textNode,...scenePose}),v.strictObject({kind:v.literal('mesh'),id:textNode,geometry:textNode,material:textNode,missing:v.picklist(['empty','group','omit']),...scenePose}),
 v.strictObject({kind:v.literal('object'),id:textNode,source:textNode,missing:v.picklist(['omit','refuse']),...scenePose}),
])),v.maxLength(128)),materials:v.array(v.strictObject({kind:v.literal('port'),id:textNode,source:textNode})),textures:v.pipe(v.array(textNode),v.maxLength(0))});
const rangeNode=v.tuple([coeffNode,coeffNode]),postureNode=v.tuple([coeffNode,coeffNode,coeffNode,coeffNode,coeffNode,coeffNode]);
const foragerPolicy=v.strictObject({scare:rangeNode,alertMargin:coeffNode,releaseMargin:coeffNode,fleeDistance:rangeNode,fleePause:rangeNode,alertPause:rangeNode,grazePause:rangeNode,settlePause:rangeNode,turn:rangeNode,
 grazing:v.strictObject({chance:coeffNode,length:rangeNode,duration:coeffNode,height:coeffNode}),escape:v.strictObject({length:coeffNode,duration:coeffNode,height:coeffNode,zigSteps:rangeNode,spread:rangeNode,steer:coeffNode}),posture:v.strictObject({graze:postureNode,alert:postureNode,flee:postureNode})});
const ForestLifeSchema=v.strictObject({kind:v.literal('forest-community'),seed:coeffNode,
 scavenger:v.strictObject({model:coeffNode,count:coeffNode,scale:coeffNode,stand:coeffNode,flush:coeffNode,flushRun:coeffNode,reland:coeffNode,arrival:rangeNode,visitors:v.record(textNode,coeffNode),defaultVisitors:coeffNode,bodyWidths:v.record(textNode,coeffNode),giveUp:coeffNode}),
 perches:v.strictObject({step:coeffNode,spines:v.array(v.array(v.strictObject({y:coeffNode,cx:coeffNode,cz:coeffNode,r:coeffNode})))}),
 sentinel:v.strictObject({model:coeffNode,scale:coeffNode,stand:coeffNode}),trunkForager:v.strictObject({model:coeffNode}),forager:v.strictObject({model:coeffNode,count:coeffNode,scale:coeffNode,range:coeffNode,visibleRange:coeffNode,policy:foragerPolicy}),
 guide:v.strictObject({count:coeffNode,policy:v.strictObject({distance:v.literal('centre'),min:coeffNode,max:coeffNode,schedule:v.strictObject({kind:v.literal('periodic'),initial:coeffNode,period:rangeNode})})}),
 flight:v.strictObject({wave:coeffNode,amplitude:coeffNode,pitch:coeffNode,pitchRate:coeffNode,bank:coeffNode,bankLimit:coeffNode,bankRate:coeffNode}),
 wingbeats:v.record(textNode,v.strictObject({phase:v.array(coeffNode),amplitude:coeffNode,foldPhase:coeffNode,foldAmplitude:coeffNode,rest:rangeNode,rates:rangeNode,glide:rangeNode,beats:rangeNode})),
 harvest:v.strictObject({len:coeffNode,kneelIn:coeffNode,cuts:v.array(coeffNode),rise:coeffNode}),system:v.strictObject({id:textNode,ambient:textNode,after:v.array(textNode),before:v.array(textNode)}),debug:v.strictObject({id:textNode,window:textNode}),
 sounds:v.strictObject({pair:textNode,call:textNode,flap:textNode,hoot:textNode,foragerCall:textNode,drum:textNode,cutA:textNode,cutB:textNode}),taps:v.strictObject({knock:textNode,drum:textNode,perch:textNode})});

const text = v.pipe(v.string(), v.maxLength(512));
const number = v.number();
const natural = v.pipe(v.number(), v.integer(), v.minValue(0));
const strings = v.pipe(v.array(text), v.maxLength(8192));
const rect = v.tuple([number, number, number, number]);
const path = v.pipe(v.array(v.union([text, natural])), v.minLength(1), v.maxLength(16));
const input = v.strictObject({ input: text, owner: text, path });
const inputs = v.pipe(v.array(input), v.maxLength(128));
const outputPath = v.pipe(v.array(text), v.minLength(1), v.maxLength(16));
const output = v.strictObject({ property: v.picklist(['x','y','z','yaw','pitch','roll','scaleX','scaleY','scaleZ','visible','value','turn']), target: text, path: outputPath });
const outputs = v.pipe(v.array(output), v.maxLength(128));
const pool = v.strictObject({ url: text, parts: strings });
const skinPickup = v.strictObject({ options: v.strictObject({ tier: text, prompt: text, scale: number }),
  toss: v.strictObject({ horizontal: number, up: number }), walkIn: v.nullable(v.strictObject({ radius: number, height: number })), takenGrace: number,
  unique: v.boolean(), disposeItemOnTake: v.boolean(), retireBeforeCallback: v.boolean() });
const icon = v.picklist(['deer','boar','elk','bear','ghost','ironhide','claw','antlers','poi','laurel','rope','seaglass','coin','check','lock','tusk','longbow']);
const feat = v.strictObject({ id: text, name: text, goal: text, count: natural, kind: v.exactOptional(text), variant: v.exactOptional(text), event: v.exactOptional(text), title: text, icon });
const bagItem = v.strictObject({ id: text, label: text, icon, travels: v.boolean() });
const packedGeometry = v.strictObject({ attrs: v.array(v.tuple([text,natural])), count: natural, unique: natural,
  own: v.nullable(v.picklist(['u16','u32'])), indexCount: natural });
const mountPack = v.strictObject({ notice:text, url:text, sha256:text, rows:v.strictObject({ bytes:natural, geometries:v.pipe(v.array(packedGeometry),v.maxLength(128)) }), slots:v.record(text,natural) });
const chalk = v.strictObject({ size:v.tuple([natural,natural]), outlines:v.record(text,rect), labels:v.record(text,rect) });
const texture = v.strictObject({ url:text, srgb:v.boolean(), repeat:v.boolean() });
const frame = v.strictObject({ program:Channels, inputs, outputs });
const long = v.pipe(v.string(), v.maxLength(4096));
const triple = v.tuple([number, number, number]);
const numbers = v.pipe(v.array(number), v.maxLength(16384));
const bakedHand = v.strictObject({ geometry: text, sleeve: v.nullable(text), wrist: triple, dir: triple });
const bakedBow = v.strictObject({ sectionSamples: v.strictObject({ widths: numbers, ridges: numbers }), look: long, arrow: long,
  ringU: numbers, ringSign: numbers, limbVerts: natural, dynVerts: natural, lWrist: triple, rWrist: triple, rHook: triple, rWristDir: triple });

/** Checked against the build's emitted JSON before publication; client reads never import data/. */
export const SECTIONS = {
  'custom/skinPickups':v.record(text,skinPickup),
  'custom/questInventory':v.strictObject({feats:v.pipe(v.array(feat),v.maxLength(128)),items:v.pipe(v.array(bagItem),v.maxLength(128))}),
  'custom/ambientLife':ForestLifeSchema,
  'custom/heldPlayback':v.strictObject({crossbow:Channels,lever:Channels,crossbowParts:Channels,leverParts:Channels}),
  'custom/heldInputs':v.strictObject({crossbow:inputs,lever:inputs,frames:v.strictObject({crossbow:frame,lever:frame})}),
  'custom/heldSights':v.strictObject({sight:Channels,sightInputs:inputs,sightOutputs:outputs,string:Channels,stringInputs:inputs,peep:Channels,peepInputs:inputs}),
  'custom/leverPlayback':v.strictObject({handAt:Channels,handAxis:Channels,handPalm:Channels,sight:Channels,cycle:Channels,partInputs:inputs,partReads:strings,
    bindings:v.pipe(v.array(v.strictObject({group:text,target:text,inputs,outputs})),v.maxLength(16))}),
  'custom/leverDetails':v.strictObject({pool}),
  'custom/heldToolPlayback':v.strictObject({description:text,nodeNames:v.record(text,text),pose:Channels}),
  'custom/paintedTextures':v.strictObject({textures:v.strictObject({coatArm:texture,chalk:texture,endGrain:texture,glow:texture,coatMap:texture,coatNormal:texture}),urls:strings,chalk}),
  'custom/trophyMounts':mountPack,
  'custom/crossbowPool':v.strictObject({pool,hierarchy:PrivateSceneSchema}),
  'custom/handsPool':v.strictObject({pool,hands:v.record(long,bakedHand),bow:bakedBow}),
} as const;
