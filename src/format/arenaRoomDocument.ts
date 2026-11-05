import { isJsonData } from './json.ts';
/** Complete room and encounter documents; the existing native owners still construct and admit every resource. */
import * as v from 'valibot';
import { PrivateSceneSchema } from './clientChannels.ts';
import { BossProfileSchema } from './bossProfiles.ts';
import { BossEncounterDefinitionSchema, BossEncounterPresentationSchema } from './bossEncounter.ts';
import { CreatureStrikeSchema } from './creatures.ts';
import { ReturnProgramSchema } from './namedJsonContracts.ts';
import { ReturnProgramDocumentSchema, type ReturnProgramDocument } from './returnProgramDocument.ts';


interface RoomPoint { x: number; z: number }
interface ColliderAt { x: number; y: number; z: number; yaw?: number; rot?: { x: number; y: number; z: number; w: number }; surface?: 'wood' | 'stone' | 'metal' | 'sand' }
type RoomCollider = ({ kind: 'box'; hx: number; hy: number; hz: number } | { kind: 'capsule'; halfHeight: number; radius: number }) & ColliderAt;
interface ArenaPortalRows {
  signal: string; spawn: { x: number; z: number; yaw: number }; end: number; exitOffset: number; slow: number;
  fade: { out: number; hold: number; in: number }; keep: string; near: number; floor: { tolerance: number; depth: number };
}
interface ArenaFightRows {
  profile: v.InferOutput<typeof BossProfileSchema>; body: string; identity: 'runtime' | 'declared';
  add: { kind: string; variant: string; memory: Record<string, number> }; damageTag: string;
  maxZ: number; reward: [number, number, number]; respawn: [number, number, number]; yaw: number;
  presentation: { reach: number; ringMax: number; beamRadius: number };
  cuts: v.InferOutput<typeof CreatureStrikeSchema>[]; hazards: Record<string, v.InferOutput<typeof CreatureStrikeSchema>>;
}
/** Complete native King metadata, including retained source fields. */
export interface ArenaKingRows {
  client: { light: { colour: number; drop: number }; prewarm: { kind: string; variant: string }; system: string; debugZ: number };
  portal: ArenaPortalRows; profile: v.InferOutput<typeof BossProfileSchema>; encounter: v.InferOutput<typeof BossEncounterDefinitionSchema>;
  reward: v.InferOutput<typeof BossEncounterPresentationSchema.entries.reward>;
  tuning: { strikeDamage: number[]; reach: number; sunburstDamage: number; ringSpeed: number; ringMax: number;
    beamRadius: number; beamHitRadius: number; beamDamage: number; beamToKing: number; headdressHp: number; shieldOffset: number; drifts: [number, number, number][] };
  page: ArenaFightRows;
}
/** Full chamber, scenes and original collider policy. */
export interface ArenaRoomDocumentRows {
  id: string; name: string; file: string; sealId: string; sealName: string;
  origin: { x: number; y: number; z: number }; halfWidth: number; corridorHalfWidth: number; corridorEnd: number;
  doorHalfWidth: number; doorHeight: number; sandCells: number; sandColor: string; triangles: number;
  cover: { x: number; z: number; wid: number; len: number; plinthH: number; h: number }; pedestal: RoomPoint;
  beams: { a: RoomPoint; b: RoomPoint; r: number }[];
  collision: { boxes: { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }[]; descs: RoomCollider[] };
  glowColor: [number, number, number]; beamTop: [number, number, number];
  coverMotion: { closed: [number, number, number]; slide: [number, number, number]; tip: [number, number, number]; slideRotation: [number, number, number]; tipRotation: [number, number, number] };
  markers: string[]; shafts: { id: string; base: number }[]; streams: { id: string; tell: string; x: number; z: number }[];
  lid: string; heap: string; sand: string; flames: string; rings: string[]; beam: string; line: string; dome: string; arc: string; seal: string;
  view: { scene: v.InferOutput<typeof PrivateSceneSchema>; static: v.InferOutput<typeof PrivateSceneSchema>;
    fx: { id: string; mode: number; color: [number, number, number]; alpha: number; additive: boolean; depthTest: boolean; p: [number, number, number, number] }[] };
}
/** Streamed room and King document, before native construction. */
export interface ArenaRoomDocument {
  room: ArenaRoomDocumentRows;
  encounter: ArenaKingRows & { definition: v.InferOutput<typeof BossEncounterDefinitionSchema>; program: ReturnProgramDocument };
}

const returnProgram: v.GenericSchema<unknown, ReturnProgramDocument> = v.pipe(v.unknown(), v.check(isJsonData), v.intersect([ReturnProgramSchema, ReturnProgramDocumentSchema]));

