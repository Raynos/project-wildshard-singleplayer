/**
 * Where Nalati's baked creature coats live (scripts/bake-coats.mjs --shard=nalati-grasslands; species/rigs.ts
 * nalatiCoatUrl names each file). Its own module, with no imports, so the boot file list (boot/files.ts, in the
 * manifest's static closure) can name the folder.
 */
export const NALATI_COAT_DIR = '/assets/nalati/models/coats/';
