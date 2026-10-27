import paintedTextures from '../data/paintedTextures.json' with { type: 'json' };
import { SNOW_LINE, GLACIER } from './layout';

// the painted ground (game/looks/painterlyLook paintedGroundPainter): the meadow, path, gravel, rock and snow tiles, the snow
// line, the wet low ground and the glacier's ice, in a softly banded painterly material recoloured by the terrain graph
const m = paintedTextures.metres, ground = { layers: ['meadow', 'path', 'gravel', 'rock', 'snow'], colour: 'terrain', material: { bands: 0.5, rim: 0, shade: 0.85 },
  surface: { maps: { base: 'meadow', track: 'path', gravel: 'gravel', rock: 'rock', snow: 'snow' }, metres: { base: m.meadow, track: m.path, gravel: m.gravel, rock: m.rock, snow: m.snow },
    means: { base: [...paintedTextures.mean.meadow], rock: [...paintedTextures.mean.rock] }, snow: { line: SNOW_LINE, high: [44, 84] }, wet: [-9.2, -9.9],
    ice: { from: [GLACIER.x0, GLACIER.z0], to: [GLACIER.x1, GLACIER.z1], half: GLACIER.half } },
  shapes: ['ground', 'slab'], recipe: { file: 'world/water.json', key: 'terrain' }, mesh: 'ground', tiles: true };
// the painted panorama (game/looks/painterlyLook PaintedPanorama): the painting as the sky dome (drawn first, just inside the far
// plane), the cloud sea sunk below the rim, and the lit look graphs that hear the painterly world's shade, rim and wet
const panorama = { dome: { name: 'sky-dome-v2', look: 'nalati-panorama', image: paintedTextures.panorama, pad: 16, fallbackWidth: 6176, zenith: paintedTextures.zenith,
    radius: 2590, segments: [96, 48], order: -90, night: [2, -9], params: { image: 'tPano', ridge: 'tRidge', lut: 'tFogLut', pad: 'uPad', zenith: 'uZenith', sun: 'uSunNow', night: 'uNight' } },
  sea: { name: 'cloud-sea', look: 'nalati-cloud-sea', y: -68, lut: 'tFogLut', sun: 'uSunView' },
  lit: { looks: ['nalati-crag', 'nalati-crag-phone', 'nalati-riders', 'nalati-cloth'], shade: 'shade', rim: 'rim', wet: 'wet' } };
// the painter's key (game/looks/painterlyLook PainterKeyLight): the painting's sun sits low in the WSW and the camp looks toward
// it, so the light that shades the world swings 40° further round and 15° higher (easing onto the real sun as it sets); the
// fill lower and cooler, a blue sky above and an olive bounce below
const key = { turn: 40, lift: 15, ease: [-1, 12], sky: [0.4, 0.46, 0.62], ground: [0.3, 0.3, 0.16], mix: 0.4, fill: 0.95 };
// the painterly world (game/looks/painterlyLook PainterlyWorld): the static capture of the places, the dressing, the outcrops
// and the crags (and the spruce), swept every 2 s; the phone's live shadow map holds only what moves at 512²; dusk over 12°…0°
const world = { casters: ['pois', 'dressing', 'outcrops', 'crags'], sweep: 2, liveMap: 512, dusk: [12, 0] };
// the painted fog (engine/world/Atmosphere ColourRampFog with a panorama; look/render.ts): fogged materials fade into the
// painting's haze straight behind them. Clear to 30 m, then 1 − exp(−(d − 30) · 0.0032), thinner with the ray's mean height
// above the valley floor (−10 m), plus the day's aerial density (0.002) and whatever the weather adds. aerial = density,
// clear distance, valley floor, day density. edge (N19, "make this far background transition super smooth and
// invisible"): past the slab (N23's berm is the skyline) the ground and rings thicken into the same haze, strength 0.95
// from 251 to 270 m from the slab centre, only beyond 20 m of view distance (a player by the edge still sees his feet)
const fog = { start: 30, end: 600, aerial: [0.0032, 30, -10, 0.002], edge: [0.95, 251, 270, 20] };
// soft cloud shadows (game/looks/paintedLook paintedAir): a 520 m tile, cover past 0.53 (± 0.06) takes 0.66 of the sun,
// drifting at 1.6 × the wind + 2 m/s
const air = { tile: 520, threshold: 0.53, strength: 0.66, softness: 0.06, drift: [1.6, 2] };
/** GR6: the painterly look's rows (the retired nalati-boot-metadata job's `paintedTextures.generated.json`): the painted
 *  textures with the ground, panorama, key light, world, fog and air rows over them. */
export const NALATI_PAINTED: Omit<typeof paintedTextures, 'panorama'> & { ground: typeof ground; panorama: typeof panorama; key: typeof key; world: typeof world; fog: typeof fog; air: typeof air } = { ...paintedTextures, ground, panorama, key, world, fog, air };
