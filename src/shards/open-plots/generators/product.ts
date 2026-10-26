import { emptyShardfile } from '@wildshard/sdk/author';
import declared from '../outputs.json' with { type: 'json' };
import source from '../data/source.json' with { type: 'json' };
import hologram from '../data/hologram.graph.json' with { type: 'json' };
import glowFlicker from '../data/glowFlicker.graph.json' with { type: 'json' };
import poolFlicker from '../data/poolFlicker.graph.json' with { type: 'json' };
import poster from '../data/poster.graph.json' with { type: 'json' };
import paving from '../data/paving.graph.json' with { type: 'json' };

/** The open-plots source shard (SF88g, G538/G539/G541/G542/G545): data rows (`outputs.json`, one product per idea) and one
 *  build-time generator (`generators/bake-plots.mjs`, which writes each idea's `assets/<idea>/world.glb`); this module
 *  assembles each idea's product at build time (shard.config.ts is its documented entry); no runtime code. The world bake turns a plot into tiles, collision (its `collide_` nodes only), edges and a far proxy.
 *  `data/source.json` holds the plot's authorship, spawn and look (G541, G545: the measure-grid survey floor, plain PBR
 *  kerb and frames, lit-from-within billboard and sign, cyan rim); each hologram draws in the shared graph. */
const look: { materials: { hologram: { family: string; graph: typeof hologram; }; billboard: { family: string; graph: typeof poster; }; floor: { family: string; colour: number[]; roughness: number; metalness: number; maps: { colour: null; normal: null; orm: null; }; normalScale: number; occlusion: number; envStrength: number; vertexColours: boolean; faceted: boolean; doubleSided: boolean; alphaCutoff: number; ground: null; measure: { structure: number[]; trim: number[]; floor: number[]; line: { colour: number[]; alpha: number; floorAlpha: number; width: number; }; sub: { step: number; alpha: number; }; label: { colour: number[]; height: number; }; lift: number; }; }; kerb: (typeof source)["tiledMaterials"]["water"]; plinth: (typeof source)["tiledMaterials"]["water"]; frame: (typeof source)["tiledMaterials"]["water"]; rim: (typeof source)["tiledMaterials"]["glow"]; sign: { family: string; colour: number[]; intensity: number; }; }; grade: (typeof source)["look"]["grade"]; clock: string; familyLooks: (typeof source)["look"]["familyLooks"]; families: (typeof source)["look"]["families"]; day: (typeof source)["look"]["day"]; dayOverride: number; keys: (typeof source)["look"]["keys"]; } = { ...source.look, materials: { ...source.look.materials,
  hologram: { family: 'graph', graph: hologram },
  billboard: { family: 'graph', graph: poster } } };

const { why: _why, ...tiledMaterials } = source.tiledMaterials;
/** G641: a tiled plot's look adds the kit's materials (generators/tiledPlot.mjs) */
// NM10: the lanterns, windows and their light pools flicker a little, each on its own phase (world position), unlit as the
// emissive family drew them (glow x2.4 +-12 %, pool additive x1.2 +-8 %); the glow also moves and lights the marked
// fireflies and sky lanterns (kit.mjs `mover`)
const tiledLook: { materials: { glow: { family: string; graph: typeof glowFlicker; }; pool: { family: string; graph: typeof poolFlicker; }; paving: { family: string; graph: typeof paving; }; kit: (typeof look)["materials"]["frame"]; landmark: (typeof look)["materials"]["frame"]; water: (typeof look)["materials"]["frame"]; hologram: (typeof look)["materials"]["hologram"]; billboard: (typeof look)["materials"]["billboard"]; floor: (typeof look)["materials"]["floor"]; kerb: (typeof look)["materials"]["frame"]; plinth: (typeof look)["materials"]["frame"]; frame: (typeof look)["materials"]["frame"]; rim: (typeof look)["materials"]["rim"]; sign: (typeof look)["materials"]["sign"]; }; grade: (typeof look)["grade"]; clock: string; familyLooks: (typeof look)["familyLooks"]; families: (typeof look)["families"]; day: (typeof look)["day"]; dayOverride: number; keys: (typeof look)["keys"]; } = { ...look, materials: { ...look.materials, ...tiledMaterials,
  glow: { family: 'graph', graph: glowFlicker }, pool: { family: 'graph', graph: poolFlicker },
  // RM5.1: the paving ruled in its material (flagstones, joints, per-stone shade and wear; no texture), over its vertex colours
  paving: { family: 'graph', graph: paving } } };

