import { Group, type Texture } from 'three';
import { loadLUT } from '@wildshard/engine/boot/bakedApi';
import { paintedLook, type PaintedDressing } from '@wildshard/engine/render/dataLook';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { FOG, SKY, SUN_DIR } from './sun';
import { loadPanorama, skyDome } from './sky';
import { seaTexture } from './cloudSea';
import { discLayer } from '../runtime/looks/discLayer';
import { SEA_DISCS, SEA_PROGRAMS } from '../data/cloudSeaLook';
import { cardField, cardGroup } from '../runtime/looks/cardField';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { SKY_CARDS } from '../data/skyCards';
import { SKY_CARD_FRAGMENTS, SKY_CARD_PROGRAMS } from '../data/skyCardsLook';
import { SKY_HAZE, SKY_PAINTER_LIGHT } from '../data/skyLook';
import { PANO_FOG_SRGB, PANO_SUN } from './panoramaData';
import { loadPainted } from './image';
import { TEX_URL } from '../data/files';

/** A fixed golden-hour clock: Sky Reach does not run a day cycle (no `dayCycle` in `uses`). */
export function createDay(): DayCycle {
  return new DayCycle({ units: 'hour', start: 17.5, schedule: [{ phase: 'day', from: 0, to: 24, minutes: 1440 }],
    sun: { maxElevation: 20, azimuthOffset: 300 }, fixed: { midday: 12, golden: 17.5, sunset: 18.5, night: 0 }, presets: { dawn: 6, noon: 12, dusk: 17.5, night: 0 } });
}

/**
 * Sky Reach's look (the engine's `paintedLook`; the style bible is docs/design/far-reach/style-bible.md): the clean chain
 * under the NEUTRAL curve (E399: AgX compressed the top 1 % to 223-228 where the mockups reach 236-241), a painted
 * golden-hour dome (gradient, sun bloom, baked cumulus and distant island silhouettes: look/sky.ts), the painted light and
 * the heading haze (data/skyLook.ts), a layered lit cloud sea (look/cloudSea.ts) and the shard grade (one learned LUT,
 * art/far-reach/round-32-lut/). The panorama paints the one sun (council R1B-1); its god rays (E398) rise from it: the
 * engine compass faces (-sin az, cos az), the panorama heading (sin h, -cos h), so az = h + 180.
 */
export async function skyReachLook(): Promise<LookStrategy> {
  const pano: Texture = await loadPanorama();
  const [cloudAtlas, seaPaint, vortex] = await Promise.all([loadPainted(TEX_URL.clouds, 'far.cumulus'), loadPainted(TEX_URL.cloudsea, 'far.cloudsea', true), loadPainted(TEX_URL.maelstrom, 'far.maelstrom')]);
  const dressing = (): PaintedDressing => {
    const group = new Group(); group.name = 'far.sky-dressing';
    // the layered cloud sea (its own haze; no scene fog)
    const seaTex = seaTexture(), seaFamily = new ShaderFamily({}, SEA_PROGRAMS), time = { value: 0 };
    const seaShared = { tex: { value: seaTex }, sunDir: { value: SUN_DIR }, time };
    // the procedural sheet only stands in when the painted sea is missing (it drew over the painted one)
    if (seaPaint === null) group.add(discLayer(seaFamily, SEA_DISCS.seaLow, seaShared));
    // the sun's bloom and light shafts at the painted sun (E392; data/skyCardsLook.ts, baked by generators/skyCards.ts)
    const cards = new ShaderFamily(SKY_CARD_FRAGMENTS, SKY_CARD_PROGRAMS), sun = { uSun: { value: SUN_DIR } };
    const glow = cardGroup(cards, SKY_CARDS.sunGlow, sun); group.add(glow.group);
    // the painted cloud sea (E392), wound into the maelstrom under the crown; without its texture the procedural maelstrom disc
    if (seaPaint !== null) {
      if (vortex !== null) group.add(discLayer(seaFamily, SEA_DISCS.paintedMaelstrom, seaShared, { painted: { value: vortex } }));
      for (const upper of [false, true]) group.add(discLayer(seaFamily, upper ? SEA_DISCS.paintedSeaUpper : SEA_DISCS.paintedSea, seaShared, { painted: { value: seaPaint } }));
    } else group.add(discLayer(seaFamily, SEA_DISCS.maelstrom, seaShared));
    // cumulus over the sea (loop 5): the islands rise out of billowing cloud (the camera-facing puffs baked by generators/skyCards.ts)
    if (cloudAtlas !== null) group.add(cardField(cards, SKY_CARDS.cumulus, sun, { uAtlas: { value: cloudAtlas } }));
    return { group, textures: [seaTex], update: (dt) => { time.value += dt; glow.update(time.value); } };
  };
  const textures = [pano, cloudAtlas, seaPaint, vortex].filter((texture): texture is Texture => texture !== null);
  return paintedLook({ textures, sky: (strip) => skyDome(pano, strip), dressing,
    haze: { ...SKY_HAZE, strip: PANO_FOG_SRGB, near: FOG.near, far: FOG.far, max: FOG.max }, light: SKY_PAINTER_LIGHT,
    sun: { dir: SUN_DIR, colour: SKY.key, intensity: 2 }, fog: SKY.fog, horizon: SKY.horizon,
    rays: { azimuth: (PANO_SUN.heading + 180) % 360, elevation: PANO_SUN.elevation },
    clock: createDay, lut: () => loadLUT('far-reach') });
}
