/**
 * Shard teasers — worlds that show up in the title-screen deck before they are authored.
 *
 * A teaser is only what the menu needs (name, biome, grid, blurb, images); it is deliberately
 * not a `ChunkDef` (no terrain, no assets) so nothing in the engine can try to load one. The
 * hero images are full-bleed backdrops the menu crossfades in behind the deck while the card is
 * selected: `heroPortrait` on tall viewports (aspect < 1), `heroLandscape` otherwise.
 */
// Nalati Grasslands graduated to a real shard (src/chunks/nalati-grasslands.ts); its thumb / hero images moved with it.
// Nine Dragon Stack (shard 4, docs/plans/NINE-DRAGON-STACK.md): every picture is an in-engine capture of the partial shard
// (src/chunks/nine-dragon-stack/, free camera, no HUD) — a prototype fragment, not the finished shard, hence the PROTOTYPE
// caption. The poses are the four mockup cameras (mockupCameras.ts) + a bridge in the Well.
import nineThumb from './thumbs/nine-dragon-stack.jpg';
import ninePortrait from './thumbs/nine-dragon-stack-portrait.jpg';
import nineLandscape from './thumbs/nine-dragon-stack-landscape.jpg';
import nineWellEdgeP from './teasers/nine-dragon-stack/01-well-edge-portrait.jpg';
import nineWellEdgeL from './teasers/nine-dragon-stack/01-well-edge-landscape.jpg';
import nineWellEdgeT from './teasers/nine-dragon-stack/01-well-edge-thumb.jpg';
import nineWellDownP from './teasers/nine-dragon-stack/02-well-down-portrait.jpg';
import nineWellDownL from './teasers/nine-dragon-stack/02-well-down-landscape.jpg';
import nineWellDownT from './teasers/nine-dragon-stack/02-well-down-thumb.jpg';
import nineStairP from './teasers/nine-dragon-stack/03-stair-street-portrait.jpg';
import nineStairL from './teasers/nine-dragon-stack/03-stair-street-landscape.jpg';
import nineStairT from './teasers/nine-dragon-stack/03-stair-street-thumb.jpg';
import nineBridgeP from './teasers/nine-dragon-stack/04-bridge-portrait.jpg';
import nineBridgeL from './teasers/nine-dragon-stack/04-bridge-landscape.jpg';
import nineBridgeT from './teasers/nine-dragon-stack/04-bridge-thumb.jpg';

/** one more backdrop for a teaser's hero slideshow: the same scene in both orientations + what it shows */
export interface TeaserShot {
  portrait: string;
  landscape: string;
  /** the same scene at the card's 16:9 (640×360): the deck card crossfades with the backdrop */
  thumb: string;
  /** the caption chip while it shows ("LANTERN SQUARE · +125 M") */
  caption: string;
}

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
  /** the hero's caption; with `screens`, the menu crossfades hero → screens → hero while the card is selected. The
   *  screens live outside `thumbs/` (src/chunks/teasers/), so they are not boot art: each loads when the slideshow nears it */
  heroCaption?: string;
  screens?: TeaserShot[];
}

export const PLACEHOLDERS: ShardTeaser[] = [
  {
    slug: 'nine-dragon-stack',
    displayName: 'Nine Dragon Stack',
    biome: 'Vertical neon city',
    gridCoords: '(−2, +1)',
    blurb: 'Nine strata of neon stacked 500 m high, from the flooded Sump to the antenna Crown. You wake on Lantern Square, halfway up the sky, and every level below you feels like the ground. Not yet playable.',
    thumbnail: nineThumb,
    heroPortrait: ninePortrait,
    heroLandscape: nineLandscape,
    heroCaption: 'Lantern Square · +125 m',
    screens: [
      { portrait: nineWellEdgeP, landscape: nineWellEdgeL, thumb: nineWellEdgeT, caption: 'The Yamen Well · 375 m down' },
      { portrait: nineWellDownP, landscape: nineWellDownL, thumb: nineWellDownT, caption: 'Down the Well · the galleries' },
      { portrait: nineStairP, landscape: nineStairL, thumb: nineStairT, caption: 'The stair-street · Terrace Row' },
      { portrait: nineBridgeP, landscape: nineBridgeL, thumb: nineBridgeT, caption: 'Crossing the Well · +121 m' },
    ],
  },
];