const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(Number.MIN_VALUE));
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const triple = v.tuple([finite, finite, finite]);
const point = v.strictObject({ x: finite, z: finite });
const list = <S extends v.GenericSchema>(schema: S) => v.pipe(v.array(schema), v.maxLength(256));
const surface = v.exactOptional(v.picklist(['wood', 'stone', 'metal', 'sand']));
const at = { x: finite, y: finite, z: finite, yaw: v.exactOptional(finite),
  rot: v.exactOptional(v.strictObject({ x: finite, y: finite, z: finite, w: finite })), surface };
// Same two shape kinds and surface policy as BossArenaRoom's readColliderRows call.
const collider = v.variant('kind', [
  v.strictObject({ kind: v.literal('box'), ...at, hx: finite, hy: finite, hz: finite }),
  v.strictObject({ kind: v.literal('capsule'), ...at, halfHeight: finite, radius: finite }),
]);
const portal = v.strictObject({ signal: id, spawn: v.strictObject({ x: finite, z: finite, yaw: finite }), end: finite,
  exitOffset: finite, slow: v.pipe(finite, v.minValue(0), v.maxValue(1)),
  fade: v.strictObject({ out: finite, hold: finite, in: finite }), keep: id, near: finite,
  floor: v.strictObject({ tolerance: finite, depth: finite }) });
const fight = v.strictObject({ profile: BossProfileSchema, body: id, identity: v.picklist(['runtime', 'declared']),
  add: v.strictObject({ kind: id, variant: id, memory: v.record(id, finite) }),
  damageTag: v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.*-]+$/u)),
  maxZ: finite, reward: triple, respawn: triple, yaw: finite,
  presentation: v.strictObject({ reach: finite, ringMax: finite, beamRadius: finite }),
  cuts: v.pipe(v.array(CreatureStrikeSchema), v.minLength(1), v.maxLength(16)), hazards: v.record(id, CreatureStrikeSchema) });
const tuning = v.strictObject({ strikeDamage: list(finite), reach: finite, sunburstDamage: finite, ringSpeed: finite, ringMax: finite,
  beamRadius: finite, beamHitRadius: finite, beamDamage: finite, beamToKing: finite, headdressHp: finite, shieldOffset: finite, drifts: list(triple) });
const client = v.strictObject({ light: v.strictObject({ colour: finite, drop: finite }),
  prewarm: v.strictObject({ kind: id, variant: id }), system: id, debugZ: finite });
const king = v.strictObject({ client, portal, profile: BossProfileSchema, encounter: BossEncounterDefinitionSchema,
  reward: BossEncounterPresentationSchema.entries.reward, tuning, page: fight });
const room = v.strictObject({
  id, name: id, file: id, sealId: id, sealName: id,
  origin: v.strictObject({ x: finite, y: finite, z: finite }),
  halfWidth: positive, corridorHalfWidth: positive, corridorEnd: positive, doorHalfWidth: positive, doorHeight: positive,
  sandCells: v.pipe(positive, v.integer(), v.maxValue(256)), sandColor: id, triangles: finite,
  cover: v.strictObject({ x: finite, z: finite, wid: positive, len: positive, plinthH: finite, h: finite }), pedestal: point,
  beams: list(v.strictObject({ a: point, b: point, r: positive })),
  collision: v.strictObject({ boxes: list(v.strictObject({ x: finite, z: finite, hw: finite, hd: finite, rot: finite, yTop: finite, yBottom: finite })), descs: list(collider) }),
  glowColor: triple, beamTop: triple,
  coverMotion: v.strictObject({ closed: triple, slide: triple, tip: triple, slideRotation: triple, tipRotation: triple }),
  markers: list(id), shafts: list(v.strictObject({ id, base: finite })), streams: list(v.strictObject({ id, tell: id, x: finite, z: finite })),
  lid: id, heap: id, sand: id, flames: id, rings: list(id), beam: id, line: id, dome: id, arc: id, seal: id,
  view: v.strictObject({ scene: PrivateSceneSchema, static: PrivateSceneSchema,
    fx: list(v.strictObject({ id, mode: finite, color: triple, alpha: finite, additive: v.boolean(), depthTest: v.boolean(), p: v.tuple([finite, finite, finite, finite]) })) }),
});
const document = v.strictObject({ room, encounter: v.strictObject({ ...king.entries,
  definition: BossEncounterDefinitionSchema, program: returnProgram }) });

/** Existing complete King metadata, including fields its entered adapter does not read. */

export const ArenaKingRowsSchema: v.GenericSchema<unknown, ArenaKingRows> = king;
/** Full chamber, private scene, static scene and collider document. */

export const ArenaRoomDocumentRowsSchema: v.GenericSchema<unknown, ArenaRoomDocumentRows> = room;
/** The unchanged streamed room/King envelope, before either native constructor runs. */

export const ArenaRoomDocumentSchema: v.GenericSchema<unknown, ArenaRoomDocument> = document;
