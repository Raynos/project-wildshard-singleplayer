/** Shared manifest admission ceilings, checked before immutable assets or a simulation are opened. */
export const SHARDFILE_ADMISSION_LIMITS = Object.freeze({
  sourceBytes: 2_000_000,
  files: 4096,
  commons: 1024,
  stateFields: 128,
  waterBodies: 64,
  idCharacters: 128,
  textCharacters: 4096,
  wireBytes: 256_000_000,
});
