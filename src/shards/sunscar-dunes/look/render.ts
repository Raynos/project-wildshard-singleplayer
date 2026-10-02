import { BackSide, Color, Float32BufferAttribute, Fog, Mesh, MeshStandardMaterial, PlaneGeometry, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { DayCycle, patchShader, PATCH_ORDER, type LookStrategy } from '#engine';
import { GROUND_HALF } from '../layout';
import { WIND } from '../world/dunes';
import { SKY_FRAGMENT, SKY_VERTEX, SUN_GLOW } from './sky';

/**
 * "Last Light" (docs/design/sunscar-dunes/style-bible.md): the key is a low warm sun 10° up, 100° off the spawn view,
 * behind-left of the player (review R1: never in the player's face), so it rakes across the dunes and every slip face
 * (they face it, `world/dunes.ts` WIND) glows orange while the windward faces fall into cool sky light. The afterglow
 * band is art-directed apart from it, behind the tower (`sky.ts` SUN_GLOW).
 */
export const KEY = { dir: new Vector3(-0.97, 0.174, 0.171).normalize(), color: new Color(1, 0.64, 0.4), intensity: 2.5 } as const;
/** Violet aerial perspective: far dune rows cool and lift into layers (R9), never pink. */
export const FOG = { color: 0x5b4a68, near: 80, far: 430 } as const;
const SAND = new Color(0.5, 0.2, 0.075), HOLLOW = new Color(0.2, 0.12, 0.15), CREST = new Color(0.62, 0.28, 0.1);
/** How far (m) and in how many growing steps the bake marches toward the sun for the dunes' cast shadows. */
const SHADOW_MARCH = { first: 2, grow: 1.22, steps: 22 } as const;
const WIND_GLSL = `${WIND.x.toFixed(3)}, ${WIND.z.toFixed(3)}`;

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
  const dome = new Mesh(new SphereGeometry(300, 32, 16), new ShaderMaterial({ side: BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { uSun: { value: SUN_GLOW.clone() } }, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT }));
  dome.renderOrder = -1000; dome.frustumCulled = false;
  return { mode: 'extend',
    compose: ({ engineChain, scene, scope }) => {
      scene.fog = new Fog(new Color(FOG.color), FOG.near, FOG.far);
      scope.own(dome.geometry); scope.own(dome.material);
      scope.onDispose(() => { dome.removeFromParent(); scene.fog = null; });
      return { chain: engineChain('clean') };
    },
    // No sun disc or halo (G25): the sun has just set; the dome paints the afterglow.
    sky: { clouds: false, planet: false, sun: { disc: false, halo: false } },
    backdrop: ({ sky }) => {
      const clock = duskClock();
      return Promise.resolve({ clock, horizon: new Color(FOG.color), lut: null, clouds: dome,
        // Hide the disc mesh too: `sun.disc: false` only hides its material, and three still uploads (counts) the geometry
        // of a visible mesh whose material is hidden, so the disc's sphere outlived the level (the phone leak check).
        bind: (targets) => { targets.disc.visible = false; }, update:() => { sky.setKeyLight(KEY.dir, KEY.color, KEY.intensity); },
        rebuild: () => undefined, attachPost: () => undefined });
    },
    terrainPainter: { build: (terrain, field, scope) => {
      const segments = 192, geometry = new PlaneGeometry(GROUND_HALF * 2, GROUND_HALF * 2, segments, segments); geometry.rotateX(-Math.PI / 2);
      scope.own(geometry);
      const pos = geometry.getAttribute('position'), colors = new Float32Array(pos.count * 3), c = new Color();
      const sunVis = new Float32Array(pos.count), side = segments + 1, cell = (GROUND_HALF * 2) / segments;
      for (let i = 0; i < pos.count; i++) pos.setY(i, field.heightAt(pos.getX(i), pos.getZ(i)));
      // The grid's own heights, bilinear: the shadow march reads these, not the analytic field (37k vertices × 22 steps).
      const gridAt = (x: number, z: number): number => {
        const fx = Math.min(segments - 1e-3, Math.max(0, (x + GROUND_HALF) / cell)), fz = Math.min(segments - 1e-3, Math.max(0, (z + GROUND_HALF) / cell));
        const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, w = fz - iz, at = (a: number, b: number): number => pos.getY(b * side + a);
        return (at(ix, iz) * (1 - u) + at(ix + 1, iz) * u) * (1 - w) + (at(ix, iz + 1) * (1 - u) + at(ix + 1, iz + 1) * u) * w;
      };
      const flat = Math.hypot(KEY.dir.x, KEY.dir.z), sx = KEY.dir.x / flat, sz = KEY.dir.z / flat, rise = KEY.dir.y / flat;
      for (let i = 0; i < pos.count; i++) {
        // Dune self-shadow, baked (R1, phone tier): march toward the sun; the deepest the ground rises over the ray
        // darkens the key light, softly (no shadow map ever reaches 200 m on the phone).
        const x0 = pos.getX(i), z0 = pos.getZ(i), h0 = pos.getY(i) + 0.15;
        let d = SHADOW_MARCH.first, over = 0;
        for (let k = 0; k < SHADOW_MARCH.steps; k++, d *= SHADOW_MARCH.grow) over = Math.max(over, (gridAt(x0 + sx * d, z0 + sz * d) - (h0 + rise * d)) / (0.6 + d * 0.04));
        sunVis[i] = 1 - Math.min(1, Math.max(0, over));
      }
      geometry.setAttribute('sunVis', new Float32BufferAttribute(sunVis, 1));
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i);
        // Hollow vs crest: this vertex against the mean of a 14 m ring around it.
        const mean = (field.heightAt(x + 14, z) + field.heightAt(x - 14, z) + field.heightAt(x, z + 14) + field.heightAt(x, z - 14)) / 4;
        const rel = Math.max(-1, Math.min(1, (h - mean) / 2.5));
        c.copy(SAND); if (rel < 0) c.lerp(HOLLOW, -rel * 0.75); else c.lerp(CREST, rel * 0.5);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }); scope.own(material);
      patchShader(material, 'sunscar.ripples', PATCH_ORDER.decorate, (shader) => {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSandPos;\nattribute float sunVis;\nvarying float vSunVis;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSandPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvSunVis = sunVis;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vSandPos;
varying float vSunVis;
float sandHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
  float sandFar = length(vSandPos - cameraPosition);
  // Wind ripples (R3): ~0.55 m crests across the wind (${WIND_GLSL}), bent by slow warps; light and shadow from the
  // normal below, plus a faint albedo band. Fade out before they alias.
  vec2 sandW = vec2(${WIND_GLSL});
  float sandU = dot(vSandPos.xz, sandW), sandV = dot(vSandPos.xz, vec2(-sandW.y, sandW.x));
  float sandPhase = (sandU + sin(sandV * 0.21) * 1.3 + sin(sandV * 0.053 + sandU * 0.04) * 3.5) * 11.4;
  float sandNear = 1.0 - smoothstep(5.0, 24.0, sandFar);
  float sandGrain = sandHash(floor(vSandPos.xz * 22.0)) - 0.5;
  diffuseColor.rgb *= 1.0 + (0.05 * sin(sandPhase) + 0.12 * sandGrain) * sandNear;`)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    // The ripple's slope along the wind, as a world-space tilt of the normal, turned to view space.
    float rippleSlope = cos(sandPhase) * 0.2 * sandNear;
    vec3 rippleTilt = vec3(sandW.x, 0.0, sandW.y) * rippleSlope;
    normal = normalize(normal - (viewMatrix * vec4(rippleTilt, 0.0)).xyz);
  }`)
          .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  // The baked dune shadow takes only the key (direct) light; the cool sky fill stays.
  reflectedLight.directDiffuse *= mix(0.06, 1.0, vSunVis);
  reflectedLight.directSpecular *= vSunVis;`);
      }, { scope });
      const mesh = new Mesh(geometry, material); mesh.receiveShadow = false;
      terrain.group.add(mesh); terrain.mesh = mesh; terrain.material = material;
      return Promise.resolve();
    } },
  };
}
