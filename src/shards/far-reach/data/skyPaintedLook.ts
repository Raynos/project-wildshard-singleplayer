import { SEA_DISCS, SEA_LAYERS, paintedMaelstromGraph, paintedSeaGraph } from './cloudSeaLook';
import { SKY_CARDS } from './skyCards';
import { cumulusGraph, fieldCards } from './skyCardsLook';
import { SUN_GLOW_FIELD, sunGlowGraph } from './sunGlowLook';
import { SKY, SKY_DAY, SKY_FOG, SKY_HAZE, SKY_KEY, SKY_PAINTER_LIGHT, SKY_RAYS, SKY_SUN } from './skyLook';
import { SKY_DOME_GRAPH, SKY_LOOK_TEXTURES } from './lookTextures';
import { PANO_FOG_SRGB } from '../look/panoramaData';

const [sunX, sunY, sunZ] = SKY_SUN;

/**
 * Sky Reach's painted look as one row (look/render.ts draws it on the engine's `paintedLook`): `look` is the engine's own
 * spec rows (the painter's light, the key at the painted sun, the fog, the horizon, the NEUTRAL curve, the god rays), `haze`
 * the heading haze over the panorama's fog strip, `day` the fixed clock, `images` the painted images the look loads up front
 * (data/lookTextures.ts) and `dome` the dome's graph per tier.
 */
export const SKY_PAINTED = {
  look: { light: SKY_PAINTER_LIGHT, sun: { ...SKY_KEY, dir: { x: sunX, y: sunY, z: sunZ } }, fog: { color: SKY.fog, near: SKY_FOG.near, far: SKY_FOG.far }, horizon: SKY.horizon,
    neutral: true, rays: SKY_RAYS },
  haze: { ...SKY_HAZE, ...SKY_FOG, strip: PANO_FOG_SRGB }, day: SKY_DAY, images: SKY_LOOK_TEXTURES, dome: SKY_DOME_GRAPH,
} as const;

/**
 * The look's dressing as rows, in draw order: the sun's bloom and light shafts at the painted sun (E392: one instanced draw
 * of its graph), the painted maelstrom under the crown and the two painted cloud-sea layers (E392; lower, then upper: drawn
 * only with their textures), and the cumulus over the sea (loop 5: the camera-facing puffs baked by generators/skyCards.ts).
 */
export const SKY_DRESSING = {
  glow: { graph: sunGlowGraph(SKY_SUN, SUN_GLOW_FIELD.distance), cards: SUN_GLOW_FIELD },
  maelstrom: { graph: paintedMaelstromGraph('far.maelstrom'), disc: SEA_DISCS.paintedMaelstrom },
  seas: [{ graph: paintedSeaGraph('far.cloudsea', SEA_LAYERS.lower.gain, SEA_LAYERS.lower.crown), disc: SEA_DISCS.paintedSea },
    { graph: paintedSeaGraph('far.cloudsea', SEA_LAYERS.upper.gain, SEA_LAYERS.upper.crown), disc: SEA_DISCS.paintedSeaUpper }],
  cumulus: { graph: cumulusGraph(SKY_SUN, 'far.cumulus'), cards: fieldCards(SKY_CARDS.cumulus) },
} as const;
