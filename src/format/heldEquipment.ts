import * as v from 'valibot';
import { FollowTrailSamplingSchema } from './trail';
import { ClientChannelsSchema as Channels, PrivateSceneSchema } from './clientChannels';
import { HeldModelRowsSchema, HeldPresentationSchema, HeldBowDefinitionSchema } from './weaponProfiles';

const text = v.pipe(v.string(), v.maxLength(512));
const number = v.number();
const natural = v.pipe(v.number(), v.integer(), v.minValue(0));
const strings = v.pipe(v.array(text), v.maxLength(8192));
const path = v.pipe(v.array(v.union([text, natural])), v.minLength(1), v.maxLength(16));
const input = v.strictObject({ input: text, owner: text, path });
const inputs = v.pipe(v.array(input), v.maxLength(128));
const outputPath = v.pipe(v.array(text), v.minLength(1), v.maxLength(16));
const output = v.strictObject({ property: v.picklist(['x','y','z','yaw','pitch','roll','scaleX','scaleY','scaleZ','visible','value','turn']), target: text, path: outputPath });
const outputs = v.pipe(v.array(output), v.maxLength(128));
const pool = v.strictObject({ url: text, parts: strings });
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
    tracer: v.strictObject({ row:v.strictObject({mode:v.picklist(['segment','trail']),follow:FollowTrailSamplingSchema,roster:natural,points:natural,width:number,color:triple,order:number,lifetime:number,fade:number,markerScale:number}),
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

/** Held equipment rows: geometry pools, hands, channels and native-action presentation. No shard callbacks. */
export const HeldEquipmentSchema = v.strictObject({
  playback:v.strictObject({crossbow:Channels,lever:Channels,crossbowParts:Channels,leverParts:Channels}),
  inputs:v.strictObject({crossbow:inputs,lever:inputs,frames:v.strictObject({crossbow:frame,lever:frame})}),
  sights:v.strictObject({sight:Channels,sightInputs:inputs,sightOutputs:outputs,string:Channels,stringInputs:inputs,peep:Channels,peepInputs:inputs}),
  action:v.strictObject({handAt:Channels,handAxis:Channels,handPalm:Channels,sight:Channels,cycle:Channels,partInputs:inputs,partReads:strings, bindings:v.pipe(v.array(v.strictObject({group:text,target:text,inputs,outputs})),v.maxLength(16))}),
  firearm:v.strictObject({pool,rows:leverRows,asset:v.strictObject({url:text,parts:strings})}),
  tool:v.strictObject({description:text,nodeNames:v.record(text,text),pose:Channels,look:knifeLook,url:text,
    loadedLevel:text,loadSystemId:v.custom<`shard.${string}`>(value => typeof value === 'string' && value.startsWith('shard.'))}),
  launcher:v.strictObject({pool,hierarchy:PrivateSceneSchema,rows:crossbowRows}),
  hands:v.strictObject({pool,heldBow:HeldBowDefinitionSchema,hands:v.record(long,bakedHand),presentation:v.strictObject({hands:look,coat:look})}),
  coatTextures:v.strictObject({map:v.strictObject({url:text,srgb:flag,repeat:flag}),normalMap:v.strictObject({url:text,srgb:flag,repeat:flag}),armMap:v.strictObject({url:text,srgb:flag,repeat:flag})}),
  handNames:v.strictObject({hands:text,coat:text}),
  launcherTuning:v.strictObject({bury:number,kick:number,adsBlend:number,adsMotion:number,maxStuck:natural}),
  firearmTuning:v.strictObject({kick:number,brass:v.strictObject({count:number,life:number}),tracer:v.strictObject({count:number,life:number,width:number}),
    ads:v.strictObject({blend:number,motion:number,nearMargin:number,sightY:number,rearZ:number,frontZ:number,muzzleZ:number})}),
});
/** Admitted held catalogue used by the game host and another shard's fixture. */
export type HeldEquipmentRows = v.InferOutput<typeof HeldEquipmentSchema>;
