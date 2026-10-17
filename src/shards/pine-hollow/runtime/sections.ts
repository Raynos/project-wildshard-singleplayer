import * as v from 'valibot';
import { ClientChannelsSchema as Channels, PrivateSceneSchema } from '@wildshard/format/clientChannels';
import { ForestLifeSchema } from '@wildshard/format/ambientLife';
import { HeldModelRowsSchema, HeldPresentationSchema, HeldBowDefinitionSchema } from '@wildshard/format/weaponProfiles';

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
const bakedHand = v.strictObject({ geometry: text, sleeve: v.nullable(text), wrist: triple, dir: triple });
const pair = v.tuple([number, number]), opt = v.exactOptional, flag = v.boolean();
const look = v.strictObject({ set:opt(text), normalScale:opt(pair), color:opt(triple), roughness:number, metalness:number, envMapIntensity:opt(number), specularIntensity:opt(number),
  anisotropy:opt(number), anisotropyRotation:opt(number), emissive:opt(number), emissiveIntensity:opt(number), alphaTest:opt(number), vertexColors:opt(flag), forceSinglePass:opt(flag), side:opt(v.picklist([0,1,2])) });
const heldHand = v.strictObject({ part:text, at:triple, axis:triple, palm:triple, coat:flag, elbow:opt(triple) });
const grip = v.strictObject({ at:triple, axis:triple, palm:triple }), pose = { px:number, py:number, pz:number, rx:number, ry:number, rz:number };
/** The lever-action's rows on the held-firearm host (data/leverDetails.json): its model, view numbers, fists and presentation. */
const leverRows = v.strictObject({ model:HeldModelRowsSchema, presentation:HeldPresentationSchema, hands:v.strictObject({ left:grip, right:grip, gate:grip }),
  view: v.strictObject({ kick:number, flash:v.strictObject({frames:number,lightTime:number,light:number}), brass:v.strictObject({count:number,life:number}), tracer:v.strictObject({count:number,time:number}),
    adsMotion:number, lever:v.strictObject({open:number,boltTravel:number,hammerDown:number,hammerCocked:number,handTurn:number}), sight:v.strictObject({y:number,eyeZ:number,rearZ:number,frontZ:number,muzzleZ:number}),
    hammerPivot:triple, port:triple, hip:v.strictObject({...pose,scale:number}), cyclePose:v.strictObject(pose) }) });
/** The crossbow's rows on the held-launcher host (generators/crossbowRows.ts, written by the crossbow pool bake). */
const crossbowRows = v.strictObject({
  view: v.strictObject({ hip:v.strictObject({px:number,py:number,pz:number,rx:number,ry:number,rz:number,scale:number}), ads:v.strictObject({eyeAboveRail:number,nearMargin:number,pitch:number}), peep:v.strictObject({z:number,radius:number,worldRadius:number}) }),
  hands: v.strictObject({ left:heldHand, right:heldHand }),
  launcher: v.strictObject({
    materials: v.record(text, v.union([v.strictObject({name:text,look}), v.strictObject({name:text,basic:v.strictObject({color:number,opacity:number})})])),
    textures: v.record(text, v.strictObject({ set:v.picklist(['walnut','brushed-steel','leather','cord','bolt']), repeat:opt(pair) })),
    objects: v.strictObject({sight:text,sightRing:text}), fade: strings, nodes: v.strictObject({stringLeft:text,stringRight:text,serving:text,round:text,sightPost:text}),
    anchors: v.strictObject({tipL:triple,tipR:triple,nockRest:triple,nockDrawn:triple}), string: v.strictObject({spring:pair,reloadSpring:pair,release:number,reload:pair}),
    glance: v.strictObject({lift:number,keep:number,bounce:number,maxSpeed:number}),
    frame: v.strictObject({ clock:v.picklist(['frame','world']), fovWhen:v.picklist(['always','active']), recoil:v.strictObject({decay:number,attack:number,recovery:number}),
      lag:v.strictObject({gain:number,clampYaw:number,clampPitch:number,k:number,c:number}), clampAfter:flag, readout:v.strictObject({range:number,mask:number,held:flag,posed:flag}) }),
    tracer: v.strictObject({ row:v.strictObject({mode:v.picklist(['segment','trail']),roster:natural,points:natural,width:number,color:triple,order:number,lifetime:number,fade:number,markerScale:number}),
      spin:number, glow:v.strictObject({flight:number,stuck:number,impact:number,ring:pair}) }),
    displayRest: v.pipe(v.array(v.strictObject({part:text,child:natural,material:text,position:triple,quaternion:v.tuple([number,number,number,number]),scale:triple})),v.maxLength(16)),
  }),
});

