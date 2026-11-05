import * as v from 'valibot';
import { BladeRowsSchema, PolearmRowsSchema, ArcWeaponRowsSchema, type BladeRows, type PolearmRows, type ArcWeaponRows } from './heldMelee.ts';
import { ReturnProgramDocumentSchema, type ReturnProgramDocument } from './returnProgramDocument.ts';
import { HeldSlotsSchema, type HeldSlotsRows } from './heldArms.ts';
import { BowVariantSchema } from './bowVariantRows.ts';

type SignalledProgram<Signal extends string> = ReturnProgramDocument & { signal: Signal };
type ArcDocument = Omit<ArcWeaponRows, 'program'> & { program: SignalledProgram<'power'> };
export type BladeDocument = Omit<BladeRows, 'program' | 'power'> & { program: SignalledProgram<'blade'>; power: ArcDocument };
export type PolearmDocument = Omit<PolearmRows, 'program'> & { program: SignalledProgram<'polearm'> };

const power: v.GenericSchema<unknown, ArcDocument> = v.intersect([ArcWeaponRowsSchema,
  v.looseObject({ program: v.intersect([ReturnProgramDocumentSchema, v.looseObject({ signal: v.literal('power') })]) })]);

/** Complete native blade envelope: the existing strict geometry/move grammar
 * plus the full decision guest and power guest, never an opaque program bag.
 * Intersections retain the original admitted fields and the native parser.
 * Each projection permits the other keys already closed by the first strict
 * grammar, so the JSON allOf does not accidentally forbid sibling fields. */
export const BladeDocumentSchema: v.GenericSchema<unknown, BladeDocument> = v.intersect([BladeRowsSchema,
  v.looseObject({ program: v.intersect([ReturnProgramDocumentSchema, v.looseObject({ signal: v.literal('blade') })]), power })]);

/** Complete native polearm envelope, retaining the original throw, recover,
 * lance, pose and resource contracts and its exact signalled decision guest. */
export const PolearmDocumentSchema: v.GenericSchema<unknown, PolearmDocument> = v.intersect([PolearmRowsSchema,
  v.looseObject({ program: v.intersect([ReturnProgramDocumentSchema, v.looseObject({ signal: v.literal('polearm') })]) })]);

const slot = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
const name = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
/** The existing slots grammar and parser still own coverage, destinations and
 * registration order. The additional projection closes each upgrade guest. */
export const HeldSlotsDocumentSchema: v.GenericSchema<unknown, HeldSlotsRows> = v.intersect([HeldSlotsSchema,
  v.looseObject({ upgrades: v.pipe(v.array(v.strictObject({ id: slot, slot, kind: v.picklist(['bow', 'blade-pass']),
    replacement: v.strictObject({ item: v.pipe(v.string(), v.regex(/^weapon\.[a-zA-Z0-9][a-zA-Z0-9.-]*$/u), v.maxLength(128)), name }),
    power: v.exactOptional(v.strictObject({ kind: v.literal('charged-pierce'),
      rows: v.intersect([BowVariantSchema, v.looseObject({ program: ReturnProgramDocumentSchema })]) })) })), v.maxLength(16)) })]);
