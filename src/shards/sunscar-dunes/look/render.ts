import { Color, Float32BufferAttribute, Fog, Mesh, MeshStandardMaterial, PlaneGeometry, Vector3, type Material, type Object3D } from 'three';
import { DayCycle, patchShader, PATCH_ORDER, type LookStrategy, type Scope } from '#engine';
import { sandColor } from '../world/dunes';
import { buildDome, GLOW_DIR } from './sky';

/** Dusk fog: a mauve-orange haze that hides the slab edge and warms the far dunes. */
const FOG = { color: 0xb8673e, near: 60, far: 420 };
/** The key light: the afterglow, low in the north-west, orange and weak; the hemisphere fill (manifest) is indigo. */
const KEY = { dir: new Vector3(GLOW_DIR.x, 0.16, GLOW_DIR.z).normalize(), color: new Color(1, 0.52, 0.28), intensity: 2.6 };

function isMesh(object: Object3D): object is Mesh { return object instanceof Mesh; }
function materials(mesh: Mesh): Material[] { return Array.isArray(mesh.material) ? mesh.material : [mesh.material]; }

/** Distance fog through the patch API (the engine's fog chain stays as it is: the atmosphere densities are 0). */
function fogPatch(material: Material, scope: Scope): void {
  patchShader(material, 'sunscar.dusk-fog', PATCH_ORDER.decorate, (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>',
      `#ifdef USE_FOG\n float duskFog = smoothstep(${FOG.near.toFixed(1)}, ${FOG.far.toFixed(1)}, length(vFogWorldPos - cameraPosition));\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, duskFog * duskFog * (3.0 - 2.0 * duskFog));\n#endif`);
  }, { scope });
}

/** Wind ripples on the sand: a fine normal ripple near the camera, warped so it follows the dunes' cross-wind lines. */
function sandPatch(material: Material, scope: Scope): void {
  patchShader(material, 'sunscar.sand-ripples', PATCH_ORDER.decorate, (shader) => {
    // The world position is the engine fog chunk's varying (the sand always has fog: the look sets scene.fog).
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      #ifdef USE_FOG
      {
        vec3 vSandWorld = vFogWorldPos;
        vec2 p = vSandWorld.xz;
        float warp = sin(p.x * 0.11 + sin(p.y * 0.05) * 2.0) * 1.6 + sin(p.x * 0.031 - p.y * 0.017) * 4.0;
        float phase = (p.y + warp) * 7.5;
        float fade = 1.0 - smoothstep(5.0, 24.0, length(vSandWorld - cameraPosition));
        // Anti-alias: drop the ripple where it is finer than a few pixels.
        fade *= 1.0 - smoothstep(0.08, 0.3, fwidth(phase) / 6.2832);
        vec3 bend = vec3(0.0, 0.0, cos(phase)) * 0.16 * fade;
        normal = normalize(normal + (viewMatrix * vec4(bend, 0.0)).xyz);
        diffuseColor.rgb *= 1.0 + sin(phase) * 0.04 * fade;
      }
      #endif`);
  }, { scope });
}

/** Signal Dunes' look: extends the engine's clean chain with a dusk dome, dusk fog and a rippled sand painter. */
export function duskLook(): LookStrategy {
  return {
    mode: 'extend',
    compose: ({ engineChain, scene, scope }) => {
      const dome = buildDome(); scene.add(dome);
      scope.own(dome.geometry); for (const m of materials(dome)) scope.own(m); scope.onDispose(() => { dome.removeFromParent(); });
      scene.fog = new Fog(new Color(FOG.color), FOG.near, FOG.far);
      scene.traverse((object) => { if (!isMesh(object) || object === dome || object.userData['noFog'] === true) return; for (const m of materials(object)) fogPatch(m, scope); });
      return { chain: engineChain('clean') };
    },
    sky: { clouds: false, planet: false },
    backdrop: ({ sky }) => {
      // Dusk is held: the clock stays at 19:00 and the key light is authored, not computed from it.
      const clock = new DayCycle({ units: 'hour', start: 19, schedule: [{ phase: 'day', from: 0, to: 24, minutes: 24 }],
        sun: { maxElevation: 50, azimuthOffset: 265 }, fixed: { midday: 12, golden: 17, sunset: 18.5, night: 0 }, presets: { dawn: 6, noon: 12, dusk: 19, night: 0 } });
      return Promise.resolve({ clock, horizon: new Color(0.62, 0.2, 0.08), lut: null,
        bind: () => undefined, update: () => { sky.setKeyLight(KEY.dir, KEY.color, KEY.intensity); },
        rebuild: () => undefined, attachPost: () => undefined });
    },
    terrainPainter: { build: (terrain, field, scope) => {
      const size = 480, segments = 200, geometry = new PlaneGeometry(size, size, segments, segments); geometry.rotateX(-Math.PI / 2);
      scope.own(geometry);
      const pos = geometry.getAttribute('position'), colors = new Float32Array(pos.count * 3), rgb = [0, 0, 0];
      for (let i = 0; i < pos.count; i++) {
        const h = field.heightAt(pos.getX(i), pos.getZ(i)); pos.setY(i, h);
        sandColor(h, rgb); colors[i * 3] = rgb[0] ?? 0; colors[i * 3 + 1] = rgb[1] ?? 0; colors[i * 3 + 2] = rgb[2] ?? 0;
      }
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
      const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }); scope.own(material);
      sandPatch(material, scope);
      const mesh = new Mesh(geometry, material); mesh.receiveShadow = false; // a 9° key light acnes the sand into bands mesh.name = 'sunscar.sand';
      terrain.group.add(mesh); terrain.mesh = mesh; terrain.material = material;
      return Promise.resolve();
    } },
  };
}
