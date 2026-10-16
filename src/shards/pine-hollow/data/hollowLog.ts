/**
 * The hollow log's size (PINE-HOLLOW-REMASTER PH-C8): length, outer and bore radius (m), and how deep the rotted bed
 * fills the bore's bottom. Its shell is baked offline at this size (../generators/codeParts.ts); its colliders
 * (../models/hollowLog.ts) and its site (../quest/hollowLog.ts) read the same row.
 */
export const HOLLOW_LOG_SHAPE = { len: 11, R: 1.6, r: 1.3, bed: 0.42 } as const;
