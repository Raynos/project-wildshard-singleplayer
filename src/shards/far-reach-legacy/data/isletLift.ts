import { RISING_ISLETS, type P3, type RisingIslet } from '../world/islets';

/** The mover id of an entry's islet. */
const isletId = (entry: RisingIslet): string => `far.islet.${entry.edge}`;
/** The mover id of an entry's stationary road gate (SF8c socketLift). */
const gateId = (entry: RisingIslet): string => `far.islet.${entry.edge}.gate`;
/** SF8c: an entry's declared socketLift link (shard.config.ts's entryway; the platform proves and commands it). */
function isletLift(entry: RisingIslet): { mover: string; gate: string; roadStop: [number, number, number]; topStop: [number, number, number]; route: [number, number, number][]; rideTicks: number; approach: { colliders: string[]; route: [number, number, number][] } } {
  const v = (p: P3): [number, number, number] => [p.x + 0, p.y + 0, p.z + 0]; // JSON data: never −0
  return { mover: isletId(entry), gate: gateId(entry), roadStop: v(entry.rest), topStop: v(entry.dock), route: entry.lift.route.map(v), rideTicks: entry.lift.rideTicks,
    approach: { colliders: [`landing.${entry.edge}`], route: entry.lift.approach.map(v) } };
}

/** The four socket lifts as serializable declarations, in the authored edge order. */
export const ISLET_LIFTS = RISING_ISLETS.map(entry => ({ edge: entry.edge, lift: isletLift(entry) }));
