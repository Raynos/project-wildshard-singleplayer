import { BackSide, ClampToEdgeWrapping, Color, DataTexture, Float32BufferAttribute, Fog, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, PlaneGeometry, RedFormat, RepeatWrapping, RGBAFormat, ShaderMaterial, SphereGeometry, UnsignedByteType, Vector3 } from 'three';
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
const SHADOW_MARCH = { first: 0.8, grow: 1.22, steps: 26 } as const;
const WIND_GLSL = `${WIND.x.toFixed(3)}, ${WIND.z.toFixed(3)}`;

/** The baked dune-shadow map's size (texels a side over the 480 m ground: 0.75 m a texel, 3.3× the terrain grid). */
const SHADOW_TEX = 640;

/**
 * Dune self-shadow, baked (R1; loop 2 sharpens it): per texel, march toward the key over the terrain grid's heights;
 * the deepest the ground rises over the ray darkens the key light. A texture, not a vertex attribute, so a crest's
 * shadow edge is drawn at 0.75 m, not smeared across the 2.5 m grid (no shadow map ever reaches 200 m on the phone).
 */
function bakeDuneShadow(heightAt: (x: number, z: number) => number): DataTexture {
  const n = SHADOW_TEX, data = new Uint8Array(n * n), texel = (GROUND_HALF * 2) / n;
  const flat = Math.hypot(KEY.dir.x, KEY.dir.z), sx = KEY.dir.x / flat, sz = KEY.dir.z / flat, rise = KEY.dir.y / flat;
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    const x0 = -GROUND_HALF + (ix + 0.5) * texel, z0 = -GROUND_HALF + (iz + 0.5) * texel, h0 = heightAt(x0, z0) + 0.12;
    let d = SHADOW_MARCH.first, over = 0;
    for (let k = 0; k < SHADOW_MARCH.steps; k++, d *= SHADOW_MARCH.grow) over = Math.max(over, (heightAt(x0 + sx * d, z0 + sz * d) - (h0 + rise * d)) / (0.3 + d * 0.025));
    data[iz * n + ix] = Math.round(255 * (1 - Math.min(1, Math.max(0, over))));
  }
  const tex = new DataTexture(data, n, n, RedFormat, UnsignedByteType);
  tex.magFilter = LinearFilter; tex.minFilter = LinearFilter; tex.wrapS = ClampToEdgeWrapping; tex.wrapT = ClampToEdgeWrapping; tex.needsUpdate = true;
  return tex;
}

/**
 * The sand texture set, made in code (loop 2): a 256² tile, 1.8 m a side, of fine grain. R is the grain's albedo (pale
 * quartz and dark mineral specks in a soft mottle), G / B its bump slope in x / z. Mipmapped, so it never sparkles.
 */
