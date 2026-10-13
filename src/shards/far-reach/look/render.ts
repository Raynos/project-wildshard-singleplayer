import { Group, Vector2, Vector3, type Texture } from 'three';
import { loadLUT } from '@wildshard/engine/boot/bakedApi';
import { paintedLook, type PaintedDressing } from '@wildshard/engine/render/dataLook';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { loadPanorama, skyDome } from './sky';
import { discLayer } from '../runtime/looks/discLayer';
import { SEA_DISCS, SEA_LAYERS, SEA_PROGRAMS } from '../data/cloudSeaLook';
import { cardField, cardGroup } from '@wildshard/sdk/looks/cardField';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { SKY_CARDS } from '../data/skyCards';
import { SKY_CARD_FRAGMENTS, SKY_CARD_PROGRAMS } from '../data/skyCardsLook';
import { SKY, SKY_DAY, SKY_FOG, SKY_HAZE, SKY_KEY, SKY_PAINTER_LIGHT, SKY_RAYS, SKY_SUN } from '../data/skyLook';
import { PANO_FOG_SRGB } from './panoramaData';
import { loadPainted } from './image';
import { TEX_URL } from '../data/files';

/**
 * Sky Reach's look (the engine's `paintedLook`; the style bible is docs/design/far-reach/style-bible.md): the clean chain
 * under the NEUTRAL curve (E399: AgX compressed the top 1 % to 223-228 where the mockups reach 236-241), a painted
 * golden-hour dome (gradient, sun bloom, baked cumulus and distant island silhouettes: look/sky.ts), the painted light and
 * the heading haze, a layered painted cloud sea (data/cloudSeaLook.ts) and the shard grade (one learned LUT,
 * art/far-reach/round-32-lut/). The panorama paints the one sun (council R1B-1); its god rays (E398) rise from it. Every
 * number is a row of data/skyLook.ts (the fixed clock, key, fog, palette, light and haze).
 */
export async function skyReachLook(): Promise<LookStrategy> {
  const pano: Texture = await loadPanorama(), SUN_DIR = new Vector3(...SKY_SUN);
  const [cloudAtlas, seaPaint, vortex] = await Promise.all([loadPainted(TEX_URL.clouds, 'far.cumulus'), loadPainted(TEX_URL.cloudsea, 'far.cloudsea', true), loadPainted(TEX_URL.maelstrom, 'far.maelstrom')]);
  const dressing = (): PaintedDressing => {
    const group = new Group(); group.name = 'far.sky-dressing';
    // the layered painted cloud sea (its own haze; no scene fog)
    const seaFamily = new ShaderFamily({}, SEA_PROGRAMS), time = { value: 0 }, seaShared = { time };
    // the sun's bloom and light shafts at the painted sun (E392; data/skyCardsLook.ts, baked by generators/skyCards.ts)
    const cards = new ShaderFamily(SKY_CARD_FRAGMENTS, SKY_CARD_PROGRAMS), sun = { uSun: { value: SUN_DIR } };
    const glow = cardGroup(cards, SKY_CARDS.sunGlow, sun); group.add(glow.group);
    // the painted cloud sea (E392) and the painted maelstrom under the crown; without their textures, no sea is drawn
    if (seaPaint !== null) {
      if (vortex !== null) group.add(discLayer(seaFamily, SEA_DISCS.paintedMaelstrom, seaShared, { painted: { value: vortex } }));
      for (const upper of [false, true]) {
        const layer = upper ? SEA_LAYERS.upper : SEA_LAYERS.lower;
        group.add(discLayer(seaFamily, upper ? SEA_DISCS.paintedSeaUpper : SEA_DISCS.paintedSea, seaShared, { painted: { value: seaPaint }, gain: { value: layer.gain }, crown: { value: new Vector2(...layer.crown) } }));
      }
    }
    // cumulus over the sea (loop 5): the islands rise out of billowing cloud (the camera-facing puffs baked by generators/skyCards.ts)
    if (cloudAtlas !== null) group.add(cardField(cards, SKY_CARDS.cumulus, sun, { uAtlas: { value: cloudAtlas } }));
    return { group, textures: [], update: (dt) => { time.value += dt; glow.update(time.value); } };
  };
  const textures = [pano, cloudAtlas, seaPaint, vortex].filter((texture): texture is Texture => texture !== null);
  return paintedLook({ textures, sky: { haze: { ...SKY_HAZE, ...SKY_FOG, strip: PANO_FOG_SRGB }, dome: (strip) => skyDome(pano, strip) }, dressing,
    light: SKY_PAINTER_LIGHT, sun: { ...SKY_KEY, dir: SUN_DIR }, fog: { color: SKY.fog, near: SKY_FOG.near, far: SKY_FOG.far }, horizon: SKY.horizon,
    neutral: true, rays: SKY_RAYS, clock: () => new DayCycle(SKY_DAY), lut: () => loadLUT('far-reach') });
}
