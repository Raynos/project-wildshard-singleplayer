import { PanelDefinitionSchema } from './panelTemplate';
import { ReturnProgramSchema } from './namedJsonContracts';
import * as v from 'valibot';
import { InputExtraEntries, InputKeysSchema } from './inputDeclarations';
import { isJsonData } from './json';

/** Client observations only; the HUD never receives a horse controller, shard callback or simulation object. */
export interface RideHudState {
  mounted: boolean; breaking: boolean; steed: number; winded: boolean; gait: string; leanLow: number;
  beat: boolean; spurFlash: number; spur: { latched: boolean; streak: number }; horse: string | null;
  mountables: { id: string; name: string; whistle: boolean; hidden: boolean; position: [number, number, number]; scale: number }[];
}
/** Mount tuning, roads, companion rest point and the owner's persisted naming data. */
export interface MountProfile {
  speeds: { walk: number; trot: number; canter: number; gallop: number };
  names: Record<string, string>; restAt?: { x: number; z: number };
  roads?: readonly (readonly (readonly [number, number])[])[];
  thrownDamage: number; thrownLabel: string;
}
/** Actor identity row or its compact id; no controller or actor callbacks enter the riding API. */
export type MountActorRef = string | { readonly entityId: string };

/** Client-only strap geometry and camera-space attachment tuning. */
export interface ReinRibbonRows {
  span: number; halfWidth: number; heldRate: number; droppedSag: number;
  hand: { x: number; y: number; depth: number };
  neck: { down: number; out: number }; jowl: { down: number; out: number };
  bit: { back: number; out: number };
  colour: readonly number[]; edge: readonly number[];
  paint: { rim: number; bands: number; shade: number };
}
/** World-space anchors, sampled after the mount's skeleton and rider camera. */
export interface ReinRibbonFrame {
  yaw: number; drop: boolean;
  withers: [number, number, number]; crest: [number, number, number];
  head: [number, number, number]; muzzle: [number, number, number];
}

const reinFinite = v.pipe(v.number(), v.finite()), reinPositive = v.pipe(reinFinite, v.minValue(Number.MIN_VALUE));
const reinPoint = v.tuple([reinFinite, reinFinite, reinFinite]);
/** Admit the strap's drawing rows and named native anchor observations together. */
export const ReinPresentationSchema = v.strictObject({
  span: v.pipe(reinFinite, v.integer(), v.minValue(1), v.maxValue(64)), halfWidth: reinPositive,
  heldRate: reinPositive, droppedSag: reinFinite,
  hand: v.strictObject({ x: reinFinite, y: reinFinite, depth: reinPositive }),
  neck: v.strictObject({ down: reinFinite, out: reinFinite }), jowl: v.strictObject({ down: reinFinite, out: reinFinite }),
  bit: v.strictObject({ back: v.pipe(reinFinite, v.minValue(0), v.maxValue(1)), out: reinFinite }), colour: reinPoint, edge: reinPoint,
  paint: v.strictObject({ rim: reinFinite, bands: reinFinite, shade: reinFinite }),
  anchors: v.strictObject({ head: v.string(), crest: v.string(), body: v.string(), withers: reinPoint,
    minWeight: v.pipe(reinFinite, v.minValue(0), v.maxValue(1)) }),
});
export type ReinPresentationRows = v.InferOutput<typeof ReinPresentationSchema>;

const ridingId = v.pipe(v.string(),v.minLength(1),v.maxLength(128));
/** Client-only native riding contexts, physical defaults and binding descriptions.
 * Semantic actions belong to the mount/taming owners; authors supply no handler. */
export const RidingControlsSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Riding controls require JSON'), v.strictObject({
  foot: ridingId, mounted: ridingId, breaking: ridingId, movement: ridingId, dismount: v.pipe(v.string(),v.minLength(1),v.maxLength(256)),
  keys: v.strictObject({ 'ride.whistle': InputKeysSchema, 'ride.offer': InputKeysSchema, 'ride.gallop': InputKeysSchema,
    'move.forward': InputKeysSchema, 'move.back': InputKeysSchema, 'move.left': InputKeysSchema, 'move.right': InputKeysSchema,
    'lean.left': InputKeysSchema, 'lean.right': InputKeysSchema }), describe: InputExtraEntries.describe,
}), v.check(rows => new Set([rows.foot,rows.mounted,rows.breaking]).size === 3, 'Distinct riding contexts'));
export type RidingControls = v.InferOutput<typeof RidingControlsSchema>;

