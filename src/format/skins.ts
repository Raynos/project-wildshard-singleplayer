import * as v from 'valibot';

/** The look recipe for an exported skin, and its animation recipe. */
export const SKIN_LOOK_RECIPE = 'platform.skin';
/** The animation recipe that consumes the exported skin clip parameters. */
export const SKIN_CLIPS_RECIPE = 'platform.clips';
const hash = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/u));
/** The look row's parameters. */
export const SkinLookParametersSchema: v.GenericSchema<SkinLookParametersRowsInput, SkinLookParametersRows> = v.strictObject({ skin: hash });
/** The animation recipe's parameters. */
export const SkinClipParametersSchema: v.GenericSchema<SkinClipParametersRowsInput, SkinClipParametersRows> = v.strictObject({ attackSpan: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0.05), v.maxValue(10)), 1) });
/** The content-addressed skin file: one export row and its binding (validated together by the SF9c parsers). */
export const ShardSkinFileSchema: v.GenericSchema<ShardSkinFileRowsInput, ShardSkinFileRows> = v.strictObject({ row: v.unknown(), binding: v.unknown() });

/** A parsed skin look: the file it names and the attack span its clip was sampled with. */
export interface SkinLookParameters { skin: string; attackSpan: number }

/** Admitted data contracts, independent of validator implementation metadata. */
export type SkinLookParametersRowsInput = SkinLookParametersRows;
interface SkinLookParametersRowsFields {
    skin: string;
}
export type SkinLookParametersRows = { [Key in keyof SkinLookParametersRowsFields]: SkinLookParametersRowsFields[Key] };
interface SkinClipParametersRowsInputFields {
    attackSpan?: number | undefined;
}
export type SkinClipParametersRowsInput = { [Key in keyof SkinClipParametersRowsInputFields]: SkinClipParametersRowsInputFields[Key] };
interface SkinClipParametersRowsFields {
    attackSpan: number;
}
export type SkinClipParametersRows = { [Key in keyof SkinClipParametersRowsFields]: SkinClipParametersRowsFields[Key] };
export type ShardSkinFileRowsInput = ShardSkinFileRows;
interface ShardSkinFileRowsFields {
    row: unknown;
    binding: unknown;
}
export type ShardSkinFileRows = { [Key in keyof ShardSkinFileRowsFields]: ShardSkinFileRowsFields[Key] };
