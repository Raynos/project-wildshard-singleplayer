import * as v from 'valibot';
import { PrivateSceneSchema } from './clientChannels';
import { QuestStepRowsSchema } from './questSteps';

const finite = v.pipe(v.number(), v.finite());
const name = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const names = v.pipe(v.array(name), v.minLength(1), v.maxLength(64),
  v.check(rows => new Set(rows).size === rows.length));
const vector = v.tuple([finite, finite, finite]);

/** G475 held arms: rig contract, camera framing and graph material bindings supplied by a shard's rows.
 * The sword rig's semantic mesh/socket protocol is owned by RigArms; materials are catalogue identities.
 * Pickup materials may accompany the held look for the same asset's world display. No services or callbacks. */
export const ToonArmsLookSchema = v.strictObject({
  id: name, url: name, skeleton: name, sockets: names,
  lighting: v.strictObject({ id: name, initial: v.strictObject({ uToonLift: vector, uToonRim: vector,
    uCloudShadow: finite, uToonNight: finite, uSeaLevel: finite, uCloudTime: finite }) }),
  joints: v.strictObject({ sides: names, arm: names, fingers: names,
    phalanges: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8)) }),
  offset: vector,
  frame: v.strictObject({ size: v.pipe(finite, v.minValue(0.001)), pitch: finite, yaw: finite, roll: finite }),
  sunward: finite, bladeBase: finite,
  swim: v.strictObject({ tilt: finite, handsZ: finite, waterY: finite, startD: finite }),
  materials: v.strictObject({ arms: name, wood: name, iron: name, swim: name,
    pickupBlade: v.exactOptional(name), pickupFittings: v.exactOptional(name) }),
});

/** Admitted held-arm data. The host checks the corresponding material catalogue when it is lent. */
export type ToonArmsLook = v.InferOutput<typeof ToonArmsLookSchema>;
/** Admit before loading the rig or borrowing any graph material. */
export function parseToonArmsLook(input: unknown): ToonArmsLook { return v.parse(ToonArmsLookSchema, input); }

/** Held sword families, Explorer cards and optional world claims, all driven by the same rig/look catalogue. */
export const HeldArmsSchema = v.strictObject({ slug: name, look: ToonArmsLookSchema,
  weapons: v.pipe(v.array(v.strictObject({ item: name, blade: v.picklist(['wood', 'iron']) })), v.minLength(1), v.maxLength(16)),
  cards: v.pipe(v.array(v.strictObject({ id: name, name, file: name, kind: v.picklist(['wood', 'iron']),
    size: vector, copies: v.pipe(finite, v.integer(), v.minValue(0)) })), v.maxLength(16)),
  claims: v.pipe(v.array(v.strictObject({ id: name, item: name, at: name, position: vector,
    owned: name, prompt: name, toast: name, scene: PrivateSceneSchema, group: name,
    geometries: v.record(name, name), materials: v.record(name, name), seedXor: finite,
    lift: finite, scale: finite, tilt: finite, radius: finite,
    guard: v.strictObject({ condition: QuestStepRowsSchema.entries.guards.item, radius: finite, toast: name }),
    light: v.strictObject({ colour: finite, intensity: finite, distance: finite, decay: finite, height: finite }),
    halo: v.strictObject({ size: finite, colour: finite, opacity: finite, flickerOpacity: finite,
      height: finite, scale: finite, order: finite, stops: v.pipe(v.array(v.tuple([finite,finite])),v.maxLength(16)) }),
    phase: finite, waves: v.pipe(v.array(v.tuple([finite,finite])),v.maxLength(16)),
    fade: v.strictObject({ light: finite, opacity: finite, scale: finite }),
  })), v.maxLength(16)),
});
/** Admitted catalogue shared by entered equipment and cold Explorer cards. */
export type HeldArmsRows = v.InferOutput<typeof HeldArmsSchema>;
