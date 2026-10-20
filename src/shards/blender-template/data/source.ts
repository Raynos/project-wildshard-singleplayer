import type { Shardfile } from '@wildshard/sdk/shardfile';
import { CARD_HASH } from './card';

/** The dev-map clay: the hall's structures (pbr) and the ground the baked tiles draw with its lightmaps (ground, G532). */
const MEASURED = { family: 'pbr', colour: [1, 1, 1], roughness: 1, metalness: 1, maps: { colour: null, normal: null, orm: null }, normalScale: 1, occlusion: 1, envStrength: 1, vertexColours: true, faceted: true, doubleSided: false, alphaCutoff: 0, ground: null, measure: { structure: [1, 0.58, 0.12], trim: [0.45, 0.45, 0.46], floor: [0.75, 0.74, 0.71],
        line: { colour: [1, 1, 1], alpha: 0.7, floorAlpha: 0.55, width: 0.011 }, sub: { step: 0.25, alpha: 0.12 }, label: { colour: [1, 1, 1], height: 0.36 }, lift: 0.4, plainVariant: true } } satisfies Shardfile['look']['materials'][string];

/** Build and catalogue share identity, presentation and look; asset admission happens at the build boundary. The clay and road
 *  surfaces draw SF56's measure layer, the dev map (G527), with the Blender clay as its Debug variant; the door keeps its planks. */
export const SOURCE = {
  identity: { slug: 'blender-template', name: 'Blender Template', author: 'Wildshard', revision: 1, seed: 55 },
  accent: 'teal', spawn: { x: 0, y: 0.1, z: 9, yaw: Math.PI },
  presentation: { biome: 'Blender clay prototype', blurb: 'Cross the high bridge, open the textured door and claim the clay hall.',
    card: { thumb: CARD_HASH, portrait: CARD_HASH, landscape: CARD_HASH } },
  look: { grade: { exposure: 0, saturation: 1, contrast: 1, lut: null }, clock: 'engine', familyLooks: {}, families: ['pbr'], materials: { pbr: MEASURED, ground: MEASURED,
      door: { family: 'pbr', colour: [1, 1, 1], roughness: 1, metalness: 1, maps: { colour: null, normal: null, orm: null }, normalScale: 1, occlusion: 1, envStrength: 1, vertexColours: true, faceted: true, doubleSided: false, alphaCutoff: 0, ground: null, measure: null } },
    day: { minutes: 12, start: 0.4, maxElevation: 50, azimuth: 71 }, dayOverride: 0.4,
    keys: [{ time: 0, sky: { zenith: [0.42, 0.52, 0.66], horizon: [0.80, 0.78, 0.74] },
      fog: { colour: [0.80, 0.78, 0.74], density: 0, near: 160, far: 700 }, sun: { colour: [1, 0.93, 0.82], intensity: 1.7 },
      ambient: { sky: [0.80, 0.84, 0.90], ground: [0.55, 0.50, 0.45], intensity: 0.65 } }] },
} satisfies Pick<Shardfile, 'identity' | 'accent' | 'spawn' | 'look' | 'presentation'>;
