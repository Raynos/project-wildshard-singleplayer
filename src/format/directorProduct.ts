import * as v from 'valibot';
import { DirectorSchema, type DirectorData } from './director.ts';
import { DirectorStagesSchema, type DirectorStagesData, type DirectorStagesDataInput } from './directorStages.ts';

/** Complete existing director document shared by authored native director hosts.
 * Binary loading, declaration/hash agreement, ownership and fuel remain the
 * installing host's admission responsibilities. */
export const DirectorProductSchema: v.GenericSchema<DirectorProductInput, DirectorProduct> = v.strictObject({
  declaration: DirectorSchema,
  module: v.strictObject({ module: v.string(), bytes: v.string(),
    file: v.exactOptional(v.pipe(v.string(), v.minLength(1), v.maxLength(240))) }),
  stages: DirectorStagesSchema, bindings: v.null(), seed: v.number(),
});

/** Authored transport envelope before director-stage defaults are admitted. */
export interface DirectorProductInput {
  declaration: DirectorData;
  module: { module: string; bytes: string; file?: string };
  stages: DirectorStagesDataInput;
  bindings: null;
  seed: number;
}

/** Structurally admitted document; not permission to install its native module. */
export interface DirectorProduct extends Omit<DirectorProductInput, 'stages'> {
  stages: DirectorStagesData;
}
