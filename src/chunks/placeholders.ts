/**
 * Shard teasers — worlds that show up in the title-screen deck before they are authored.
 *
 * A teaser is only what the menu needs (name, biome, grid, blurb, images); it is deliberately
 * not a `ChunkDef` (no terrain, no assets) so nothing in the engine can try to load one. The
 * hero images are full-bleed backdrops the menu crossfades in behind the deck while the card is
 * selected: `heroPortrait` on tall viewports (aspect < 1), `heroLandscape` otherwise.
 */
import nalatiThumb from './thumbs/nalati-grasslands.jpg';
import nalatiPortrait from './thumbs/nalati-grasslands-portrait.jpg';
import nalatiLandscape from './thumbs/nalati-grasslands-landscape.jpg';
import driftwoodThumb from './thumbs/driftwood-isle.jpg';
import driftwoodPortrait from './thumbs/driftwood-isle-portrait.jpg';
import driftwoodLandscape from './thumbs/driftwood-isle-landscape.jpg';

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

export const PLACEHOLDERS: ShardTeaser[] = [
  {
    slug: 'nalati-grasslands',
    displayName: 'Nalati Grasslands',
    biome: 'Alpine steppe',
    gridCoords: '(+4, −2)',
    blurb: 'Wind-combed steppe under a huge sky. Horse herds on the horizon, larch groves in the folds. Not yet playable.',
    thumbnail: nalatiThumb,
    heroPortrait: nalatiPortrait,
    heroLandscape: nalatiLandscape,
  },
  {
    slug: 'driftwood-isle',
    displayName: 'Driftwood Isle',
    biome: 'Low-poly island · open ocean',
    gridCoords: '(−1, +6)',
    blurb: 'A small low-poly island in a bright ocean, in the spirit of Wind Waker — crossbow hunting among island boar and gulls. Not yet playable.',
    thumbnail: driftwoodThumb,
    heroPortrait: driftwoodPortrait,
    heroLandscape: driftwoodLandscape,
  },
];
