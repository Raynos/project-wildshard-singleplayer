import { DUSK, fillAt, keyAt } from './dusk';
import { BackSide, ClampToEdgeWrapping, Color, DataTexture, Float32BufferAttribute, Fog, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, PlaneGeometry, RedFormat, RepeatWrapping, RGBAFormat, ShaderMaterial, SphereGeometry, UnsignedByteType, Vector3, type BufferGeometry, type HemisphereLight } from 'three';
import { DayCycle, patchShader, PATCH_ORDER, type LookStrategy } from '#engine';
import { GROUND_HALF } from '../layout';
import { WIND } from '../world/dunes';
import { SKY_FRAGMENT, SKY_VERTEX, SUN_GLOW } from './sky';

/**
 * "Last Light" (docs/design/sunscar-dunes/style-bible.md): the key is a low warm sun ~9° up in front of the spawn view,
 * with the afterglow behind the tower (E399, the lead after council round 2: the mockups win over the old "never in the
 * player's face" rule), so the dune faces turned to the camera fall into cool shade, the crests catch the light and the
 * ripples graze; the crests run diagonally across the view (`world/dunes.ts` WIND), so the ridges layer to the tower.
 */
// loop 3: a deeper, redder key (ΔE00 of the lit sand against the H1–H4 targets: the game's was too pale and grey-blue)
// E399: low (11 deg) and along the wind axis, so every dune splits into a lit slip face and a shaded windward face
// (the mockups); the shade floor and the navy fill keep the shaded half readable, never black
export const KEY = { dir: new Vector3(-0.85, 0.2, -0.5).normalize(), color: new Color(1, 0.58, 0.32), intensity: 1.5 } as const; // E399 (R2B-1): measured against the mockups' ground patches, not eyeballed // loop 5 targets: saturated lit faces, deep shade
/** Violet aerial perspective: far dune rows cool and lift into layers (R9), never pink. */
/** The key's colour at the blue hour (look/dusk.ts): a low red ember of the set sun. */
const DEEP_KEY = new Color(0.78, 0.42, 0.4);
export const FOG = { color: 0x40304a, near: 80, far: 430 } as const; // loop 6: a deep dusk haze, not lilac
// loop 6: lit sand a gold-orange, less saturated and a little lighter than loop 5 (the targets' lit faces)
// E399 (council round 2, R2B-1: the mockups' ground measures warm brown, R/B ~3): less blue in every tone
const SAND = new Color(0.5, 0.23, 0.075),
  HOLLOW = new Color(0.22, 0.14, 0.12), CREST = new Color(0.64, 0.33, 0.1);
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

