import * as v from 'valibot';
import { ClientChannelsSchema as Channels, PrivateSceneSchema } from '@wildshard/format/clientChannels';
import { ForestLifeSchema } from '@wildshard/format/ambientLife';

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
  'custom/kingKit':v.strictObject({pool,lanterns:v.pipe(v.array(triple),v.maxLength(8))}),
} as const;
