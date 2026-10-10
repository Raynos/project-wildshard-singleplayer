import { Color, Fog, Mesh, type Object3D, type Texture } from 'three';
import { ToneMappingMode } from 'postprocessing';
import { loadLUT } from '@wildshard/engine/boot/bakedApi';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { patchShader, PATCH_ORDER } from '@wildshard/engine/render/shaderPatches';
import { editShader, type ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';
import { ROSE_FOG_EDITS } from '../data/roseFogLook';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { FOG, SKY, SUN_DIR } from './sun';
import { installPaintedLight } from './light';
import { HEADING_GLSL, fogLut, loadPanorama, skyDome } from './sky';
import { seaTexture } from './cloudSea';
import { discLayer } from '@wildshard/sdk/looks/discLayer';
import { SEA_DISCS, SEA_PROGRAMS } from '../data/cloudSeaLook';
import { cardField, cardFieldRow, cardGroup, cardGroupRow } from '@wildshard/sdk/looks/cardField';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import SKY_CARDS from '../data/skyCards.json' with { type: 'json' };
import { SKY_CARD_FRAGMENTS, SKY_CARD_PROGRAMS } from '../data/skyCardsLook';
import { PANO_SUN } from './panoramaData';
import { loadPainted } from './image';
import { TEX_URL } from '../boot/files';


const SPLICE = new ShaderFamily({}, {});
/** `rows` with every `@{name}` in their text replaced from `extra`. */
const spliced = (rows: readonly ShaderEditRow[], extra: Readonly<Record<string, string>>): ShaderEditRow[] =>
  rows.map((r) => (typeof r.put === 'string' ? { stage: r.stage, find: r.find, put: SPLICE.glsl(r.put, extra) } : r));

/** A fixed golden-hour clock: Sky Reach does not run a day cycle (no `dayCycle` in `uses`). */
export function createDay(): DayCycle {
  return new DayCycle({ units: 'hour', start: 17.5, schedule: [{ phase: 'day', from: 0, to: 24, minutes: 1440 }],
    sun: { maxElevation: 20, azimuthOffset: 300 }, fixed: { midday: 12, golden: 17.5, sunset: 18.5, night: 0 }, presets: { dawn: 6, noon: 12, dusk: 17.5, night: 0 } });
}
function primitive(object: Object3D): object is Mesh { return object instanceof Mesh; }
/** E399 (the council: 'no golden haze toward the sun'): how far the air toward the low sun goes gold over distance. */
const SUN_HAZE = 0.12;

/**
 * Sky Reach's look (extend; the style bible is docs/design/far-reach/style-bible.md): the engine's clean chain, a painted
 * golden-hour dome (gradient, sun bloom, baked cumulus and distant island silhouettes: look/sky.ts), the painted light
 * (warm bounce, rim, shade floor: look/light.ts), a layered lit cloud sea (look/cloudSea.ts) and a warm distance fog
 * that melts the far islands into the haze.
 */
export async function skyReachLook(): Promise<LookStrategy> {
  const pano: Texture = await loadPanorama();
  const [cloudAtlas, seaPaint, vortex] = await Promise.all([loadPainted(TEX_URL.clouds, 'far.cumulus'), loadPainted(TEX_URL.cloudsea, 'far.cloudsea', true), loadPainted(TEX_URL.maelstrom, 'far.maelstrom')]);
  // A regional frame reads this strategy's parts without composing its standalone scene. Until compose adopts these
  // eager sources, the strategy owns them, including a late strategy returned after its resident has already left.
  const pending = new Set([pano, cloudAtlas, seaPaint, vortex].filter((texture): texture is Texture => texture !== null));
  let seaTime: { value: number } | null = null;
  let glowUpdate: ((t: number) => void) | null = null;
  return { mode: 'extend',
    dispose: () => { for (const texture of pending) texture.dispose(); pending.clear(); },
    // `c.fx` builds the CINEMATIC chain when nothing is built yet, so the clean chain is asked first and `fx` only after
    // it (E399: destructuring `fx` in the parameters, or reading it before `engineChain('clean')`, makes the clean ask
    // throw 'already built', and the load hangs)
    compose: (c) => {
      const { scene, scope } = c, chain = c.engineChain('clean');
      for (const texture of pending) scope.own(texture);
      pending.clear();
      // E399 (council rounds 1-5, 'the light never glows'; measured as Rec. 709 luminance): AgX compressed the top 1 % to
      // 223-228 where the mockups reach 236-241. NEUTRAL with the manifest grade's saturation 0, contrast 0.12 and bloom
      // 0.35 measures 236-241, 2.1-3.6 % of the frame over 230 (the mockups 1.9-3.8 %)
      c.fx.tone.mode = ToneMappingMode.NEUTRAL;
      const haze = fogLut(), dome = skyDome(pano, haze); scope.own(pano); scope.own(haze);
      dome.renderOrder = -10; dome.frustumCulled = false; scene.add(dome);
      scope.own(dome.geometry); scope.own(dome.material); scope.onDispose(() => { dome.removeFromParent(); });
      scene.fog = new Fog(new Color(SKY.fog), FOG.near, FOG.far);
      const fogEdits = spliced(ROSE_FOG_EDITS, { HEADING_GLSL, near: FOG.near.toFixed(1), span: (FOG.far - FOG.near).toFixed(1), max: FOG.max.toFixed(2),
        sunX: SUN_DIR.x.toFixed(4), sunY: SUN_DIR.y.toFixed(4), sunZ: SUN_DIR.z.toFixed(4), sunHaze: SUN_HAZE.toFixed(2) });
      scene.traverse((object) => {
        if (!primitive(object) || object === dome) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          // the haze takes the painted horizon's colour in the direction you look (gold toward the sun, rose-lavender away)
          patchShader(material, 'far.rose-fog', PATCH_ORDER.decorate, (shader) => {
            shader.uniforms['farHaze'] = { value: haze };
            editShader(shader, fogEdits);
          }, { scope });
        }
      });
      // the layered cloud sea goes in after the fog patch (its own haze; no scene fog)
      const seaTex = seaTexture(), seaFamily = new ShaderFamily({}, SEA_PROGRAMS), time = { value: 0 };
      const seaShared = { tex: { value: seaTex }, sunDir: { value: SUN_DIR }, time }, sea = { meshes: [discLayer(seaFamily, SEA_DISCS.seaLow, seaShared)], time }; scope.own(seaTex);
      // the procedural sheet only stands in when the painted sea is missing (it drew over the painted one)
      for (const mesh of sea.meshes) { if (seaPaint === null) scene.add(mesh); scope.own(mesh.geometry); scope.own(mesh.material); }
      scope.onDispose(() => { for (const mesh of sea.meshes) mesh.removeFromParent(); });
      seaTime = sea.time;
      // the sun's bloom and light shafts at the painted sun (E392; data/skyCardsLook.ts, baked by generators/skyCards.ts)
      const cards = new ShaderFamily(SKY_CARD_FRAGMENTS, SKY_CARD_PROGRAMS), sun = { uSun: { value: SUN_DIR } };
      const glow = cardGroup(cards, cardGroupRow(cards, SKY_CARDS.sunGlow), sun); scene.add(glow.group); glowUpdate = glow.update;
      scope.own(glow.geometry); for (const m of glow.materials) scope.own(m); scope.onDispose(() => { glow.group.removeFromParent(); });
      // the painted cloud sea (E392), wound into the maelstrom under the crown; without its texture the procedural maelstrom disc
      if (seaPaint !== null) {
        scope.own(seaPaint);
        if (vortex !== null) { const swirlDisc = discLayer(seaFamily, SEA_DISCS.paintedMaelstrom, seaShared, { painted: { value: vortex } }); scene.add(swirlDisc); scope.own(vortex); scope.own(swirlDisc.geometry); scope.own(swirlDisc.material); scope.onDispose(() => { swirlDisc.removeFromParent(); }); }
        for (const upper of [false, true]) { const painted = discLayer(seaFamily, upper ? SEA_DISCS.paintedSeaUpper : SEA_DISCS.paintedSea, seaShared, { painted: { value: seaPaint } }); scene.add(painted); scope.own(painted.geometry); scope.own(painted.material); scope.onDispose(() => { painted.removeFromParent(); }); }
      } else {
        const swirl = discLayer(seaFamily, SEA_DISCS.maelstrom, seaShared); scene.add(swirl); scope.own(swirl.geometry); scope.own(swirl.material); scope.onDispose(() => { swirl.removeFromParent(); });
      }
      // cumulus over the sea (loop 5): the islands rise out of billowing cloud (the camera-facing puffs baked by
      // generators/skyCards.ts: the ring field, the keel puffs, the bridge gaps, the crown bank and the banks beyond)
      if (cloudAtlas !== null) {
        const puffs = cardField(cards, cardFieldRow(cards, SKY_CARDS.cumulus), sun, { uAtlas: { value: cloudAtlas } }); scene.add(puffs); scope.own(cloudAtlas); scope.own(puffs.geometry); scope.own(puffs.material); scope.onDispose(() => { puffs.removeFromParent(); });
      }
      return { chain };
    },
    lighting: { install: installPaintedLight },
    // the panorama paints the one sun (council R1B-1: the engine's disc drew a second one above it)
    // god rays from the painted sun (E398): the disc stays out of the frame, only the rays' source; the engine compass
    // faces (-sin az, cos az), the panorama heading (sin h, -cos h), so az = h + 180
    sky: { clouds: false, planet: false, sun: { disc: false, halo: false, rays: { azimuth: (PANO_SUN.heading + 180) % 360, elevation: PANO_SUN.elevation } } },
    // the shard grade (top-10 row 10): one learned LUT, global, the engine's last grade step (Debug ▸ Look ▸ Learned LUT
    // Off skips it). The second fit (art/far-reach/round-32-lut/): each mockup's sky its own region, eased to identity in
    // the highlights (the first, round-29-lut, greyed C's sky and overshot the highlights when measured live)
    backdrop: async ({ sky }) => {
      const clock = createDay(), key = new Color(SKY.key), lut = await loadLUT('far-reach');
      return { clock, horizon: new Color(SKY.horizon), lut,
        bind: () => undefined, update: (dt: number) => { clock.update(dt); sky.setKeyLight(SUN_DIR, key, 2); if (seaTime !== null) { seaTime.value += dt; glowUpdate?.(seaTime.value); } },
        rebuild: () => undefined, attachPost: () => undefined };
    },
  };
}
