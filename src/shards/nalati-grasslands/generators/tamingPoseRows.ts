import { NALATI_BODY_ROWS as rows } from './bodies';
import { bodyKey } from './bodyKey';
import { bodySpecies } from './speciesRows';
import { SPECIES_POSES } from './speciesPoses';

type Horse = ReturnType<typeof bodySpecies>;
interface Pose {
  custom: boolean;
  deathSplay: boolean;
  gait?: NonNullable<Horse['gait']>;
  pose?: NonNullable<Horse['pose']>;
  joints: { name: string; parent: number; position: [number, number, number]; order: 'XYZ'; scale: [number, number, number] }[];
}
/** Complete owned native joint recipes and the existing numeric horse pose DAGs. */
export interface NalatiTamingPoseRows {
  poses: { kind: string; variant: string; pose: Pose }[];
  horse: (typeof SPECIES_POSES)['horse'];
}

/** Construct relative joints directly from authored body metadata, without invoking the body geometry builders.
 * Preserve parent order, zero defaults, gait/pose fields and the extra Argymaq stallion row. */
export function nalatiTamingPoseRows(): NalatiTamingPoseRows {
  const horse = bodySpecies('horse');
  const poses = horse.variants.flatMap(variant => {
    const body = rows.bodies.find(row => row.key === bodyKey('horse', variant));
    if (body === undefined || body.bones.length > 32) throw new Error('Missing taming horse hierarchy');
    const pose: Pose = { custom: false, deathSplay: false,
      ...(horse.gait === undefined ? {} : { gait: horse.gait }),
      ...(horse.pose === undefined ? {} : { pose: horse.pose }),
      joints: body.bones.map((bone, index) => {
        const parent = bone.parent === null ? -1 : body.bones.findIndex(row => row.name === bone.parent);
        if (bone.parent !== null && (parent < 0 || parent >= index)) throw new Error('Taming joints must follow parent order');
        const at = body.bones[parent];
        return { name: bone.name, parent,
          position: [(bone.pos[0] ?? 0) - (at?.pos[0] ?? 0), (bone.pos[1] ?? 0) - (at?.pos[1] ?? 0), (bone.pos[2] ?? 0) - (at?.pos[2] ?? 0)],
          order: 'XYZ', scale: [1, 1, 1] };
      }) };
    const entries = [{ kind: 'horse', variant: variant.id, pose }];
    if (variant.id === 'stallion') entries.push({ kind: 'argymaq', variant: variant.id, pose });
    return entries;
  });
  return structuredClone({ poses, horse: SPECIES_POSES.horse });
}
