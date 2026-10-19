import { DRIFTWOOD_REGULAR_DECISIONS } from './driftwoodRegularCombat';

/** Observation-only extension. Tactics and strike/move declarations remain original. */
export const MANTIS_PHASE_FIELDS = [
  { id: 107, name: 'mantis-pose-phase', type: 'f64' as const, privacy: 'public' as const, default: 0, min: 0, max: 4 },
  { id: 108, name: 'mantis-pose-clock', type: 'f64' as const, privacy: 'public' as const, default: 0, min: 0, max: 60 },
];
function observe(row: (typeof DRIFTWOOD_REGULAR_DECISIONS)[number]) { return {
  ...row, source: 'behaviour/splinterMantisPhase.as',
  fields: { ...row.fields, posePhase: 'mantis-pose-phase', poseClock: 'mantis-pose-clock' },
  state: [...row.state,
    { name: 'posePhase', type: 'i32' as const, default: 0, min: 0, max: 4, scope: 'binding' as const },
    { name: 'poseClock', type: 'f64' as const, default: 0, min: 0, max: 60, scope: 'binding' as const }],
}; }
export const MANTIS_PHASE_DECISIONS: ReturnType<typeof observe>[] = [];
for (const row of DRIFTWOOD_REGULAR_DECISIONS) if (row.id === 'driftwood.splinter-mantis.decision') MANTIS_PHASE_DECISIONS.push(observe(row));