function sandGrainTexture(): DataTexture {
  const n = 256, data = new Uint8Array(n * n * 4), h = new Float32Array(n * n);
  const hash = (x: number, y: number): number => { const s = Math.sin(((x % n + n) % n) * 127.1 + ((y % n + n) % n) * 311.7) * 43758.5453; return s - Math.floor(s); };
  // value noise at a few periods that divide the tile, so it wraps seamlessly
  const noise = (x: number, y: number, p: number): number => {
    const k = n / p, fx = x / k, fy = y / k, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
    const at = (a: number, b: number): number => hash(((a % p) + p) % p * 7 + p, ((b % p) + p) % p * 13 + p);
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    return (at(ix, iy) * (1 - su) + at(ix + 1, iy) * su) * (1 - sv) + (at(ix, iy + 1) * (1 - su) + at(ix + 1, iy + 1) * su) * sv;
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = noise(x, y, 64) * 0.5 + noise(x, y, 128) * 0.3 + hash(x, y) * 0.35;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, speck = hash(x * 3 + 1, y * 5 + 2), mottle = noise(x, y, 8) * 0.5 + noise(x, y, 16) * 0.5;
    const albedo = 0.5 + (mottle - 0.5) * 0.35 + (speck > 0.985 ? -0.35 : speck > 0.96 ? 0.22 : 0) + (hash(x, y) - 0.5) * 0.18;
    const dx = (h[y * n + (x + 1) % n] ?? 0) - (h[y * n + (x + n - 1) % n] ?? 0), dz = (h[((y + 1) % n) * n + x] ?? 0) - (h[((y + n - 1) % n) * n + x] ?? 0);
    data[i * 4] = Math.round(255 * Math.min(1, Math.max(0, albedo)));
    data[i * 4 + 1] = Math.round(255 * Math.min(1, Math.max(0, 0.5 + dx * 0.9)));
    data[i * 4 + 2] = Math.round(255 * Math.min(1, Math.max(0, 0.5 + dz * 0.9)));
    data[i * 4 + 3] = 255;
  }
  const tex = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType);
  tex.wrapS = RepeatWrapping; tex.wrapT = RepeatWrapping; tex.magFilter = LinearFilter; tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.needsUpdate = true;
  return tex;
}

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
      const side = segments + 1, cell = (GROUND_HALF * 2) / segments;
      for (let i = 0; i < pos.count; i++) pos.setY(i, field.heightAt(pos.getX(i), pos.getZ(i)));
      // The grid's own heights, bilinear: the shadow march reads these, not the analytic field.
      const gridAt = (x: number, z: number): number => {
        const fx = Math.min(segments - 1e-3, Math.max(0, (x + GROUND_HALF) / cell)), fz = Math.min(segments - 1e-3, Math.max(0, (z + GROUND_HALF) / cell));
        const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, w = fz - iz, at = (a: number, b: number): number => pos.getY(b * side + a);
        return (at(ix, iz) * (1 - u) + at(ix + 1, iz) * u) * (1 - w) + (at(ix, iz + 1) * (1 - u) + at(ix + 1, iz + 1) * u) * w;
      };
      const shadow = bakeDuneShadow(gridAt); scope.own(shadow);
      const grain = sandGrainTexture(); scope.own(grain);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i);
        // Hollow vs crest: this vertex against the mean of a 14 m ring around it.
        const mean = (field.heightAt(x + 14, z) + field.heightAt(x - 14, z) + field.heightAt(x, z + 14) + field.heightAt(x, z - 14)) / 4;
        const rel = Math.max(-1, Math.min(1, (h - mean) / 2.5));
        c.copy(SAND); if (rel < 0) c.lerp(HOLLOW, -rel * 0.75); else c.lerp(CREST, rel * 0.6);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }); scope.own(material);
      patchShader(material, 'sunscar.ripples', PATCH_ORDER.decorate, (shader) => {
        shader.uniforms['uSandShadow'] = { value: shadow }; shader.uniforms['uSandGrain'] = { value: grain };
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSandPos;\nvarying vec3 vSandN;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSandPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvSandN = normalize(mat3(modelMatrix) * objectNormal);');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vSandPos;
varying vec3 vSandN;
uniform sampler2D uSandShadow;
uniform sampler2D uSandGrain;
// A ripple octave survives while a pixel spans well under one period, at any distance (no fixed fade, no aliasing).
float sandAA(float phase) { return 1.0 - smoothstep(0.7, 2.4, fwidth(phase)); }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
  float sandFar = length(vSandPos - cameraPosition);
  // Wind ripples (R3, loop 2): two octaves across the wind (${WIND_GLSL}), bent by slow warps: 0.4 m ripples and 1.6 m
  // megaripples, each kept while the pixel resolves it, so the aerials and the far slopes keep their texture. Slip
  // faces avalanche smooth: the ripples live on the gentle windward faces and the flats.
  vec2 sandW = vec2(${WIND_GLSL});
  float sandU = dot(vSandPos.xz, sandW), sandV = dot(vSandPos.xz, vec2(-sandW.y, sandW.x));
  float sandWarp = sin(sandV * 0.21) * 1.3 + sin(sandV * 0.053 + sandU * 0.04) * 3.5;
  float sandPhase = (sandU + sandWarp) * 15.7;
  float sandPhase2 = (sandU * 0.97 + sandWarp * 1.6 + sin(sandV * 0.6) * 0.35 + sin(sandV * 0.13 + sandU * 0.09) * 1.1) * 3.93;
  float sandFlat = smoothstep(0.78, 0.96, normalize(vSandN).y);
  float sandRip1 = sandAA(sandPhase) * (0.3 + 0.7 * sandFlat), sandRip2 = sandAA(sandPhase2) * sandFlat;
  vec4 sandTex = texture2D(uSandGrain, vSandPos.xz * 0.55);
  diffuseColor.rgb *= 1.0 + 0.06 * sin(sandPhase) * sandRip1 + 0.02 * sin(sandPhase2) * sandRip2 + (sandTex.r - 0.5) * 0.24;`)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    // The ripples' slopes along the wind (a long gentle stoss, a short steep lee) and the grain's bumps, as a
    // world-space tilt of the normal, turned to view space.
    float s1 = (cos(sandPhase) + 0.4 * cos(2.0 * sandPhase)) * 0.12 * sandRip1;
    float s2 = cos(sandPhase2) * 0.05 * sandRip2;
    vec2 sandBump = (sandTex.gb - 0.5) * 0.5 * (1.0 - smoothstep(8.0, 40.0, sandFar));
    vec3 rippleTilt = vec3(sandW.x, 0.0, sandW.y) * (s1 + s2) + vec3(sandBump.x, 0.0, sandBump.y);
    normal = normalize(normal - (viewMatrix * vec4(rippleTilt, 0.0)).xyz);
  }`)
          .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  // The baked dune shadow (a ${String(SHADOW_TEX)}² map, sharpened) takes only the key (direct) light; the cool sky fill stays.
  float sandVis = smoothstep(0.22, 0.78, texture2D(uSandShadow, (vSandPos.xz + ${GROUND_HALF.toFixed(1)}) / ${(GROUND_HALF * 2).toFixed(1)}).r);
  reflectedLight.directDiffuse *= mix(0.06, 1.0, sandVis);
  reflectedLight.directSpecular *= sandVis;`);
      }, { scope });
      const mesh = new Mesh(geometry, material); mesh.receiveShadow = false;
      terrain.group.add(mesh); terrain.mesh = mesh; terrain.material = material;
      return Promise.resolve();
    } },
  };
}
