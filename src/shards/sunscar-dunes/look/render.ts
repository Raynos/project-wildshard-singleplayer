import { BackSide, Color, Float32BufferAttribute, Fog, Mesh, MeshStandardMaterial, PlaneGeometry, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { DayCycle, patchShader, PATCH_ORDER, type LookStrategy } from '#engine';
import { GROUND_HALF } from '../layout';
import { SKY_FRAGMENT, SKY_VERTEX, SUN_GLOW } from './sky';

/** Dusk, just after sunset: the light's direction (towards a sun 5° up, ahead-left of the spawn view). */
export const KEY = { dir: new Vector3(-0.55, 0.09, -0.83).normalize(), color: new Color(1, 0.52, 0.3), intensity: 1.25 } as const;
export const FOG = { color: 0x7a4656, near: 70, far: 330 } as const;
const SAND = new Color(0.46, 0.18, 0.075), HOLLOW = new Color(0.17, 0.12, 0.2), CREST = new Color(0.6, 0.27, 0.11);

/** The day clock: Signal Dunes holds at dusk (the clock is never advanced). */
function duskClock(): DayCycle {
  return new DayCycle({ units: 'hour', start: 19,
    schedule: [{ phase: 'day', from: 0, to: 24, minutes: 24 * 60 }],
    sun: { maxElevation: 60, azimuthOffset: 250 },
    fixed: { midday: 12, golden: 18, sunset: 19, night: 0 }, presets: { dawn: 6, noon: 12, dusk: 19, night: 0 } });
}

/**
 * Signal Dunes' look (`extend`): the engine's clean chain, a dusk dome (an orange band under violet and indigo with
 * the first stars), violet distance fog, a low warm key light, and dark orange sand with cool hollows and ripples.
 */
export function signalDunesLook(): LookStrategy {
  // The dusk dome is the backdrop's own sky layer (`SkyBackdrop.clouds`): the engine keeps it on the camera.
  const dome = new Mesh(new SphereGeometry(600, 32, 16), new ShaderMaterial({ side: BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { uSun: { value: SUN_GLOW.clone() } }, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT }));
  dome.renderOrder = -1000; dome.frustumCulled = false;
  return { mode: 'extend',
    compose: ({ engineChain, scene, scope }) => {
      scene.fog = new Fog(new Color(FOG.color), FOG.near, FOG.far);
      scope.own(dome.geometry); scope.own(dome.material);
      scope.onDispose(() => { dome.removeFromParent(); scene.fog = null; });
      return { chain: engineChain('clean') };
    },
    sky: { clouds: false, planet: false },
    backdrop: ({ sky }) => {
      const clock = duskClock();
      return Promise.resolve({ clock, horizon: new Color(FOG.color), lut: null, clouds: dome,
        bind: () => undefined, update: () => { sky.setKeyLight(KEY.dir, KEY.color, KEY.intensity); },
        rebuild: () => undefined, attachPost: () => undefined });
    },
    terrainPainter: { build: (terrain, field, scope) => {
      const segments = 192, geometry = new PlaneGeometry(GROUND_HALF * 2, GROUND_HALF * 2, segments, segments); geometry.rotateX(-Math.PI / 2);
      scope.own(geometry);
      const pos = geometry.getAttribute('position'), colors = new Float32Array(pos.count * 3), c = new Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), h = field.heightAt(x, z); pos.setY(i, h);
        // Hollow vs crest: this vertex against the mean of a 14 m ring around it.
        const mean = (field.heightAt(x + 14, z) + field.heightAt(x - 14, z) + field.heightAt(x, z + 14) + field.heightAt(x, z - 14)) / 4;
        const rel = Math.max(-1, Math.min(1, (h - mean) / 2.5));
        c.copy(SAND); if (rel < 0) c.lerp(HOLLOW, -rel * 0.75); else c.lerp(CREST, rel * 0.5);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }); scope.own(material);
      patchShader(material, 'sunscar.ripples', PATCH_ORDER.decorate, (shader) => {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSandPos;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSandPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSandPos;')
          .replace('#include <color_fragment>', `#include <color_fragment>
  float sandFar = length(vSandPos - cameraPosition);
  float sandWarp = sin(vSandPos.x * 0.07) * 2.3 + sin(vSandPos.x * 0.023 + vSandPos.z * 0.05) * 3.0;
  float sandRipple = sin((vSandPos.z + sandWarp) * 2.1 + sin(vSandPos.x * 0.31) * 0.8);
  diffuseColor.rgb *= 1.0 + 0.11 * sandRipple * (1.0 - smoothstep(25.0, 140.0, sandFar));`);
      }, { scope });
      const mesh = new Mesh(geometry, material); mesh.receiveShadow = false;
      terrain.group.add(mesh); terrain.mesh = mesh; terrain.material = material;
      return Promise.resolve();
    } },
  };
}