/** One idea row's output (validated whole by the build's parseShardfile; SF88g: one per idea). */
function project(row: { readonly slug: string; readonly idea: string; readonly name: string; readonly accent: string; readonly layout?: string }): (Omit<ReturnType<typeof emptyShardfile>, "identity" | "accent" | "spawn" | "look" | "world"> & {
    identity: { slug: string; name: string; author: string; revision: number; seed: number; };
    accent: string;
    spawn: (typeof source)["spawn"];
    look: typeof tiledLook;
    // NM5: its own near view from its coarse tiles, so the road sees the tiles instead of the far proxy
    world: { glb: string; colliders: string; far: string; farMode: string; near: string; materials: { Paving: string; Kit: string; Water: string; Glow: string; Pool: string; Landmark: string; Poster: string; Floor?: never; Kerb?: never; Plinth?: never; Rim?: never; Frame?: never; Billboard?: never; Sign?: never; Hologram?: never; }; };
}) | (Omit<ReturnType<typeof emptyShardfile>, "identity" | "accent" | "spawn" | "look" | "world"> & {
    identity: { slug: string; name: string; author: string; revision: number; seed: number; };
    accent: string;
    spawn: (typeof source)["spawn"];
    look: typeof look;
    // G608: the `far_` stand-ins draw only in the far proxy
    world: { glb: string; colliders: string; far: string; materials: { Floor: string; Kerb: string; Plinth: string; Rim: string; Frame: string; Billboard: string; Sign: string; Hologram: string; Glow: string; Paving?: never; Kit?: never; Water?: never; Pool?: never; Landmark?: never; Poster?: never; }; farMode?: never; near?: never; };
}) {
  const identity = { slug: row.slug, name: `Open Plot · ${row.name}`, author: source.author, revision: source.revision, seed: source.seed };
  // G641: a row with a layout is a tiled plot; its far proxy is its far-only stand-ins alone (NM0's farMode 'replace')
  if (row.layout !== undefined) return { ...emptyShardfile(identity), identity, accent: row.accent, spawn: source.spawn, look: tiledLook,
    // NM5: its own near view from its coarse tiles, so the road sees the tiles instead of the far proxy
    world: { glb: `assets/${row.idea}/world.glb`, colliders: 'nodes:collide_', far: 'far_', farMode: 'replace', near: 'coarse',
      materials: { Paving: 'paving', Kit: 'kit', Water: 'water', Glow: 'glow', Pool: 'pool', Landmark: 'landmark', Poster: 'billboard' } },
  };
  return { ...emptyShardfile(identity), identity, accent: row.accent, spawn: source.spawn, look,
    // G608: the `far_` stand-ins draw only in the far proxy
    world: { glb: `assets/${row.idea}/world.glb`, colliders: 'nodes:collide_', far: 'far_',
      materials: { Floor: 'floor', Kerb: 'kerb', Plinth: 'plinth', Rim: 'rim', Frame: 'frame', Billboard: 'billboard', Sign: 'sign', Hologram: 'hologram', Glow: 'rim' } },
  };
}

const [first] = declared.outputs;
if (first === undefined) throw new Error('open-plots: outputs.json needs an idea row');

/** Every output, keyed by its product slug (`wildshard build --output=<slug>`, scripts/shard-outputs.mjs). */
export const outputs: Record<string, ReturnType<typeof project>> = Object.fromEntries(declared.outputs.map((row): [string, ReturnType<typeof project>] => [row.slug, project(row)]));

/** The first idea's output: the project's default build. */
export const product: ReturnType<typeof project> = project(first);
