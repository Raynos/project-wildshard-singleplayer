import { chimeGeometry } from './seaGlassChime';
import { plaquesGeometry } from './trophyPlaques';
import { TROPHY_LAYOUT } from './trophyLayout';
import { coverGeometry } from './groundCover';

/** Original chime slot facts, constructed without a generated source handoff. */
export function driftwoodChimeSlots(): ReturnType<typeof chimeGeometry>['ranges'] {
  const built = chimeGeometry();
  try { return structuredClone(built.ranges); } finally { built.geometry.dispose(); }
}

/** Original mounted trophy ranges and the empty/full board mapping. */
export function driftwoodTrophySlots(): Omit<ReturnType<typeof plaquesGeometry>, 'geometry'> {
  const built = plaquesGeometry(TROPHY_LAYOUT.gap);
  try {
    return structuredClone({ ranges: built.ranges, boards: built.boards, empty: built.empty, full: built.full });
  } finally { built.geometry.dispose(); }
}

/** The original area-weighted near-plant colour/cover facts, computed from their defining geometry. */
export function driftwoodCoverLook(): ReturnType<typeof coverGeometry>['look'] {
  const built = coverGeometry();
  try { return structuredClone(built.look); } finally { for (const geometry of Object.values(built.geometry)) geometry.dispose(); }
}
