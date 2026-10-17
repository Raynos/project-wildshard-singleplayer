import { RoamingEncounterSchema, BossEncounterPresentationSchema } from '@wildshard/format/bossEncounter';
import * as v from 'valibot';
import { ForestLifeSchema } from '@wildshard/format/ambientLife';

const text = v.pipe(v.string(), v.maxLength(512));
const number = v.number();
const finite = v.pipe(v.number(), v.minValue(-Number.MAX_VALUE), v.maxValue(Number.MAX_VALUE));
const point = { x:finite, y:finite, z:finite };
const natural = v.pipe(v.number(), v.integer(), v.minValue(0));
const strings = v.pipe(v.array(text), v.maxLength(8192));
const rect = v.tuple([number, number, number, number]);
const pool = v.strictObject({ url: text, parts: strings });
const icon = v.picklist(['deer','boar','elk','bear','ghost','ironhide','claw','antlers','poi','laurel','rope','seaglass','coin','check','lock','tusk','longbow']);
const feat = v.strictObject({ id: text, name: text, goal: text, count: natural, kind: v.exactOptional(text), variant: v.exactOptional(text), event: v.exactOptional(text), title: text, icon });
const bagItem = v.strictObject({ id: text, label: text, icon, travels: v.boolean() });
const packedGeometry = v.strictObject({ attrs: v.array(v.tuple([text,natural])), count: natural, unique: natural,
  own: v.nullable(v.picklist(['u16','u32'])), indexCount: natural });
const mountPack = v.strictObject({ notice:text, url:text, sha256:text, rows:v.strictObject({ bytes:natural, geometries:v.pipe(v.array(packedGeometry),v.maxLength(128)) }), slots:v.record(text,natural) });
const chalk = v.strictObject({ size:v.tuple([natural,natural]), outlines:v.record(text,rect), labels:v.record(text,rect) });
const texture = v.strictObject({ url:text, srgb:v.boolean(), repeat:v.boolean() });
const triple = v.tuple([number, number, number]);
const pair = v.tuple([number, number]);
/** Cabin spatial facts are checked at emission and when the play hook reads the named product. */
export const CabinAmbienceSchema = v.strictObject({ floors:v.pipe(v.array(v.strictObject({ ...point, rot:finite, hw:finite, hd:finite })),v.maxLength(128)), firePits:v.pipe(v.array(v.strictObject(point)),v.maxLength(16)) });

/** Checked against the build's emitted JSON before publication; client reads never import data/. */
export const SECTIONS = {
  'custom/questInventory':v.strictObject({feats:v.pipe(v.array(feat),v.maxLength(128)),items:v.pipe(v.array(bagItem),v.maxLength(128))}),
  'custom/ambientLife':ForestLifeSchema,
  'custom/paintedTextures':v.strictObject({textures:v.strictObject({coatArm:texture,chalk:texture,endGrain:texture,glow:texture,coatMap:texture,coatNormal:texture,ferns:texture,shrubs:texture,litter:texture,stones:texture,moss:texture,reeds:texture}),urls:strings,chalk}),
  'custom/trophyMounts':mountPack,
  'custom/kingKit':v.strictObject({pool,lanterns:v.pipe(v.array(triple),v.maxLength(8))}),
} as const;

/** World-only view rows: the reader checks the named product before any builder uses them. */
export const NativeViewSchema = v.strictObject({
  BOSS_RIBS: triple, BOSS_ENCOUNTER: RoamingEncounterSchema, BOSS_PRESENTATION: BossEncounterPresentationSchema,
  KINGS_CLEARING: v.strictObject({ x:number, z:number, r:number, blend:number, clear:number }),
  BEAR_CAVE: v.strictObject({ x:number, z:number, rot:number }), KING_ARENA_FOG:number,
  KING_FX_LOOKS:v.strictObject({ fog:text, flame:text }), CRAG_LOOK:text, SPRAY_LOOK:text,
  CAVE_LOOK:v.strictObject({ near:number, under:v.strictObject({ height:number, lzMin:number, lzMax:number }), fill:pair, surface:v.literal('rock'),
    shaft:v.strictObject({ look:text, radialSegments:number, heightSegments:number, renderOrder:number, gain:number, sunBase:number, sunGain:number, floor:number }),
    drips:v.strictObject({ color:number, size:number, opacity:number, period:number, periodStep:number, kinds:number, phaseStep:number, gravity:number, hang:number, minDrop:number }) }),
  SPRAY_PUFFS:v.strictObject({ notice:text, at:v.array(number), seed:v.array(number), size:v.array(number) }),
});
