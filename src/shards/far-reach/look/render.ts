import { Color, Fog, Group, Material, Mesh, type Object3D, type Texture } from 'three';
import { ToneMappingMode } from 'postprocessing';
import { loadLUT } from '@wildshard/engine/boot/bakedApi';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { patchShader, PATCH_ORDER } from '@wildshard/engine/render/shaderPatches';
import { editShader, spliceEdits } from '@wildshard/sdk/looks/shaderEdits';
import { ROSE_FOG_EDITS } from '../data/roseFogLook';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { FOG, SKY, SUN_DIR } from './sun';
import { installPaintedLight } from './light';
import { HEADING_GLSL, fogLut, loadPanorama, skyDome } from './sky';
import { seaTexture } from './cloudSea';
import { discLayer } from '../runtime/looks/discLayer';
import { SEA_DISCS, SEA_PROGRAMS } from '../data/cloudSeaLook';
import { cardField, cardFieldRow, cardGroup, cardGroupRow } from '../runtime/looks/cardField';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import SKY_CARDS from '../data/skyCards.json' with { type: 'json' };
import { SKY_CARD_FRAGMENTS, SKY_CARD_PROGRAMS } from '../data/skyCardsLook';
import { PANO_SUN } from './panoramaData';
import { loadPainted } from './image';
import { SkyNeutralToneEffect } from './neutralTone';
import { TEX_URL } from '../data/files';

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
  // the painted dome and its haze strip, made once by whichever asks first (the backdrop, before the compose)
  let sky: { readonly dome: ReturnType<typeof skyDome>; readonly haze: Texture } | null = null;
  const makeSky = (): { readonly dome: ReturnType<typeof skyDome>; readonly haze: Texture } => {
    const haze = fogLut(), dome = skyDome(pano, haze); pending.add(haze); // freed with the look where no compose or layer takes it
    dome.renderOrder = -10; dome.frustumCulled = false;
    sky = { dome, haze };
    return sky;
  };
  // G321: the sky pieces that stand in the world (the cloud sea, the sun's bloom and shafts, the cumulus puffs), made once
  // by whichever asks first (the backdrop, before the compose): its `dressing`, which standalone the sky adds to the scene
  // and a grid cell's layer draws at its region's origin by its owner weight. Its textures go with the look's `dispose`.
  let dressing: { readonly group: Group; readonly meshes: ReadonlySet<Object3D>; readonly time: { value: number }; readonly glow: (t: number) => void } | null = null;
  const makeDressing = (): NonNullable<typeof dressing> => {
    const group = new Group(); group.name = 'far.sky-dressing';
    // the layered cloud sea (its own haze; no scene fog)
    const seaTex = seaTexture(), seaFamily = new ShaderFamily({}, SEA_PROGRAMS), time = { value: 0 }; pending.add(seaTex);
    const seaShared = { tex: { value: seaTex }, sunDir: { value: SUN_DIR }, time };
    // the procedural sheet only stands in when the painted sea is missing (it drew over the painted one)
    if (seaPaint === null) group.add(discLayer(seaFamily, SEA_DISCS.seaLow, seaShared));
    // the sun's bloom and light shafts at the painted sun (E392; data/skyCardsLook.ts, baked by generators/skyCards.ts)
    const cards = new ShaderFamily(SKY_CARD_FRAGMENTS, SKY_CARD_PROGRAMS), sun = { uSun: { value: SUN_DIR } };
    const glow = cardGroup(cards, cardGroupRow(cards, SKY_CARDS.sunGlow), sun); group.add(glow.group);
    // the painted cloud sea (E392), wound into the maelstrom under the crown; without its texture the procedural maelstrom disc
    if (seaPaint !== null) {
      if (vortex !== null) group.add(discLayer(seaFamily, SEA_DISCS.paintedMaelstrom, seaShared, { painted: { value: vortex } }));
      for (const upper of [false, true]) group.add(discLayer(seaFamily, upper ? SEA_DISCS.paintedSeaUpper : SEA_DISCS.paintedSea, seaShared, { painted: { value: seaPaint } }));
    } else group.add(discLayer(seaFamily, SEA_DISCS.maelstrom, seaShared));
    // cumulus over the sea (loop 5): the islands rise out of billowing cloud (the camera-facing puffs baked by
    // generators/skyCards.ts: the ring field, the keel puffs, the bridge gaps, the crown bank and the banks beyond)
    if (cloudAtlas !== null) group.add(cardField(cards, cardFieldRow(cards, SKY_CARDS.cumulus), sun, { uAtlas: { value: cloudAtlas } }));
    const meshes = new Set<Object3D>(); group.traverse((node) => { meshes.add(node); });
    dressing = { group, meshes, time, glow: glow.update };
    return dressing;
  };
  // the haze takes the painted horizon's colour in the direction you look (gold toward the sun, rose-lavender away): its
  // compose patches its scene's materials; a grid cell (G321) its region's, as the look's `worldPatch`
  const fogEdits = spliceEdits(ROSE_FOG_EDITS, { HEADING_GLSL, near: FOG.near.toFixed(1), span: (FOG.far - FOG.near).toFixed(1), max: FOG.max.toFixed(2),
    sunX: SUN_DIR.x.toFixed(4), sunY: SUN_DIR.y.toFixed(4), sunZ: SUN_DIR.z.toFixed(4), sunHaze: SUN_HAZE.toFixed(2) });
  const roseFog: NonNullable<LookStrategy['worldPatch']> = (material, scope) => {
    const { haze } = sky ?? makeSky();
    patchShader(material, 'far.rose-fog', PATCH_ORDER.decorate, (shader) => {
      shader.uniforms['farHaze'] = { value: haze };
      editShader(shader, fogEdits);
    }, { scope });
  };
  /** the dressing's geometries and materials (its textures are the look's `pending`) */
  const dressingParts = (group: Object3D): { geometry: { dispose: () => void }; material: Material }[] => {
    const parts: { geometry: { dispose: () => void }; material: Material }[] = [];
    group.traverse((node) => { if (primitive(node)) for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (material instanceof Material) parts.push({ geometry: node.geometry, material }); });
    return parts;
  };
  return { mode: 'extend',
    // the clean chain is declared as well as composed, so a grid cell carries it without composing (absent: cinematic)
    chain: 'clean',
    // its tone curve inside a grid cell (op-frame21, SF63 / G158; behind the grid's default-off Debug row): the carried clean
    // chain stays, NEUTRAL in the place of the page's AgX, as its compose sets it standalone (E399); its own effect, since
    // a second ToneMappingEffect in the page's colour pass never compiles (op-frame22)
    cell: { replaces: 'tone', build: () => ({ display: new SkyNeutralToneEffect() }) },
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
      // the dome is the backdrop's sky layer (G321: so a grid cell draws it too); standalone the compose owns it
      const { dome, haze } = sky ?? makeSky(); scope.own(pano); scope.own(haze);
      scope.own(dome.geometry); scope.own(dome.material); scope.onDispose(() => { dome.removeFromParent(); });
      scene.fog = new Fog(new Color(SKY.fog), FOG.near, FOG.far);
      // the sky's own pieces stand in the scene already (the backdrop's `dressing`, which `SkyRig.build` adds): not the world's
      const own = dressing ?? makeDressing();
      if (own.group.parent === null) scene.add(own.group);
      for (const part of dressingParts(own.group)) { scope.own(part.geometry); scope.own(part.material); }
      scope.onDispose(() => { own.group.removeFromParent(); });
      scene.traverse((object) => {
        if (!primitive(object) || object === dome || own.meshes.has(object)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) roseFog(material, scope);
      });
      return { chain };
    },
    lighting: { install: installPaintedLight },
    worldPatch: roseFog,
    // the panorama paints the one sun (council R1B-1: the engine's disc drew a second one above it)
    // god rays from the painted sun (E398): the disc stays out of the frame, only the rays' source; the engine compass
    // faces (-sin az, cos az), the panorama heading (sin h, -cos h), so az = h + 180
    sky: { clouds: false, planet: false, sun: { disc: false, halo: false, rays: { azimuth: (PANO_SUN.heading + 180) % 360, elevation: PANO_SUN.elevation } } },
    // the shard grade (top-10 row 10): one learned LUT, global, the engine's last grade step (Debug ▸ Look ▸ Learned LUT
    // Off skips it). The second fit (art/far-reach/round-32-lut/): each mockup's sky its own region, eased to identity in
    // the highlights (the first, round-29-lut, greyed C's sky and overshot the highlights when measured live)
    // G321: the painted dome is its sky layer (`clouds`, kept on the camera; it shades by the direction from the camera), and
    // its clock writes its fog colour, so a grid cell draws Sky Reach's own sky, golden sun and air by its owner weight
    backdrop: async ({ sky: rig }) => {
      const clock = createDay(), key = new Color(SKY.key), fog = new Color(SKY.fog), lut = await loadLUT('far-reach');
      const own = sky ?? makeSky(), pieces = dressing ?? makeDressing();
      let air: (() => Fog | null) | null = null;
      return { clock, horizon: new Color(SKY.horizon), lut, clouds: own.dome, dressing: pieces.group,
        bind: (targets) => { air = () => (targets.underwater() ? null : targets.fog); },
        update: (dt: number) => { clock.update(dt); rig.setKeyLight(SUN_DIR, key, 2); air?.()?.color.copy(fog); pieces.time.value += dt; pieces.glow(pieces.time.value); },
        rebuild: () => undefined, attachPost: () => undefined,
        // a grid cell's layer frees what it drew (standalone the compose owns the dome and its haze)
        dispose: () => {
          own.dome.removeFromParent(); own.dome.geometry.dispose(); own.dome.material.dispose(); own.haze.dispose();
          pieces.group.removeFromParent(); for (const part of dressingParts(pieces.group)) { part.geometry.dispose(); part.material.dispose(); }
        } };
    },
  };
}