const primitiveOp = v.union([v.tuple([v.picklist(['translate','scale']),number,number,number]),v.tuple([v.picklist(['rotateX','rotateY','rotateZ']),number])]);
const shapeStep = v.union([v.tuple([v.picklist(['moveTo','lineTo']),number,number]),v.tuple([v.literal('quadraticCurveTo'),number,number,number,number])]);
const knifePart = v.strictObject({kind:v.picklist(['extrude','box','cylinder','sphere','capsule']),args:v.pipe(v.array(number),v.maxLength(16)),paint:text,
  ops:opt(v.pipe(v.array(primitiveOp),v.maxLength(32))),shape:opt(v.pipe(v.array(shapeStep),v.maxLength(128))),
  extrude:opt(v.strictObject({depth:number,bevelEnabled:flag,bevelThickness:number,bevelSize:number,bevelSegments:natural,curveSegments:natural}))});
const knifeLook = v.strictObject({name:text,standIn:v.strictObject({roughness:number,metalness:number}),envMapIntensity:number,anisotropy:natural,
  loadDelayMs:natural,renderOrder:number,parts:v.pipe(v.array(knifePart),v.minLength(1),v.maxLength(32))});

/** Checked against the build's emitted JSON before publication; client reads never import data/. */
export const SECTIONS = {
  'custom/questInventory':v.strictObject({feats:v.pipe(v.array(feat),v.maxLength(128)),items:v.pipe(v.array(bagItem),v.maxLength(128))}),
  'custom/ambientLife':ForestLifeSchema,
  'custom/heldPlayback':v.strictObject({crossbow:Channels,lever:Channels,crossbowParts:Channels,leverParts:Channels}),
  'custom/heldInputs':v.strictObject({crossbow:inputs,lever:inputs,frames:v.strictObject({crossbow:frame,lever:frame})}),
  'custom/heldSights':v.strictObject({sight:Channels,sightInputs:inputs,sightOutputs:outputs,string:Channels,stringInputs:inputs,peep:Channels,peepInputs:inputs}),
  'custom/leverPlayback':v.strictObject({handAt:Channels,handAxis:Channels,handPalm:Channels,sight:Channels,cycle:Channels,partInputs:inputs,partReads:strings,
    bindings:v.pipe(v.array(v.strictObject({group:text,target:text,inputs,outputs})),v.maxLength(16))}),
  'custom/leverDetails':v.strictObject({pool,rows:leverRows}),
  'custom/heldToolPlayback':v.strictObject({description:text,nodeNames:v.record(text,text),pose:Channels,look:knifeLook}),
  'custom/paintedTextures':v.strictObject({textures:v.strictObject({coatArm:texture,chalk:texture,endGrain:texture,glow:texture,coatMap:texture,coatNormal:texture,ferns:texture,shrubs:texture,litter:texture,stones:texture,moss:texture,reeds:texture}),urls:strings,chalk}),
  'custom/trophyMounts':mountPack,
  'custom/crossbowPool':v.strictObject({pool,hierarchy:PrivateSceneSchema,rows:crossbowRows}),
  'custom/handsPool':v.strictObject({pool,heldBow:HeldBowDefinitionSchema,hands:v.record(long,bakedHand),presentation:v.strictObject({hands:look,coat:look})}),
  'custom/kingKit':v.strictObject({pool,lanterns:v.pipe(v.array(triple),v.maxLength(8))}),
} as const;

/** World-only view rows: the reader checks the named product before any builder uses them. */
export const NativeViewSchema = v.strictObject({
  KINGS_CLEARING: v.strictObject({ x:number, z:number, r:number, blend:number, clear:number }),
  BEAR_CAVE: v.strictObject({ x:number, z:number, rot:number }), KING_ARENA_FOG:number,
  KING_FX_LOOKS:v.strictObject({ fog:text, flame:text }), CRAG_LOOK:text, SPRAY_LOOK:text,
  CAVE_LOOK:v.strictObject({ near:number, under:v.strictObject({ height:number, lzMin:number, lzMax:number }), fill:pair, surface:v.literal('rock'),
    shaft:v.strictObject({ look:text, radialSegments:number, heightSegments:number, renderOrder:number, gain:number, sunBase:number, sunGain:number, floor:number }),
    drips:v.strictObject({ color:number, size:number, opacity:number, period:number, periodStep:number, kinds:number, phaseStep:number, gravity:number, hang:number, minDrop:number }) }),
  SPRAY_PUFFS:v.strictObject({ notice:text, at:v.array(number), seed:v.array(number), size:v.array(number) }),
});
