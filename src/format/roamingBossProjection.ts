import * as v from 'valibot';
import { RoamingEncounterSchema } from './bossEncounter';
import { CueDirectorSchema } from './cueDirector';
import { BossSocketRigSchema } from './bossSocketRig';
import { isJsonData } from './json';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const xyz = v.tuple([n, n, n]);
/** Client-only roaming projection: native body/rig ids and declared channels. */
export const RoamingBossProjectionSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Roaming projection requires JSON rows'), v.strictObject({
  id, session: id, spawn: id, spawnStream: id, variant: id, socketRig: BossSocketRigSchema, encounter: RoamingEncounterSchema,
  cues: CueDirectorSchema, events: v.strictObject({ hit: id, open: id, shut: id, burst: id, land: id }), roar: id, landSound: id,
  colours: v.strictObject({ tell: xyz, wave: xyz, puff: xyz }),
  prewarm: v.pipe(v.array(v.strictObject({ kind: id, variant: id })), v.maxLength(8)),
  fur: v.strictObject({ prewarm: n, parked: n }),
  wall: v.strictObject({ look: id, alpha: id, colour: id, name: id, radius: n, bottom: n, height: n, segments: n, lift: n, order: n, seal: n, visible: n, colourGain: n }),
  hazard: v.strictObject({ look: id, alpha: id, name: id, meshes: v.pipe(v.array(v.strictObject({ geometry: id, material: id })), v.maxLength(4)), scale: n, flameScale: xyz, order: n,
    landingLift: n, arc: n, rotation: xyz, alphaBase: n, dark: n, radius: n, pulse: v.tuple([n, n, n]), width: n }),
  light: v.strictObject({ colour: n, distance: n, decay: n, playerAbove: n, focusAbove: n, darkness: n,
    playerColour: xyz, playerDistance: n, playerGain: n, focusColour: xyz, focusDistance: n, focusGain: n, focusOpen: v.tuple([n, n]) }),
  room: v.strictObject({ density: v.tuple([n, n]), fog: v.tuple([n, n]), hemi: n, environment: n, dome: n, lights: n, domeUniforms: v.tuple([id, id]) }),
  puffs: v.strictObject({ count: v.pipe(n, v.integer(), v.minValue(1), v.maxValue(16)), enter: v.tuple([n, n, n, n]), leave: v.tuple([n, n, n, n]), lift: n }),
}), v.check(row => row.encounter.lanes.count <= 3 && row.socketRig.hazards.length <= 3, 'Existing client lane and hazard capacities'));
export type RoamingBossProjectionRows = v.InferOutput<typeof RoamingBossProjectionSchema>;
