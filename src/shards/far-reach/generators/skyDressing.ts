import type { GraphIr } from '@wildshard/format/materialGraph';
import type { CardGroupRow } from '@wildshard/sdk/looks/cardField';
import { SKY_SUN } from '../data/skyLook';
import { SKY_CARDS } from '../data/skyCards';
import { skyDomeGraph } from './skyDomeLook';
import { SEA_DISCS, SEA_LAYERS, paintedMaelstromGraph, paintedSeaGraph } from './cloudSeaLook';
import { cumulusGraph, fieldCards } from './skyCardsLook';
import { SUN_GLOW_FIELD, sunGlowGraph } from './sunGlowLook';

/** columns of wrap on either side of the shipped panorama strips (the dome's graph maps the heading inside them) */
const PANO_PAD_PX = 16;

/**
 * The dome's graph per tier: the strip carries PANO_PAD_PX columns of wrap either side of its shipped width (5562 px on
 * desktop, 4128 on the phone; art/far-reach/round-14-loop-4/pano/prep.py), and the heading maps inside them.
 */
const domeGraph = (width: number): ReturnType<typeof skyDomeGraph> => skyDomeGraph(PANO_PAD_PX / width, (width - PANO_PAD_PX * 2) / width);

type Disc = (typeof SEA_DISCS)[keyof typeof SEA_DISCS];
/** The dressing's rows: each graph with the card field or disc it draws on. */
export interface SkyDressingRows {
  readonly dome: { readonly phone: GraphIr; readonly desktop: GraphIr };
  readonly glow: { readonly graph: GraphIr; readonly cards: CardGroupRow };
  readonly maelstrom: { readonly graph: GraphIr; readonly disc: Disc };
  readonly seas: readonly { readonly graph: GraphIr; readonly disc: Disc }[];
  readonly cumulus: { readonly graph: GraphIr; readonly cards: CardGroupRow };
}


/**
 * Sky Reach's painted dressing as finished SF59 graph rows (SHARDFILE S4: built once here, written to
 * data/skyDressing.generated.json by the `sky-dressing` job; look/render.ts reads the JSON), in draw order: the dome per
 * tier, the sun's bloom and light shafts at the painted sun (E392: one instanced draw of its graph), the painted maelstrom
 * under the crown and the two painted cloud-sea layers (E392; lower, then upper: drawn only with their textures), and the
 * cumulus over the sea (loop 5: the camera-facing puffs baked by generators/skyCards.ts).
 */
export function skyDressingRows(): SkyDressingRows {
  const { distance, ...glowCards } = SUN_GLOW_FIELD;
  return {
    dome: { phone: domeGraph(4128), desktop: domeGraph(5562) },
    glow: { graph: sunGlowGraph(SKY_SUN, distance), cards: glowCards },
    maelstrom: { graph: paintedMaelstromGraph('far.maelstrom'), disc: SEA_DISCS.paintedMaelstrom },
    seas: [{ graph: paintedSeaGraph('far.cloudsea', SEA_LAYERS.lower.gain, SEA_LAYERS.lower.crown), disc: SEA_DISCS.paintedSea },
      { graph: paintedSeaGraph('far.cloudsea', SEA_LAYERS.upper.gain, SEA_LAYERS.upper.crown), disc: SEA_DISCS.paintedSeaUpper }],
    cumulus: { graph: cumulusGraph(SKY_SUN, 'far.cumulus'), cards: fieldCards(SKY_CARDS.cumulus) },
  };
}