/** Numeric envelope rows shared by native mounts and their client rigs. */
export const RidingPresentationSchema = v.strictObject({ alive: v.string(),
  smooth: v.array(v.strictObject({ source: v.string(), target: v.string(), rate: reinFinite, low: reinFinite, high: reinFinite })),
  decay: v.array(v.strictObject({ source: v.string(), target: v.string(), rate: reinFinite })),
  graze: v.strictObject({ target: v.string(), rate: reinFinite, speed: reinFinite }),
  base: v.strictObject({ bone: v.string(), target: v.string() }),
  wind: v.strictObject({ x: v.string(), z: v.string(), strength: v.string() }),
});

const nameGraphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
/** Normalize a mounted companion's display name to the admitted grapheme cap. */
export function cleanMountName(raw: string, maximum: number): string {
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 128) throw new Error('Invalid mount name limit');
  const kept = raw.normalize('NFC').replaceAll(/[^\p{L}\p{N} '.-]/gu, '').replaceAll(/\s+/g, ' ').trim();
  const cased = kept.split(' ').map(word => word.charAt(0).toLocaleUpperCase() + word.slice(1)).join(' ');
  return Array.from(nameGraphemes.segment(cased), row => row.segment).slice(0, maximum).join('').trim();
}

/** Admitted native taming labels and stable saved identities. */
export const PageTamingBindingSchema = v.strictObject({ upgradeKind: v.string(), bonds: v.tuple([v.string(), v.string()]), names: v.tuple([v.string(), v.string()]),
  offset: v.tuple([v.number(), v.number()]), fields: v.strictObject({ upgraded: v.string(), horseUpgraded: v.string(), candidateUpgraded: v.string() }),
  labels: v.strictObject({ mount: v.string(), breaking: v.string(), trust: v.string(), start: v.string(), thrown: v.string(), bonded: v.tuple([v.string(), v.string()]) }) });

/** Native controls and presentation policy for an entered riding session. */
export const PageRidingPresetSchema = v.strictObject({ controls: v.exactOptional(RidingControlsSchema), mode: v.strictObject({ id: v.literal('ride'), hud: v.literal('ride') }), mountableLabel: v.string(),
  taming: v.strictObject({ herds: v.string(), adopted: v.strictObject({ kind: v.string(), variant: v.string(),
    upgrade: v.strictObject({ scale: v.number(), colour: v.tuple([v.number(),v.number(),v.number()]) }) }),
    thrownLabel: v.string(), breakingContext: v.string(), stowOnBreaking: v.boolean() }),
  actions: v.strictObject({ herds: v.string(), tagRange: v.number(), tagHeight: v.number(), squeal: v.string(),
    labels: v.strictObject({ name: v.string(), panic: v.string(), thrown: v.string(), bolt: v.string() }) }) });

/** Client-only session composition; every dependency is JSON data. */
const point = v.strictObject({ x: v.number(), z: v.number() });
export const ClientRidingSessionSchema = v.pipe(v.unknown(), v.check(isJsonData), v.strictObject({
  preset: PageRidingPresetSchema, programs: v.object({ approach: ReturnProgramSchema, breaking: ReturnProgramSchema, riding: ReturnProgramSchema,
    initial: v.record(v.string(), v.number()), reins: ReinPresentationSchema }),
  profile: v.strictObject({ speeds: v.strictObject({ walk: v.number(), trot: v.number(), canter: v.number(), gallop: v.number() }), thrownDamage: v.number(), thrownLabel: v.string() }),
  roads: v.array(v.array(v.tuple([v.number(), v.number()]))), rest: v.strictObject({ ...point.entries, face: point }),
  taming: v.strictObject({ binding: PageTamingBindingSchema, rail: point }),
  naming: v.strictObject({ panel: PanelDefinitionSchema, action: v.string(), maximum: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(128)), notice: v.string(), bondedFeat: v.string() }),
  /** the product file of a figure seated on the pasture raid's mount (format/mountedSpecimenRows), gesturing on its cues */
  figure: v.exactOptional(v.pipe(v.string(), v.minLength(1), v.maxLength(256))),
}));
