import { parseGroupBrain } from '@wildshard/format/groupBrains';

/** One admitted group policy and its explicit ordered stable actor roster. */
export type GroupBrainData = ReturnType<typeof parseGroupBrain>;
/** Validate a pack or guarded-herd controller before loading its native world recipes. */
export function groupBrain(data: unknown): GroupBrainData { return parseGroupBrain(data); }
