import * as v from 'valibot';
import { isJsonData } from './json';
import { ToonLightingSchema } from './toonLighting';
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
  lighting: ToonLightingSchema,
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
const ToonHeldArmsSchema = v.strictObject({ slug: name, look: ToonArmsLookSchema,
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
/** A declared primary borrows its original rig from the manifest; preparation
 * reads presentation framing without loading or constructing another rig. */
const DeclaredPrimarySchema = v.strictObject({ kind: v.literal('declared-primary'),
  primary: v.strictObject({ item: name, blade: v.picklist(['wood', 'iron']), file: name }),
  tools: v.pipe(v.array(name), v.maxLength(16), v.check(rows => new Set(rows).size === rows.length)),
});
export const HeldArmsSchema = v.union([ToonHeldArmsSchema, DeclaredPrimarySchema]);
/** G601 C10: a graph held view's cold Explorer cards. Each card is the product file's graph held view
 * (`HeldView.fromProduct(slug, file)`), settled for its frames inside a loading box of its size. */
export const HeldGraphCardsSchema = v.strictObject({ kind: v.literal('graph'), slug: name, file: name,
  cards: v.pipe(v.array(v.strictObject({ id: name, name, file: name, size: vector,
    pipeline: v.pipe(v.array(v.picklist(['code', 'blender', 'trellis', 'hunyuan', 'cc0'])), v.minLength(1), v.maxLength(5)),
    clips: v.pipe(v.array(name), v.maxLength(64)), settleFrames: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(600)),
    copies: v.pipe(finite, v.integer(), v.minValue(0)) })), v.minLength(1), v.maxLength(16)),
});
/** Admitted catalogue shared by entered equipment and cold Explorer cards. */
export type HeldArmsRows = v.InferOutput<typeof HeldArmsSchema>;

const slotId = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/), v.maxLength(128));
const slotFile = v.pipe(v.string(), v.minLength(1), v.maxLength(1024));
const slotWeapon = v.pipe(v.string(), v.regex(/^weapon\.[a-zA-Z0-9][a-zA-Z0-9.-]*$/), v.maxLength(128));
const slotTool = v.pipe(v.string(), v.regex(/^tool\.[a-zA-Z0-9][a-zA-Z0-9.-]*$/), v.maxLength(128));
const slotReferences = v.pipe(v.array(slotId), v.maxLength(32));
const bladeSource = v.variant('kind', [
  v.strictObject({ kind: v.literal('starter'), blade: v.picklist(['wood', 'iron']),
    viewmodel: v.picklist(['wood', 'iron', 'declared']), framing: v.exactOptional(slotFile) }),
  v.strictObject({ kind: v.literal('passes'), file: slotFile }),
]);
const heldSlot = v.variant('kind', [
  v.strictObject({ id: slotId, kind: v.literal('blade'), item: slotWeapon, source: bladeSource }),
  v.strictObject({ id: slotId, kind: v.literal('bow'), item: slotWeapon, file: slotFile }),
  v.strictObject({ id: slotId, kind: v.literal('polearm'), item: slotWeapon, file: slotFile }),
  v.strictObject({ id: slotId, kind: v.literal('firearm'), item: slotWeapon, file: slotFile, muzzleLight: v.boolean() }),
  v.strictObject({ id: slotId, kind: v.literal('tool'), item: slotTool, tool: v.literal('grapple'), source: slotFile, presentation: slotFile }),
]);
/** C9's finite native construction grammar. slots retain construction order;
 * registration is separate because native metadata may register in a different
 * order. Existing inventory/save owners still own selection and ammunition.
 * This defining schema sits beside the original wire until adapters migrate. */
