/**
 * Shard teasers — worlds that show up in the title-screen deck before they are authored.
 *
 * A teaser is only what the menu needs (name, biome, grid, blurb, images); it is deliberately
 * not a `ChunkDef` (no terrain, no assets) so nothing in the engine can try to load one. The
 * hero images are full-bleed backdrops the menu crossfades in behind the deck while the card is
 * selected: `heroPortrait` on tall viewports (aspect < 1), `heroLandscape` otherwise.
 */
// Nalati Grasslands graduated to a real shard (src/chunks/nalati-grasslands.ts); its thumb / hero images moved with it.

export interface ShardTeaser {
  slug: string;
  displayName: string;
  biome: string;
  gridCoords: string;
  blurb: string;
  /** 16:9 card image (640×360) */
  thumbnail: string;
  /** full-bleed hero backdrops for the menu (portrait for aspect < 1, landscape otherwise) */
  heroPortrait: string;
  heroLandscape: string;
}

export const PLACEHOLDERS: ShardTeaser[] = [];
