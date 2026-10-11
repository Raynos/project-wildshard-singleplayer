/** Fixed wire-space cell dimensions; native engine configuration must agree (format-wire-limits.test.ts). */
export const WIRE_CELL = Object.freeze({ half: 250, below: 250, above: 250, entryWidth: 8 });
/** Bounded presentation-lane wire capacity; native engine capacity must agree with this contract. */
export const CLIENT_SCRIPT_LIMITS = Object.freeze({ bindings: 128, particlesPerTick: 256, particlesLive: 4096, emitters: 16, fields: 24, parameters: 64 });
/** Calibration in the measured runtime wire contract; the native allocator must use the same factor. */
export const RUNTIME_RESIDENT_FACTOR = 1.11;
/** Declared weapon-hook phases; admission and native phase numbering must agree. */
export const WEAPON_HOOK_PHASES = ['pass'] as const;