export const HeldSlotsSchema = v.strictObject({
  version: v.literal(1), id: slotId,
  slots: v.pipe(v.array(heldSlot), v.minLength(1), v.maxLength(32)),
  registration: slotReferences,
  equipment: v.strictObject({ primary: slotId, rifle: v.exactOptional(slotId), secondary: v.exactOptional(slotId),
    extras: slotReferences, order: v.exactOptional(slotReferences) }),
  selection: v.strictObject({ unlock: slotReferences, initial: v.exactOptional(slotId) }),
  mount: slotReferences,
  refills: v.pipe(v.array(v.strictObject({ slot: slotId, kind: v.picklist(['add-magazine', 'fill-capacity']) })), v.maxLength(16)),
  upgrades: v.pipe(v.array(v.strictObject({ id: slotId, slot: slotId, kind: v.picklist(['bow', 'blade-pass']),
    replacement: v.strictObject({ item: slotWeapon, name }) })), v.maxLength(16)),
});
export type HeldSlotsRows = v.InferOutput<typeof HeldSlotsSchema>;
export type HeldSlotRow = HeldSlotsRows['slots'][number];

/** Complete local reference admission, before preparation, registration or
 * native construction. Unknown fields and callable selectors never enter it.
 * JSON Schema describes structure; this defining parser also proves references. */
export function parseHeldSlots(input: unknown): HeldSlotsRows {
  if (!isJsonData(input)) throw new Error('Held slots must be JSON data');
  const rows = v.parse(HeldSlotsSchema, input), slots = new Map(rows.slots.map(row => [row.id, row]));
  const unique = (ids: readonly string[]): boolean => new Set(ids).size === ids.length;
  if (slots.size !== rows.slots.length || !unique(rows.slots.map(row => row.item))) throw new Error('Duplicate held slot or item');
  const requireSlot = (id: string): HeldSlotRow => {
    const row = slots.get(id); if (row === undefined) throw new Error(`Unknown held slot ${id}`); return row;
  };
  const weapon = (id: string): HeldSlotRow => {
    const row = requireSlot(id); if (row.kind === 'tool') throw new Error('Held weapon destination contains a tool'); return row;
  };
  if (!unique(rows.registration) || rows.registration.length !== slots.size) throw new Error('Held registration must cover every slot once');
  for (const id of rows.registration) requireSlot(id);
  const equipment = rows.equipment, destinations = [equipment.primary, ...equipment.extras,
    ...(equipment.rifle === undefined ? [] : [equipment.rifle]), ...(equipment.secondary === undefined ? [] : [equipment.secondary])];
  if (!unique(destinations) || destinations.length !== rows.slots.filter(row => row.kind !== 'tool').length) throw new Error('Held equipment must cover every weapon once');
  for (const id of destinations) weapon(id);
  if (equipment.rifle !== undefined && weapon(equipment.rifle).kind !== 'firearm') throw new Error('Held rifle destination requires a firearm');
  for (const ids of [equipment.order ?? [], rows.selection.unlock, rows.mount]) {
    if (!unique(ids)) throw new Error('Duplicate held slot reference');
    for (const id of ids) weapon(id);
  }
  if (rows.selection.initial !== undefined) weapon(rows.selection.initial);
  for (const id of rows.mount) {
    const row = requireSlot(id);
    if (row.kind !== 'bow' && row.kind !== 'polearm' && !(row.kind === 'blade' && row.source.kind === 'passes')) throw new Error('Held mount requires its native mounted owner');
  }
  if (!unique(rows.refills.map(row => row.slot))) throw new Error('Duplicate held refill');
  for (const refill of rows.refills) {
    const row = requireSlot(refill.slot);
    if ((refill.kind === 'add-magazine' && row.kind !== 'bow') || (refill.kind === 'fill-capacity' && row.kind !== 'polearm')) throw new Error('Held refill differs from its native owner');
  }
  if (!unique(rows.upgrades.map(row => row.id)) || !unique(rows.upgrades.map(row => row.replacement.item))) throw new Error('Duplicate held upgrade identity');
  for (const upgrade of rows.upgrades) {
    const row = requireSlot(upgrade.slot);
    if (rows.slots.some(slot => slot.item === upgrade.replacement.item)
      || (upgrade.kind === 'bow' && row.kind !== 'bow')
      || (upgrade.kind === 'blade-pass' && !(row.kind === 'blade' && row.source.kind === 'passes'))) throw new Error('Held upgrade differs from its native owner');
  }
  return rows;
}
