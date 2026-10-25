import * as v from 'valibot';
import { CueDirectorSchema } from './cueDirector';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
/** Compiled cue presentation binds an admitted held secondary to one cue id. */
export const ClientCuesSchema: v.StrictObjectSchema<{ readonly kind: v.GenericSchema<ClientCuesRowsInput['kind'], ClientCuesRows['kind']>; readonly id: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientCuesRowsInput['id'], undefined>, Exclude<ClientCuesRows['id'], undefined>>, undefined>; readonly stage: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientCuesRowsInput['stage'], undefined>, Exclude<ClientCuesRows['stage'], undefined>>, undefined>; readonly clock: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientCuesRowsInput['clock'], undefined>, Exclude<ClientCuesRows['clock'], undefined>>, undefined>; readonly rows: v.GenericSchema<ClientCuesRowsInput['rows'], ClientCuesRows['rows']>; readonly secondary: v.ExactOptionalSchema<v.GenericSchema<Exclude<ClientCuesRowsInput['secondary'], undefined>, Exclude<ClientCuesRows['secondary'], undefined>>, undefined>; }, undefined> = v.strictObject({ kind: v.literal('audio.cues'), id: v.exactOptional(id), stage: v.exactOptional(v.picklist(['world', 'play'])), clock: v.exactOptional(v.picklist(['owner', 'system'])), rows: CueDirectorSchema,
  secondary: v.exactOptional(v.strictObject({ item: id, cue: id })),
});

/** Admitted data contracts, independent of validator implementation metadata. */
interface ClientCuesRowsInputFields {
    kind: 'audio.cues';
    id?: string;
    stage?: 'world' | 'play';
    clock?: 'owner' | 'system';
    rows: v.InferInput<typeof CueDirectorSchema>;
    secondary?: {
        item: string;
        cue: string;
    };
}
export type ClientCuesRowsInput = { [Key in keyof ClientCuesRowsInputFields]: ClientCuesRowsInputFields[Key] };
interface ClientCuesRowsFields {
    kind: 'audio.cues';
    id?: string;
    stage?: 'world' | 'play';
    clock?: 'owner' | 'system';
    rows: v.InferOutput<typeof CueDirectorSchema>;
    secondary?: {
        item: string;
        cue: string;
    };
}
export type ClientCuesRows = { [Key in keyof ClientCuesRowsFields]: ClientCuesRowsFields[Key] };
