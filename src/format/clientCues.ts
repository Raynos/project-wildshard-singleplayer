import * as v from 'valibot';
import { CueDirectorSchema } from './cueDirector';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
/** Compiled cue presentation binds an admitted held secondary to one cue id. */
export const ClientCuesSchema = v.strictObject({ kind: v.literal('audio.cues'), id: v.exactOptional(id), stage: v.exactOptional(v.picklist(['world', 'play'])), clock: v.exactOptional(v.picklist(['owner', 'system'])), rows: CueDirectorSchema,
  secondary: v.exactOptional(v.strictObject({ item: id, cue: id })),
});
