import { Color, Fog, Mesh, type Object3D, type Texture } from 'three';
import { DayCycle, patchShader, PATCH_ORDER, type LookStrategy } from '#engine';
import { FOG, SKY, SUN_DIR } from './sun';
import { installPaintedLight } from './light';
import { HEADING_GLSL, fogLut, loadPanorama, skyDome } from './sky';
import { bakeSeaTexture, cloudSea, maelstrom, paintedSea } from './cloudSea';
import { cumulus } from './puffs';
import { loadPainted } from './image';
import { TEX_URL } from '../boot/files';

export { FOG, SKY, SUN_DIR } from './sun';

/** A fixed golden-hour clock: Sky Reach does not run a day cycle (no `dayCycle` in `uses`). */
export function createDay(): DayCycle {
  return new DayCycle({ units: 'hour', start: 17.5, schedule: [{ phase: 'day', from: 0, to: 24, minutes: 1440 }],
    sun: { maxElevation: 20, azimuthOffset: 300 }, fixed: { midday: 12, golden: 17.5, sunset: 18.5, night: 0 }, presets: { dawn: 6, noon: 12, dusk: 17.5, night: 0 } });
}
function primitive(object: Object3D): object is Mesh { return object instanceof Mesh; }

/**
 * Sky Reach's look (extend; the style bible is docs/design/far-reach/style-bible.md): the engine's clean chain, a painted
 * golden-hour dome (gradient, sun bloom, baked cumulus and distant island silhouettes: look/sky.ts), the painted light
 * (warm bounce, rim, shade floor: look/light.ts), a layered lit cloud sea (look/cloudSea.ts) and a warm distance fog
 * that melts the far islands into the haze.
 */
export async function skyReachLook(): Promise<LookStrategy> {
  const pano: Texture = await loadPanorama();
  const [cloudAtlas, seaPaint] = await Promise.all([loadPainted(TEX_URL.clouds, 'far.cumulus'), loadPainted(TEX_URL.cloudsea, 'far.cloudsea', true)]);
  let seaTime: { value: number } | null = null;
  return { mode: 'extend',
    compose: ({ engineChain, scene, scope }) => {
      const haze = fogLut(), dome = skyDome(pano, haze); scope.own(pano); scope.own(haze);
      dome.renderOrder = -10; dome.frustumCulled = false; scene.add(dome);
      scope.own(dome.geometry); scope.own(dome.material); scope.onDispose(() => { dome.removeFromParent(); });
      scene.fog = new Fog(new Color(SKY.fog), FOG.near, FOG.far);
      scene.traverse((object) => {
        if (!primitive(object) || object === dome) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          // the haze takes the painted horizon's colour in the direction you look (gold toward the sun, rose-lavender away)
          patchShader(material, 'far.rose-fog', PATCH_ORDER.decorate, (shader) => {
            shader.uniforms['farHaze'] = { value: haze };
            shader.fragmentShader = `#ifndef FAR_HAZE\n#define FAR_HAZE\nuniform sampler2D farHaze;\n${HEADING_GLSL}\n#endif\n${shader.fragmentShader.replace('#include <fog_fragment>',
              `#ifdef USE_FOG\n vec3 farV=vFogWorldPos-cameraPosition; gl_FragColor.rgb=mix(gl_FragColor.rgb,texture2D(farHaze,vec2(farHeading(farV),0.5)).rgb,clamp((length(farV)-${FOG.near.toFixed(1)})/${(FOG.far - FOG.near).toFixed(1)},0.0,1.0)*${FOG.max.toFixed(2)});\n#endif`)}`;
          }, { scope });
        }
      });
      // the layered cloud sea goes in after the fog patch (its own haze; no scene fog)
      const seaTex = bakeSeaTexture(SUN_DIR), sea = cloudSea(SUN_DIR, seaTex); scope.own(seaTex);
      // the procedural sheet only stands in when the painted sea is missing (it drew over the painted one)
      for (const mesh of sea.meshes) { if (seaPaint === null) scene.add(mesh); scope.own(mesh.geometry); scope.own(mesh.material); }
      scope.onDispose(() => { for (const mesh of sea.meshes) mesh.removeFromParent(); });
      seaTime = sea.time;
      // the painted cloud sea (E392), wound into the maelstrom under the crown; without its texture the procedural maelstrom disc
      if (seaPaint !== null) {
        scope.own(seaPaint);
        for (const upper of [false, true]) { const painted = paintedSea(seaPaint, sea.time, upper); scene.add(painted); scope.own(painted.geometry); scope.own(painted.material); scope.onDispose(() => { painted.removeFromParent(); }); }
      } else {
        const swirl = maelstrom(SUN_DIR, seaTex, sea.time); scene.add(swirl); scope.own(swirl.geometry); scope.own(swirl.material); scope.onDispose(() => { swirl.removeFromParent(); });
      }
      // cumulus over the sea (loop 5): the islands rise out of billowing cloud
      if (cloudAtlas !== null) {
        const puffs = cumulus(SUN_DIR, cloudAtlas); scene.add(puffs); scope.own(cloudAtlas); scope.own(puffs.geometry); scope.own(puffs.material); scope.onDispose(() => { puffs.removeFromParent(); });
      }
      return { chain: engineChain('clean') };
    },
    lighting: { install: installPaintedLight },
    // the panorama paints the one sun (council R1B-1: the engine's disc drew a second one above it)
    sky: { clouds: false, planet: false, sun: { disc: false, halo: false } },
    backdrop: ({ sky }) => {
      const clock = createDay(), key = new Color(SKY.key);
      return Promise.resolve({ clock, horizon: new Color(SKY.horizon), lut: null,
        bind: () => undefined, update: (dt: number) => { clock.update(dt); sky.setKeyLight(SUN_DIR, key, 2); if (seaTime !== null) seaTime.value += dt; },
        rebuild: () => undefined, attachPost: () => undefined });
    },
  };
}
