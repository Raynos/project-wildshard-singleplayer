import * as v from 'valibot';
import { ManifestMetadataSchema } from './minimap';

/** Plain boot configuration, separate from title-card metadata and native code
 * loaders. Binding descriptors are build inputs; they never execute here. */
export const LevelSectionSchema = v.strictObject({ manifest: ManifestMetadataSchema });
export type LevelSection = v.InferOutput<typeof LevelSectionSchema>;
