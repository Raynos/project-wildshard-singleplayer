import hologram from './hologram.graph.json' with { type: 'json' };

/** One idea row of `outputs.json`: the product slug, the idea's asset folder, its display name and HUD accent. */
export interface PlotIdea { readonly slug: string; readonly idea: string; readonly name: string; readonly accent: string }

const pbr = (colour: [number, number, number], roughness = 1) => ({ family: 'pbr', colour, roughness, metalness: 0, maps: { colour: null, normal: null, orm: null }, normalScale: 1, occlusion: 1,
  envStrength: 1, vertexColours: true, faceted: false, doubleSided: false, alphaCutoff: 0, ground: null, measure: null }) as const;

/** The plot's look (G541, G545): the survey floor drawn as SF56's measure grid in the plot navy and cyan, a kerb and frames
 *  in plain PBR, the billboard and sign as lit-from-within pictures, the plinth rim as cyan light, and the idea's hologram
 *  in the ONE shared hologram graph (`data/hologram.graph.json`: additive, fresnel rim, world-Y scanlines and a sweep,
 *  feature edges and a faint wireframe from the generator's edge code, the slow turn about the plinth's axis). */
export const LOOK = {
  grade: { exposure: 0, saturation: 1, contrast: 1, lut: null }, clock: 'engine', familyLooks: {}, families: ['pbr'], graphs: 'required',
  materials: {
    floor: { ...pbr([1, 1, 1]), measure: { structure: [0.5, 0.56, 0.64], trim: [0.5, 0.56, 0.64], floor: [0.05, 0.16, 0.26],
      line: { colour: [0.27, 0.9, 1], alpha: 0.55, floorAlpha: 0.45, width: 0.011 }, sub: { step: 0.25, alpha: 0.1 }, label: { colour: [1, 1, 1], height: 0.36 }, lift: 0.4, plainVariant: true } },
    kerb: pbr([0.62, 0.68, 0.76]), plinth: pbr([1, 1, 1], 0.8), frame: pbr([1, 1, 1], 0.7),
    rim: { family: 'emissive', colour: [0.27, 0.9, 1], intensity: 2, vertexColours: false },
    billboard: { family: 'emissive', colour: [1, 1, 1], intensity: 1 },
    sign: { family: 'emissive', colour: [1, 1, 1], intensity: 1 },
    hologram: { family: 'graph', graph: hologram },
  },
  day: { minutes: 12, start: 0.72, maxElevation: 40, azimuth: 71 }, dayOverride: 0.72,
  keys: [{ time: 0, sky: { zenith: [0.2, 0.22, 0.42], horizon: [0.86, 0.62, 0.58] },
    fog: { colour: [0.62, 0.58, 0.7], density: 0, near: 300, far: 1400 }, sun: { colour: [1, 0.82, 0.68], intensity: 1.5 },
    ambient: { sky: [0.62, 0.66, 0.86], ground: [0.32, 0.34, 0.42], intensity: 0.8 } }],
} as const;

/** An output's identity, accent, spawn and look before the world bake. */
export interface PlotSource {
  readonly identity: { readonly slug: string; readonly name: string; readonly author: string; readonly revision: number; readonly seed: number };
  readonly accent: string; readonly spawn: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }; readonly look: typeof LOOK;
}
/** One output's identity, accent, spawn and look (validated whole by the build's parseShardfile; SF88g: one per idea). */
export function sourceFor(row: PlotIdea): PlotSource {
  return {
    identity: { slug: row.slug, name: `Open Plot · ${row.name}`, author: 'Wildshard', revision: 1, seed: 541 },
    accent: row.accent, spawn: { x: 0, y: 0.1, z: -45, yaw: Math.PI },
    look: LOOK,
  };
}
