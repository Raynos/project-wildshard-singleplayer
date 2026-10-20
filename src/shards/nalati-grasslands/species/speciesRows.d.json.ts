import type { CreatureFrameRows } from '@wildshard/format/creatureFrame';
import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';

type Tuning = Omit<SpeciesDef, 'build' | 'postPose' | 'act' | 'think' | 'animate' | 'damageMul' | 'fur'>;
/** Authored species metadata, combat measurements and crack positions. */
declare const rows: { kingFrame: Omit<CreatureFrameRows, 'defaults' | 'observations' | 'pose'>; kingPoseDefaults: Record<string, number>; balbal: Tuning; king: Tuning; slam: { reach: number; cone: number; windup: number; strike: number }; weak: [number, number, number][] };
// oxlint-disable-next-line import/no-default-export -- TypeScript requires a default declaration for this JSON module.
export default rows;