/** The trail mask (round 2): 1 on the trodden bed, 0 a few metres off it, at the shadow map's 0.75 m texels. */
function bakeTrail(trailDistance: (x: number, z: number) => number): DataTexture {
  const n = SHADOW_TEX, data = new Uint8Array(n * n), texel = (GROUND_HALF * 2) / n;
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    const d = trailDistance(-GROUND_HALF + (ix + 0.5) * texel, -GROUND_HALF + (iz + 0.5) * texel), t = Math.min(1, Math.max(0, (d - 1.8) / 1.6));
    data[iz * n + ix] = Math.round(255 * (1 - t * t * (3 - 2 * t)));
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

/** The skirt round the painted ground: an 800 m grid, `cell` metres a quad, aligned with the ground's edge. */
const SKIRT = { out: 520, cell: 8 } as const;
/**
 * Round 2 (R1C-5: the first skirt drew saw-tooth bands from above): one indexed grid with smooth normals. Inside the
 * square it sits 2 m under the ground (hidden); on the edge it meets the ground's own heights; outside it eases into
 * smooth swells along the wind.
 */
function skirtGeometry(heightAt: (x: number, z: number) => number): BufferGeometry {
  const n = (SKIRT.out * 2) / SKIRT.cell, g = new PlaneGeometry(SKIRT.out * 2, SKIRT.out * 2, n, n); g.rotateX(-Math.PI / 2);
  const p = g.getAttribute('position'), col = new Float32Array(p.count * 3), c = new Color().copy(SAND).lerp(HOLLOW, 0.25), edge = GROUND_HALF;
  const swell = (x: number, z: number): number => {
    const u = (x * WIND.x + z * WIND.z) / 64, v = (-x * WIND.z + z * WIND.x) / 90;
    return 2.5 + 3 * Math.sin((u + Math.sin(v) * 0.4) * Math.PI * 2);
  };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), out = Math.max(Math.abs(x), Math.abs(z)) - edge;
    const cx = Math.max(-edge, Math.min(edge, x)), cz = Math.max(-edge, Math.min(edge, z));
    const t = Math.min(1, Math.max(0, out / 60)), e = t * t * (3 - 2 * t);
    const y = out < -0.5 ? heightAt(x, z) - 2 : heightAt(cx, cz) * (1 - e) + swell(x, z) * e - 0.05;
    p.setY(i, y); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
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
  // 120 m: the dome draws first with no depth test, so its size never occludes; at 300 m the far plane clipped it (an arc)
  const dome = new Mesh(new SphereGeometry(120, 48, 24), new ShaderMaterial({ side: BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { uSun: { value: SUN_GLOW.clone() }, uDusk: DUSK }, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT }));
  dome.renderOrder = -1000; dome.frustumCulled = false;
  return { mode: 'extend',
    compose: ({ engineChain, scene, scope }) => {
      scene.fog = new Fog(new Color(FOG.color), FOG.near, FOG.far);
      const chain = engineChain('clean');
      scope.own(dome.geometry); scope.own(dome.material);
      scope.onDispose(() => { dome.removeFromParent(); scene.fog = null; });
      return { chain };
    },
    // No sun disc or halo (G25): the sun has just set; the dome paints the afterglow.
    sky: { clouds: false, planet: false, sun: { disc: false, halo: false } },
    backdrop: ({ sky }) => {
      const clock = duskClock(), keyColor = new Color();
      let hemi: HemisphereLight | null = null, hemiBase = 1;
      return Promise.resolve({ clock, horizon: new Color(FOG.color), lut: null, clouds: dome,
        // Hide the disc mesh too: `sun.disc: false` only hides its material, and three still uploads (counts) the geometry
        // of a visible mesh whose material is hidden, so the disc's sphere outlived the level (the phone leak check).
        bind: (targets) => { targets.disc.visible = false; hemi = targets.hemi; hemiBase = targets.hemi.intensity; },
        // the dusk deepens with the quest (look/dusk.ts): the key dims and reddens, the sky fill drops
        update: () => {
          sky.setKeyLight(KEY.dir, keyColor.copy(KEY.color).lerp(DEEP_KEY, DUSK.value), KEY.intensity * keyAt(DUSK.value));
          if (hemi) hemi.intensity = hemiBase * fillAt(DUSK.value);
        },
        rebuild: () => undefined, attachPost: () => undefined });
    },
    terrainPainter: { build: (terrain, field, scope) => {
      // 256: the baked height grid's own spacing (1.95 m; round 1, R1C-5: 192 blunted the crests)
      const segments = 256, geometry = new PlaneGeometry(GROUND_HALF * 2, GROUND_HALF * 2, segments, segments); geometry.rotateX(-Math.PI / 2);
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
      const trail = bakeTrail((x, z) => field.trailDistance(x, z)); scope.own(trail);
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
        shader.uniforms['uSandShadow'] = { value: shadow }; shader.uniforms['uSandGrain'] = { value: grain }; shader.uniforms['uSandTrail'] = { value: trail }; shader.uniforms['uDusk'] = DUSK;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSandPos;\nvarying vec3 vSandN;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSandPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvSandN = normalize(mat3(modelMatrix) * objectNormal);');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vSandPos;
varying vec3 vSandN;
uniform sampler2D uSandShadow;
uniform sampler2D uSandGrain;
uniform sampler2D uSandTrail;
uniform float uDusk;
// A ripple octave survives while a pixel spans well under one period, at any distance (no fixed fade, no aliasing).
float sandAA(float phase) { return 1.0 - smoothstep(0.5, 1.8, fwidth(phase)); }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
  float sandFar = length(vSandPos - cameraPosition);
  // Wind ripples (R3, loop 2): two octaves across the wind (${WIND_GLSL}), bent by slow warps: 0.4 m ripples and 1.6 m
  // megaripples, each kept while the pixel resolves it, so the aerials and the far slopes keep their texture. Slip
  // faces avalanche smooth: the ripples live on the gentle windward faces and the flats.
  vec2 sandW = vec2(${WIND_GLSL});
  float sandU = dot(vSandPos.xz, sandW), sandV = dot(vSandPos.xz, vec2(-sandW.y, sandW.x));
  // a third, slow warp breaks the regular sine moire (the scorer's h3 diagonal)
  float sandWarp = sin(sandV * 0.21) * 1.3 + sin(sandV * 0.053 + sandU * 0.04) * 3.5 + sin(sandU * 0.017 + sandV * 0.11) * 2.2;
  float sandPhase = (sandU + sandWarp) * 15.7;
  float sandPhase2 = (sandU * 0.97 + sandWarp * 1.6 + sin(sandV * 0.6) * 0.35 + sin(sandV * 0.13 + sandU * 0.09) * 1.1) * 3.93;
  float sandFlat = smoothstep(0.78, 0.96, normalize(vSandN).y);
  // loop 3: the ripples come in patches (wind-scoured fields and smooth swales), not one even corduroy over every dune
  float sandPatch = clamp(0.5 + 0.6 * sin(sandV * 0.31 + sin(sandU * 0.19) * 1.7) * sin(sandU * 0.27 + sandV * 0.07 + 1.3), 0.12, 1.0);
  float sandRip1 = sandAA(sandPhase) * (0.3 + 0.7 * sandFlat) * sandPatch, sandRip2 = sandAA(sandPhase2) * sandFlat * (0.4 + 0.6 * sandPatch);
  vec4 sandTex = texture2D(uSandGrain, vSandPos.xz * 0.55);
  // round 2 (R1C-5 / seat B: the trails were soft smears from above): a baked 0.75 m trail mask, trodden darker and smooth
  float sandTrod = texture2D(uSandTrail, (vSandPos.xz + ${GROUND_HALF.toFixed(1)}) / ${(GROUND_HALF * 2).toFixed(1)}).r;
  sandRip1 *= 1.0 - sandTrod; sandRip2 *= 1.0 - sandTrod;
  // E399 (mockups A, D): fine low-contrast ripples near the camera, the bold stripes only at middle distance
  float sandNear = mix(0.3, 0.55, smoothstep(4.0, 26.0, sandFar)); // the mockups: fine ripples, the big forms read
  sandRip1 *= sandNear; sandRip2 *= sandNear;
  diffuseColor.rgb *= 1.0 + 0.06 * sin(sandPhase) * sandRip1 + 0.02 * sin(sandPhase2) * sandRip2 + (sandTex.r - 0.5) * 0.24;
  // loop 4, surface variety (the council's baseline: the near sand read as one flat brown): broad tonal drifts (tens of
  // metres) and pale wind-blown streaks running downwind over the windward faces, a finer darker sand in the scours.
  float sandDrift = sin(sandU * 0.045 + sin(sandV * 0.031) * 2.0) * sin(sandV * 0.052 + 1.7) + 0.5 * sin(sandU * 0.11 + sandV * 0.07);
  float sandStreak = smoothstep(0.55, 0.95, sin(sandV * 1.9 + sin(sandU * 0.07) * 3.0) * sin(sandV * 0.37 + 0.6)) * (0.4 + 0.6 * sandFlat);
  diffuseColor.rgb *= 1.0 + 0.08 * sandDrift;
  // check pass (4): the path brightens with distance, so the route reads from above; underfoot it stays a subtle trodden bed
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 1.05, 0.98), sandTrod * 0.6); // a faint trodden bed (E399: brighter read as a light column)
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 1.12, 1.02), sandStreak * 0.55 * (1.0 - smoothstep(60.0, 140.0, sandFar)));`)
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
  reflectedLight.directDiffuse *= mix(0.38, 1.0, sandVis);
  reflectedLight.directSpecular *= sandVis;
  // Round 1 (R1C-3): where the key doesn't reach (cast shadow or a face turned from it) the sky fill paints the bible's
  // cool violet shade (#4a3a48 to #5b4f6a), not a darkened orange: the crest line splits warm from cool.
  float sandKeyN = dot(normalize(vSandN), vec3(${KEY.dir.x.toFixed(3)}, ${KEY.dir.y.toFixed(3)}, ${KEY.dir.z.toFixed(3)}));
  float sandShade = 1.0 - smoothstep(0.0, 0.14, sandKeyN) * sandVis;
  // E399 (council round 2, R2B-1): the shade keeps the sand's own hue (a grey luminance fill read as flat pink-grey)
  vec3 sandFill = reflectedLight.indirectDiffuse;
  // loop 6 (the scorer: shade went muddy purple-black, ripples vanished in it): a cool blue-grey fill, a step brighter,
  // and the ripples and grain shade the sky light too, so they read in shadow as they do in the targets
  reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, sandFill * mix(vec3(0.95, 0.9, 1.3), vec3(0.85, 0.85, 1.2), uDusk) * mix(1.1, 1.7, uDusk), sandShade * 0.9); // the dusk's shade a warm brown, never blue-black (R2B-1) // the mockups' shade: cool mid-tone, ripples readable // loop 6: navy shade (the targets)
  // the dusk's lavender sky floor (R2B-1: the late views' sand measures dim warm brown-violet, not black or pure orange)
  reflectedLight.indirectDiffuse += uDusk * vec3(0.011, 0.008, 0.017);
  reflectedLight.indirectDiffuse *= 1.0 + (0.16 * sin(sandPhase) * sandRip1 + 0.07 * sin(sandPhase2) * sandRip2) * sandShade + (sandTex.r - 0.5) * 0.18;`);
      }, { scope });
      const mesh = new Mesh(geometry, material); mesh.receiveShadow = false;
      terrain.group.add(mesh); terrain.mesh = mesh; terrain.material = material;
      // Round 1 (R1C-5 / R1B-14): the dune sea runs on past the square to the buttes (from above the ground ended in a
      // ruler-straight edge over nothing). A coarse skirt, its inner edge on the ground's own edge heights, easing out into
      // gentle swells along the wind; the same sand material, so the fog lays it back with the rest.
      const skirt = skirtGeometry((x, z) => field.heightAt(x, z)); scope.own(skirt);
      const skirtMesh = new Mesh(skirt, material); skirtMesh.receiveShadow = false; terrain.group.add(skirtMesh);
      return Promise.resolve();
    } },
  };
}
