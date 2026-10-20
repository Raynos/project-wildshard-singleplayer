/**
 * Look v2 — fog coloured from the panorama (port-v2.md step 2), on the painterly look host's panorama fog
 * (engine/world/Atmosphere.ts `ColourRampFog` with a `panorama`).
 *
 * Every fogged material (terrain, grass, spruce, POIs, creatures, the look graphs) fades into the painted haze of the sky
 * straight behind it: the colour is a 256 × 1 LUT over compass azimuth (panoramaData.ts, the painting's band just above its
 * horizon, blurred), taken back through the grade's inverse and re-tinted by the hour / weather exactly as the dome is
 * (tint.ts). So the 3D world dissolves INTO the painting, with no step at any angle.
 *
 * Density: clear to 30 m, then `1 − exp(−(d − 30) · 0.0032)` (thinner with the ray's mean height above the valley floor),
 * plus whatever the weather adds on top of the day's aerial density (a storm's rain closes it in), plus the valley's
 * height haze. The cloud shadows (`pCloudShadow`, P_CLOUDS) are air.ts's.
 */
import * as THREE from 'three';
import { headingTexture } from '@wildshard/engine/render/dataLook';
import { ColourRampFog, panoramaTint } from '@wildshard/engine/world/Atmosphere';
import metadata from '../bootMetadata.generated.json' with { type: 'json' };

/** the LUT: scene-linear (un-graded at build time, generators/postChain.ts), half float, RepeatWrapping on the azimuth */
export const fogLut = headingTexture({ samples: metadata.postChain.fogLut, stride: 3, half: true, name: 'nalati-fog-lut' });

/** The painting's live re-grade (the hour and the weather), shared by the panorama dome, the cloud sea and this fog: written
 *  each frame by the painted sky's `tint` rows (generators/weatherChannels.ts). */
export const tint = panoramaTint;

/**
 * The painted fog. aerial: x = density (1/m), y = clear distance (m), z = the valley floor's height (m, the height
 * thinning's zero), w = the day's aerial density (the rig's fogDist above it thickens the haze).
 *
 * edge — N19 (the user: "make this far background transition super smooth and invisible"; the pick: blend the painting).
 * The ground within the last metres before the slab edge (and every ring / cloud past it) thickens into the same panorama
 * haze the dome's painted land dissolves into, so both sides of the seam are the one haze. x = strength, y = where it
 * starts (m from the slab centre, the larger of |x| |z|), z = where it is full, w = the view distance it needs (ground near
 * you stays clear: a player by the edge still sees his feet). N23's edge berm (edge.ts) on the slab's last metres IS the
 * skyline now, so the edge haze starts past the slab (the rings): 251 → 270 m.
 */
export const paintedFog = new ColourRampFog({ start: 30, end: 600, near: [0.2, 0.21, 0.26], zenith: [0.2, 0.21, 0.26], panorama: {
  lut: { value: fogLut }, aerial: { value: new THREE.Vector4(0.0032, 30, -10, 0.002) }, edge: { value: new THREE.Vector4(0.95, 251, 270, 20) },
  tint,
} });
