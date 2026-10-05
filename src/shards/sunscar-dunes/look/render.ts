import { DUSK, fillAt, keyAt } from './dusk';
import { BackSide, ClampToEdgeWrapping, Color, DataTexture, Float32BufferAttribute, Fog, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, PlaneGeometry, RedFormat, RepeatWrapping, RGBAFormat, ShaderMaterial, SphereGeometry, UnsignedByteType, Vector3, type BufferGeometry, type HemisphereLight, type Texture } from 'three';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { patchShader, PATCH_ORDER } from '@wildshard/engine/render/shaderPatches';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { GROUND_HALF } from '../layout';
import { WIND } from '../world/dunes';
import { FIRE_LIGHTS } from '../world/fireFx';
import { SKY_FRAGMENT, SKY_VERTEX, SUN_GLOW } from './sky';
import { loadPaintedSky, paintedSkyMaterial } from './painted';
import { holdSkirt } from './cube';

/**
 * "Last Light" (docs/design/sunscar-dunes/style-bible.md): the key is a low warm sun ~9° up in front of the spawn view,
 * with the afterglow behind the tower (E399, the lead after council round 2: the mockups win over the old "never in the
 * player's face" rule), so the dune faces turned to the camera fall into cool shade, the crests catch the light and the
 * ripples graze; the crests run diagonally across the view (`world/dunes.ts` WIND), so the ridges layer to the tower.
 */
// loop 3: a deeper, redder key (ΔE00 of the lit sand against the H1–H4 targets: the game's was too pale and grey-blue)
// E399: low (11 deg) and along the wind axis, so every dune splits into a lit slip face and a shaded windward face
// (the mockups); the shade floor and the navy fill keep the shaded half readable, never black
// round 8 (the council since round 5: a vertical terminator smeared down the tower's dome, the shade a baked blob): the key
// from behind the tower; round 10 (a sweep of six azimuths, west round to east, on round 9's terrain, the dune band's 10x7
// luma grid correlated with each mockup's: A +0.18 at best for any, dusk-fire +0.39 from the NNW, +0.25 from round 9's WNW;
// round 9's seats: the WNW key lit A's left, which the mockup shades): the NNW, with the crest line (layout CREST_LINES)
// and a crisp terminator; dusk-fire's clean-patch sand 73 / mockup 72, A's 78 / 56 (the two mockups' known disagreement)
// round 19 (the lead's ruling after round 18: DECOUPLE): the painted glow stays where the mockups paint it, right of the
// tower; the key is one global art-directed direction that lights the faces the mockups light. Tested on round 13's
// landform (row-mean-removed r of the dune band): 20 deg left of north gave dusk-fire +0.42, A +0.13 (15 deg: +0.45 / +0.10;
// 27 deg: +0.36 / +0.13; west and behind-left: -0.18 to +0.09); A does not pass +0.3 under any one key
export const KEY = { dir: new Vector3(-0.34, 0.2, -0.92).normalize(), color: new Color(1, 0.68, 0.34), intensity: 1.85 } as const; // E399 (R2B-1): measured against the mockups' ground patches, not eyeballed // loop 5 targets: saturated lit faces, deep shade
/** Violet aerial perspective: far dune rows cool and lift into layers (R9), never pink. */
/** The key's colour at the blue hour (look/dusk.ts): a low red ember of the set sun. */
const DEEP_KEY = new Color(0.78, 0.42, 0.4);
// round 22 (the lead after round 21: the light band's 0x5e5288 turned A's mid dunes and D's far land milky lilac): the
// horizon's darker violet near the ground
export const FOG = { color: 0x3e3452, near: 80, far: 430 } as const;
/** The distance fog's density (the engine's exponential fog, per metre): row 10's aerial perspective. */
const AERIAL_FOG = 0.0013; // round 22 (the lead: subtle in front of ~300 m): 18 % at 150 m, 32 % at 300 m, 48 % at 500 m (0.0028: 34 / 57 / 75 %) // loop 6: a deep dusk haze, not lilac; E409 second top-10 row 10 (aerial perspective: the mockups' far dunes go violet-blue, blue/red 0.62-0.88): the horizon sky's lighter violet-blue (round 21b)
// loop 6: lit sand a gold-orange, less saturated and a little lighter than loop 5 (the targets' lit faces)
// E399 (council round 2, R2B-1: the mockups' ground measures warm brown, R/B ~3): less blue in every tone
const SAND = new Color(0.5, 0.23, 0.075),
  HOLLOW = new Color(0.22, 0.14, 0.12), CREST = new Color(0.64, 0.33, 0.1);
/** How far (m) and in how many growing steps the bake marches toward the sun for the dunes' cast shadows. */
const SHADOW_MARCH = { first: 0.8, grow: 1.22, steps: 26 } as const;
const WIND_GLSL = `${WIND.x.toFixed(3)}, ${WIND.z.toFixed(3)}`;

/** The baked dune-shadow map's size and reach (E407 row 3: it covered only the 480 m ground; the far skirt's dunes, out to
 *  the range rings, cast no shade): 896 texels a side over +-520 m, 1.16 m a texel. */
const SHADOW_TEX = 896, SHADOW_HALF = 520;

/**
 * Dune self-shadow, baked (R1; loop 2 sharpens it): per texel, march toward the key over the terrain grid's heights;
 * the deepest the ground rises over the ray darkens the key light. A texture, not a vertex attribute, so a crest's
 * shadow edge is drawn at 0.75 m, not smeared across the 2.5 m grid (no shadow map ever reaches 200 m on the phone).
 */
function bakeDuneShadow(heightAt: (x: number, z: number) => number): DataTexture {
  const n = SHADOW_TEX, data = new Uint8Array(n * n), texel = (SHADOW_HALF * 2) / n;
  const flat = Math.hypot(KEY.dir.x, KEY.dir.z), sx = KEY.dir.x / flat, sz = KEY.dir.z / flat, rise = KEY.dir.y / flat;
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    const x0 = -SHADOW_HALF + (ix + 0.5) * texel, z0 = -SHADOW_HALF + (iz + 0.5) * texel, h0 = heightAt(x0, z0) + 0.12;
    let d = SHADOW_MARCH.first, over = 0;
    for (let k = 0; k < SHADOW_MARCH.steps; k++, d *= SHADOW_MARCH.grow) over = Math.max(over, (heightAt(x0 + sx * d, z0 + sz * d) - (h0 + rise * d)) / (0.25 + d * 0.012)); // E407 row 3: the penumbra grows half as fast (crisp long shadows)
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
  // round 17 (the lead's restated rule: no term may change brightness by camera distance; seat B measured the grain fades
  // 3.4 % dark at the camera): the shader subtracts the tile's own means, so every distance-faded grain term is zero-mean
  let sumR = 0, sumGlint = 0;
  const step01 = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < n * n; i++) { const r = (data[i * 4] ?? 0) / 255; sumR += r; sumGlint += step01(0.82, 0.95, r) - step01(0.82, 0.95, 1 - r); }
  const tex = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType);
  tex.userData['meanR'] = sumR / (n * n); tex.userData['meanGlint'] = sumGlint / (n * n);
  tex.wrapS = RepeatWrapping; tex.wrapT = RepeatWrapping; tex.magFilter = LinearFilter; tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 8; tex.needsUpdate = true; // round 5: at the grazing near view the plain mips blurred the grain to grey
  return tex;
}

/** The skirt round the painted ground: an 800 m grid, `cell` metres a quad, aligned with the ground's edge. */
const SKIRT = { out: 520, cell: 8 } as const;
/**
 * Round 2 (R1C-5: the first skirt drew saw-tooth bands from above): one indexed grid with smooth normals. Inside the
 * square it sits 2 m under the ground (hidden); on the edge it meets the ground's own heights; outside it eases into
 * smooth swells along the wind.
 */
/** The skirt's height past the ground's edge (its edge heights easing into swells along the wind); inside, `heightAt`. */
function skirtAt(heightAt: (x: number, z: number) => number, x: number, z: number): number {
  const edge = GROUND_HALF, out = Math.max(Math.abs(x), Math.abs(z)) - edge;
  if (out < -0.5) return heightAt(x, z);
  const cx = Math.max(-edge, Math.min(edge, x)), cz = Math.max(-edge, Math.min(edge, z));
  const t = Math.min(1, Math.max(0, out / 60)), e = t * t * (3 - 2 * t);
  const u = (x * WIND.x + z * WIND.z) / 64, v = (-x * WIND.z + z * WIND.x) / 90;
  return heightAt(cx, cz) * (1 - e) + (2.5 + 3 * Math.sin((u + Math.sin(v) * 0.4) * Math.PI * 2)) * e - 0.05;
}
function skirtGeometry(heightAt: (x: number, z: number) => number, reach: number = SKIRT.out): BufferGeometry {
  // G99: a grid cell's skirt ends at its cube (`reach` 250, look/cube.ts); standalone it runs to SKIRT.out
  const n = Math.max(1, Math.round((reach * 2) / SKIRT.cell)), g = new PlaneGeometry(reach * 2, reach * 2, n, n); g.rotateX(-Math.PI / 2);
  const p = g.getAttribute('position'), col = new Float32Array(p.count * 3), c = new Color().copy(SAND).lerp(HOLLOW, 0.25), edge = GROUND_HALF;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), out = Math.max(Math.abs(x), Math.abs(z)) - edge;
    const y = out < -0.5 ? heightAt(x, z) - 2 : skirtAt(heightAt, x, z);
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
  // E409 second top-10 row 2: the painted dusk skies replace the procedural dome once they load (the backdrop); freed with the look
  let painted: { material: ShaderMaterial; textures: readonly Texture[] } | null = null;
  return { mode: 'extend',
    compose: ({ engineChain, scene, scope }) => {
      // round 22 (seat C after round 21: a new Fog here orphaned the one the backdrop had bound, so the update's fog edits
      // never drew): the scene's own fog is edited in place
      if (scene.fog instanceof Fog) { scene.fog.color.set(FOG.color); scene.fog.near = FOG.near; scene.fog.far = FOG.far; }
      else scene.fog = new Fog(new Color(FOG.color), FOG.near, FOG.far);
      const chain = engineChain('clean');
      // E399: the engine's AgX stays (tried NEUTRAL, the lead's lever: it drove the sand's blue channel to ~0 and every sky to a
      // saturated plum, since this look's colours are tuned under AgX's highlight desaturation)
      scope.own(dome.geometry); scope.own(dome.material);
      scope.onDispose(() => {
        dome.removeFromParent(); scene.fog = null;
        if (painted) { painted.material.dispose(); for (const t of painted.textures) t.dispose(); painted = null; }
      });
      return { chain };
    },
    // No sun disc or halo (G25): the sun has just set; the dome paints the afterglow.
    sky: { clouds: false, planet: false, sun: { disc: false, halo: false } },
    backdrop: async ({ sky }) => {
      const stages = await loadPaintedSky();
      if (stages) {
        const procedural = dome.material, material = paintedSkyMaterial(stages, DUSK);
        dome.material = material; procedural.dispose(); painted = { material, textures: stages };
      }
      // E407 row 10's learned grade (art/sunscar-dunes/round-24-lut) is out of the grade until the landforms settle (the lead
      // and seat B after round 16: fitted before the wind went back, it dropped B's and dusk-fire's near sand ~7); its file
      // stays a declared late read (boot/files.ts) for the re-fit
      const clock = duskClock(), keyColor = new Color();
      let hemi: HemisphereLight | null = null, hemiBase = 1;
      // round 10 (R9B-2: under every dusk horizon the far land is 2-4x the mockups', which put near-black land under a thin
      // glow line): the distance fog, its sun-side tint and the far rings' haze darken as the dusk deepens
      let fogOf: (() => Fog) | null = null, fogSun: Color | null = null, haze: Color | null = null, fogDist: { value: number } | null = null;
      const fogSunBase = new Color(), hazeBase = new Color();
      return { clock, horizon: new Color(FOG.color), lut: null, clouds: dome,
        // Hide the disc mesh too: `sun.disc: false` only hides its material, and three still uploads (counts) the geometry
        // of a visible mesh whose material is hidden, so the disc's sphere outlived the level (the phone leak check).
        bind: (targets) => {
          targets.disc.visible = false; hemi = targets.hemi; hemiBase = targets.hemi.intensity;
          fogOf = () => targets.fog; fogSun = targets.fogU.fogSunColor.value; fogSunBase.copy(fogSun); // targets.fog is live (the scene's current fog): read per update
          haze = targets.far.uHazeCol.value; hazeBase.copy(haze); fogDist = targets.fogU.fogDistDensity;
        },
        // the dusk deepens with the quest (look/dusk.ts): the key dims and reddens, the sky fill drops
        update: () => {
          sky.setKeyLight(KEY.dir, keyColor.copy(KEY.color).lerp(DEEP_KEY, DUSK.value), KEY.intensity * keyAt(DUSK.value));
          if (hemi) hemi.intensity = hemiBase * fillAt(DUSK.value);
          const late = Math.min(1, Math.max(0, (DUSK.value - 0.2) / 0.5));
          // round 22: the fog keeps the horizon sky's lighter violet-blue at every step (it went toward the near-black DUSK_FOG late)
          fogOf?.().color.set(FOG.color);
          // row 10: the sun-side tint at a third (with the thicker distance fog it lit the far land toward the glow)
          // round 26 (seat B after round 25: D's far ranges, hazed toward the dark fog colour, cut the glow line, 15-17 against
          // 160): the sun-side tint no longer dims late, so the ranges toward the glow take its colour (the late fog is thin)
          fogSun?.copy(fogSunBase).multiplyScalar(0.35 * (1 + 2.5 * late)); // brighter toward the glow as the land darkens (a lift, never toward black; the spawn pair at dusk 0 unchanged)
          // round 21b: the far ranges' haze full at the sunset step (A's ranges 36 against 70) and falling to 15 % by the late
          // waymarks (D's land under the horizon 56 against 17)
          const hz = Math.min(1, Math.max(0, (DUSK.value - 0.55) / 0.3));
          haze?.copy(hazeBase).multiplyScalar(1 - 0.85 * hz * hz * (3 - 2 * hz));
          // round 12 (D: a pale haze strip on the far land under the ranges; the mockup's land there near-black): thinner late
          // E409 second top-10 row 10 (aerial perspective): the engine's exponential distance fog thick enough to carry the far
          // dunes toward its violet-blue (~35 % at 150 m; it was ~3 %, thinned late since round 12 when the haze was lilac and
          // paled D's far land), the same at every dusk step
          // round 21b (seat B after round 20: the haze darkened the far land, A's ranges 36 against 70, blue/red 0.58 against
          // 0.83-0.88): aerial perspective goes toward the horizon sky's violet-blue, lighter; one density at every dusk step
          // round 22 (seats B and C after round 20: the late views' far land 32-55 against the mockups' 16-27, A's at sunset
          // short of its haze): the haze is sunlight scattered in the air, so it thins as the light goes, never thickens:
          // full at the sunset step, a fifth by the blue hour; always toward the same lighter colour, a lift that fades
          const thin = Math.min(1, Math.max(0, (DUSK.value - 0.3) / 0.45));
          if (fogDist) fogDist.value = AERIAL_FOG * (1 - 0.8 * thin * thin * (3 - 2 * thin));
        },
        rebuild: () => undefined, attachPost: () => undefined };
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
      const shadow = bakeDuneShadow((x, z) => skirtAt(gridAt, x, z)); scope.own(shadow);
      const trail = bakeTrail((x, z) => field.trailDistance(x, z)); scope.own(trail);
      const grain = sandGrainTexture(); scope.own(grain);
      const grainMean = Number(grain.userData['meanR']).toFixed(4), glintMean = Number(grain.userData['meanGlint']).toFixed(4);
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
        shader.uniforms['uSandShadow'] = { value: shadow }; shader.uniforms['uSandGrain'] = { value: grain }; shader.uniforms['uSandTrail'] = { value: trail }; shader.uniforms['uDusk'] = DUSK; shader.uniforms['uFireLights'] = FIRE_LIGHTS;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSandPos;\nvarying vec3 vSandN;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSandPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvSandN = normalize(mat3(modelMatrix) * objectNormal);');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vSandPos;
varying vec3 vSandN;
uniform sampler2D uSandShadow;
uniform sampler2D uSandGrain;
uniform sampler2D uSandTrail;
uniform float uDusk;
uniform vec4 uFireLights[4];
// A ripple octave survives while a pixel spans well under one period, at any distance (no fixed fade, no aliasing).
float sandAA(float phase) { return 1.0 - smoothstep(0.5, 1.8, fwidth(phase)); }
float sandH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sandN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sandH(i), sandH(i + vec2(1.0, 0.0)), f.x), mix(sandH(i + vec2(0.0, 1.0)), sandH(i + vec2(1.0, 1.0)), f.x), f.y); }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
  float sandFar = length(vSandPos - cameraPosition);
  // Wind ripples (R3, loop 2): two octaves across the wind (${WIND_GLSL}), bent by slow warps: 0.4 m ripples and 1.6 m
  // megaripples, each kept while the pixel resolves it, so the aerials and the far slopes keep their texture. Slip
  // faces avalanche smooth: the ripples live on the gentle windward faces and the flats.
  vec2 sandW = vec2(${WIND_GLSL});
  float sandU = dot(vSandPos.xz, sandW), sandV = dot(vSandPos.xz, vec2(-sandW.y, sandW.x));
  // a third, slow warp breaks the regular sine moire (the scorer's h3 diagonal)
  float sandWarp = sin(sandV * 0.21) * 1.3 + sin(sandV * 0.053 + sandU * 0.04) * 3.5 + sin(sandU * 0.017 + sandV * 0.11) * 2.2;
  // round 5 (mockup dusk-fire: lumpy broken ripple crests, not sine stripes): the grain tile's mottle, sampled coarse, bends them
  float sandLump = sandN(vec2(sandU * 0.9, sandV * 0.35)) + 0.5 * sandN(vec2(sandU * 2.1, sandV * 0.9) + 7.3);
  float sandPhase = (sandU + sandWarp) * 7.0 + sandLump * 4.5; // E399: ~0.9 m bands (mockup A's near ripples), was 0.4 m
  float sandPhase2 = (sandU * 0.97 + sandWarp * 1.6 + sin(sandV * 0.6) * 0.35 + sin(sandV * 0.13 + sandU * 0.09) * 1.1) * 3.93;
  float sandFlat = smoothstep(0.78, 0.96, normalize(vSandN).y);
  // loop 3: the ripples come in patches (wind-scoured fields and smooth swales), not one even corduroy over every dune
  float sandPatch = clamp(0.5 + 0.6 * sin(sandV * 0.31 + sin(sandU * 0.19) * 1.7) * sin(sandU * 0.27 + sandV * 0.07 + 1.3), 0.12, 1.0);
  sandPatch = max(sandPatch, 0.8 * (1.0 - smoothstep(6.0, 30.0, sandFar))); // E399: always rippled underfoot (mockup A)
  // E407 row 2 (the audit: one strong regular ripple over everything to the horizon is the most "video game" thing in the
  // frame; the mockups' sand is smooth at large scale, rippled only where the wind leaves it): the ripples live on the gentle
  // windward faces and the flats, gone on the slip faces (steeper than ~22 deg) and fading out past ~60 m
  float sandSlip = 1.0 - smoothstep(0.8, 0.9, normalize(vSandN).y);
  float sandFade = (1.0 - 0.9 * sandSlip) * (1.0 - smoothstep(35.0, 110.0, sandFar));
  float sandRip1 = sandAA(sandPhase) * (0.65 + 0.35 * sandFlat) * sandPatch * sandFade, sandRip2 = sandAA(sandPhase2) * sandFlat * (0.4 + 0.6 * sandPatch) * sandFade;
  vec4 sandTex = texture2D(uSandGrain, vSandPos.xz * 0.55);
  // round 2 (R1C-5 / seat B: the trails were soft smears from above): a baked 0.75 m trail mask, trodden darker and smooth
  float sandTrod = texture2D(uSandTrail, (vSandPos.xz + ${GROUND_HALF.toFixed(1)}) / ${(GROUND_HALF * 2).toFixed(1)}).r;
  sandRip1 *= 1.0 - 0.5 * sandTrod; sandRip2 *= 1.0 - 0.5 * sandTrod; // E399: the trail keeps half its ripples (mockup A: rippled to the bottom edge at the spawn)
  // E399 (mockups A, D): fine low-contrast ripples near the camera, the bold stripes only at middle distance
  // round 15 (the lead after round 14: the near ripples twice the mockups' contrast close to the camera, 18.5-19.2 % vs
  // 10 %; the distance fade works): the near amplitude halved, the middle distance as it was
  // round 16 (seat B after round 15: the near ripples match, the middle distance's are 2.3-3.1x the mockups' contrast)
  float sandNear = mix(0.52, 0.26, smoothstep(4.0, 26.0, sandFar)); // E399 (judge: the mockups' near ripples have dark troughs to the bottom edge); round 8: deeper near (A: troughs to ~20, crowns to ~115)
  // round 8 (mockup B: the late sand dim and soft; ours carried bold dark ripple stripes): the ripples' contrast falls with the dusk
  sandNear *= 1.0 - 0.55 * smoothstep(0.2, 0.6, uDusk) - 0.2 * smoothstep(0.6, 0.9, uDusk); // round 11 (R10 8: late ripples too regular and contrasty) // round 9 (seat A: D's near ripples where the mockup's sand is smooth)
  sandRip1 *= sandNear; sandRip2 *= sandNear;
  // E399 (judge, mockup A): the near ripples' troughs read dark (the key runs along the crests, so the bump alone barely shows)
  // round 16 (the lead's hard rule: no shader term may darken by distance from the camera): every term faded by distance is
  // zero-mean, so the fade changes only the detail, never the ground's brightness: the troughs' weighting carries its own
  // mean (0.7 / pi) back, the glints pair with as many dark specks
  diffuseColor.rgb *= 1.0 + 0.62 * (sin(sandPhase) - 0.35 * max(0.0, -sin(sandPhase)) * 2.0 + 0.2228) * sandRip1 + 0.05 * sin(sandPhase2) * sandRip2 + (sandTex.r - ${grainMean}) * 0.3
    + (smoothstep(0.82, 0.95, sandTex.r) - smoothstep(0.82, 0.95, 1.0 - sandTex.r) - ${glintMean}) * 0.9 * (1.0 - smoothstep(3.0, 18.0, sandFar)) // grain glints near the camera (mockup A)
    // a finer grain octave underfoot (round 5: the near sand's fine detail a third of the mockups')
    + (texture2D(uSandGrain, vSandPos.xz * 2.3 + 0.37).r - ${grainMean}) * 1.8 * (1.0 - smoothstep(4.0, 22.0, sandFar))
    + (texture2D(uSandGrain, vSandPos.xz * 0.9 + 0.71).r - ${grainMean}) * 1.3 * (1.0 - smoothstep(6.0, 30.0, sandFar))
    + (texture2D(uSandGrain, vSandPos.xz * 0.28 + 0.13).r - ${grainMean}) * 1.6 * (1.0 - smoothstep(8.0, 40.0, sandFar)); // cm-scale speckle (mockup dusk-fire)
  // round 8 (the council since round 1: the near sand's fine detail half the mockups', 4.5 against 9 on the clean patch; the
  // grain tile's mips smear it): crisp procedural grain clumps in world space, ~1 and ~2 cm cells (the phone frame is
  // ~8 mm a pixel underfoot), each octave kept only while a pixel spans under a cell (no sparkle far off), and a rare
  // bright quartz glint
  {
    vec2 gc = vSandPos.xz * 95.0, gc2 = vSandPos.xz * 48.0 + 17.0;
    float gA = 1.0 - smoothstep(0.8, 1.6, length(fwidth(gc))), gB = 1.0 - smoothstep(0.8, 1.6, length(fwidth(gc2)));
    // the blue hour's sky light models no grain (mockups B-D: smooth soft sand), so the grains fade as the dusk deepens
    float grainDusk = 1.0 - 0.75 * smoothstep(0.2, 0.6, uDusk);
    gA *= grainDusk; gB *= grainDusk;
    float grains = (sandN(gc) - 0.5) * 0.75 * gA + (sandN(gc2) - 0.5) * 0.7 * gB; // round 9: a quarter less (fine 12.6 against the mockups' 9)
    float glint = (step(0.985, sandH(floor(gc2))) - 0.015) * gB * 0.9; // round 17: zero-mean (a hash's 1.5 % over 0.985)
    diffuseColor.rgb *= max(0.2, 1.0 + grains + glint);
  }
  // loop 4, surface variety (the council's baseline: the near sand read as one flat brown): broad tonal drifts (tens of
  // metres) and pale wind-blown streaks running downwind over the windward faces, a finer darker sand in the scours.
  float sandDrift = sin(sandU * 0.045 + sin(sandV * 0.031) * 2.0) * sin(sandV * 0.052 + 1.7) + 0.5 * sin(sandU * 0.11 + sandV * 0.07);
  float sandStreak = smoothstep(0.55, 0.95, sin(sandV * 1.9 + sin(sandU * 0.07) * 3.0) * sin(sandV * 0.37 + 0.6)) * (0.4 + 0.6 * sandFlat);
  // E407 row 2: macro albedo at the dunes' own scale (tens of metres), stronger than the old 8 %: paler wind-swept crests and
  // flats, warmer deeper sand in the hollows (the vertex colours carry the crest / hollow split)
  float sandMacro = sandN(vSandPos.xz * 0.018 + 3.7) * 0.6 + sandN(vSandPos.xz * 0.045 + 9.1) * 0.4;
  diffuseColor.rgb *= mix(vec3(0.9, 0.92, 0.96), vec3(1.1, 1.04, 0.98), sandMacro);
  diffuseColor.rgb *= (1.0 + 0.08 * sandDrift) * mix(0.8, 1.0, smoothstep(0.0, 0.3, uDusk)); // (round 12's B-tuned bell at dusk 0.5 removed: the sand brightened as the sun set) // round 12: the sunset step's sand a step darker (the A / dusk-fire split; the later steps unchanged)
  // check pass (4): the path brightens with distance, so the route reads from above; underfoot it stays a subtle trodden bed
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 1.05, 0.98), sandTrod * 0.6); // a faint trodden bed (E399: brighter read as a light column)
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 1.12, 1.02), sandStreak * 0.55); // round 16: at every distance (the hard rule)`)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    // The ripples' slopes along the wind (a long gentle stoss, a short steep lee) and the grain's bumps, as a
    // world-space tilt of the normal, turned to view space.
    float s1 = (cos(sandPhase) + 0.4 * cos(2.0 * sandPhase)) * mix(0.14, 0.2, smoothstep(4.0, 20.0, sandFar)) * sandRip1; // round 10 (R9B-6): the near ripples' relief less (fine detail 11-12 against 9)
    float s2 = cos(sandPhase2) * 0.05 * sandRip2;
    vec2 sandBump = (sandTex.gb - 0.5) * 0.5 * (1.0 - smoothstep(8.0, 40.0, sandFar));
    // round 8 (the mockups' near grain is lumps lit on one side, not specks of paint, which foreshorten into streaks): the
    // grain clumps' slopes (the colour pass's 1 and 2 cm value noise) tilt the normal, so the grazing key models each one
    vec2 gq = vSandPos.xz * 95.0, gq2 = vSandPos.xz * 48.0 + 17.0;
    float gqDusk = 1.0 - 0.75 * smoothstep(0.2, 0.6, uDusk);
    float gqA = (1.0 - smoothstep(0.8, 1.6, length(fwidth(gq)))) * gqDusk, gqB = (1.0 - smoothstep(0.8, 1.6, length(fwidth(gq2)))) * gqDusk;
    vec2 grainSlope = vec2(sandN(gq + vec2(0.3, 0.0)) - sandN(gq - vec2(0.3, 0.0)), sandN(gq + vec2(0.0, 0.3)) - sandN(gq - vec2(0.0, 0.3))) * 0.85 * gqA
      + vec2(sandN(gq2 + vec2(0.3, 0.0)) - sandN(gq2 - vec2(0.3, 0.0)), sandN(gq2 + vec2(0.0, 0.3)) - sandN(gq2 - vec2(0.0, 0.3))) * 0.7 * gqB;
    vec3 rippleTilt = vec3(sandW.x, 0.0, sandW.y) * (s1 + s2) + vec3(sandBump.x, 0.0, sandBump.y) + vec3(grainSlope.x, 0.0, grainSlope.y);
    normal = normalize(normal - (viewMatrix * vec4(rippleTilt, 0.0)).xyz);
  }`)
          .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  // The baked dune shadow (a ${String(SHADOW_TEX)}² map, sharpened) takes only the key (direct) light; the cool sky fill stays.
  float sandVis = smoothstep(0.25, 0.75, texture2D(uSandShadow, (vSandPos.xz + ${SHADOW_HALF.toFixed(1)}) / ${(SHADOW_HALF * 2).toFixed(1)}).r);
  sandVis = max(sandVis, smoothstep(${(SHADOW_HALF - 8).toFixed(1)}, ${SHADOW_HALF.toFixed(1)}, max(abs(vSandPos.x), abs(vSandPos.z)))); // round 4: the stepped strip past the map
  reflectedLight.directDiffuse *= mix(0.28, 1.0, sandVis); // E407 row 3: long dune shadows across the troughs, deeper (0.45) // round 7: the map's cast edge ran straight along its axis; N.L draws the curve
  {
    // round 10 (seat C round 9: the broad mound shades as one soft wedge; the mockups' light/shade lines are crisp along the
    // forms): the key's response on the terrain's own normal a short ramp at the terminator and a flatter lit side
    // (0.12 + 0.88 N.L past the ramp, against plain Lambert), so the line between lit and shaded faces reads sharp
    float tN = max(dot(normalize(vSandN), vec3(${KEY.dir.x.toFixed(3)}, ${KEY.dir.y.toFixed(3)}, ${KEY.dir.z.toFixed(3)})), 0.0);
    reflectedLight.directDiffuse *= smoothstep(0.0, 0.045, tN) * mix((0.12 + 0.88 * tN) * 0.63, 0.27 * pow(tN / 0.35, 1.6), smoothstep(0.3, 0.5, length(normalize(vSandN).xz))) / max(tN, 0.02); // round 26 (seat B after round 25: the steeper curve brightened the gentle near ground too, A 97 / 68): steep faces only (over ~18-30 deg), the gentle ground keeps round 24's // round 25 (seats B and C: flat near sand 75-88 against 56-68, the lit faces pale): the same at a face turned to the key (tN 0.35), ~40 % less on flat sand (0.2) // round 11 (R10B-2: the near field over both mockups, dusk-fire 82.5 / 73.8); round 12: the spawn mockups disagree by 16 on the same ground (A 57, dusk-fire 74), so split them (lead: A 78 the biggest measured gap)
  }
  // round 6 (seat C: the mean is right, the contrast must come from darker shade AND brighter crests): faces grazing the key
  float sandGraze = dot(normalize(vSandN), vec3(${KEY.dir.x.toFixed(3)}, ${KEY.dir.y.toFixed(3)}, ${KEY.dir.z.toFixed(3)}));
  reflectedLight.directDiffuse *= 1.0 + 0.9 * smoothstep(0.0, 0.08, sandGraze) * (1.0 - smoothstep(0.1, 0.22, sandGraze)) * sandVis; // the crest band only // the key mostly gone in cast shade; the fill below keeps it violet-brown (round 4: black slabs)
  reflectedLight.directSpecular *= sandVis;
  {
    // E407 row 2: a grazing-light sheen, sand seen at a low angle on a lit face brightens (fine grains catch the low sun)
    float sheenV = 1.0 - saturate(dot(normalize(vSandN), normalize(cameraPosition - vSandPos)));
    // round 17 (seat B, R15B-2: at grazing toward the key the sheen paled the far faces): only where the sun is behind or
    // beside the viewer
    vec3 sheenToCam = normalize(cameraPosition - vSandPos);
    float sheenSide = smoothstep(-0.2, 0.4, dot(normalize(vec2(${KEY.dir.x.toFixed(3)}, ${KEY.dir.z.toFixed(3)})), normalize(sheenToCam.xz + vec2(1e-4))));
    reflectedLight.directDiffuse *= 1.0 + 0.35 * pow(sheenV, 4.0) * sandVis * sheenSide;
  }
  // Round 1 (R1C-3): where the key doesn't reach (cast shadow or a face turned from it) the sky fill paints the bible's
  // cool violet shade (#4a3a48 to #5b4f6a), not a darkened orange: the crest line splits warm from cool.
  float sandKeyN = dot(normalize(vSandN), vec3(${KEY.dir.x.toFixed(3)}, ${KEY.dir.y.toFixed(3)}, ${KEY.dir.z.toFixed(3)}));
  float sandShade = 1.0 - smoothstep(0.0, 0.14, sandKeyN) * sandVis;
  // E399 (council round 2, R2B-1): the shade keeps the sand's own hue (a grey luminance fill read as flat pink-grey)
  vec3 sandFill = reflectedLight.indirectDiffuse;
  // loop 6 (the scorer: shade went muddy purple-black, ripples vanished in it): a cool blue-grey fill, a step brighter,
  // and the ripples and grain shade the sky light too, so they read in shadow as they do in the targets
  reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, sandFill * mix(vec3(0.95, 0.9, 1.3), vec3(0.95, 0.85, 0.9), uDusk) * mix(1.05, 1.15, uDusk) + vec3(0.016, 0.013, 0.02) * sandShade * (1.0 - uDusk), sandShade * 0.9); // the dusk's shade a warm brown, never blue-black (R2B-1) // the mockups' shade: cool mid-tone, ripples readable // loop 6: navy shade (the targets)
  // the dusk's lavender sky floor (R2B-1: the late views' sand measures dim warm brown-violet, not black or pure orange)
  reflectedLight.indirectDiffuse += uDusk * vec3(0.013, 0.008, 0.009) + smoothstep(0.15, 0.5, uDusk) * vec3(0.006, 0.004, 0.003); // round 8: the key from behind the tower backlights the late views (B, D measured a third under their mockups)
  // round 8 (mockup C: the waymark's fire lights the sand orange out to the camera; ours stopped at its 6 m pool, the near
  // sand 20 against the mockup's 32): each burning fire (and the caravan's lantern, at its share) lights the sand round it
  for (int i = 0; i < 4; i++) {
    float fireD = length(vSandPos - uFireLights[i].xyz);
    // round 23 (seats B and C after round 21: B's lantern pool pink, h356, where the mockup warms the sand amber): a lamp
    // (a fraction of a fire's gain) lights amber, a fire orange
    reflectedLight.indirectDiffuse += diffuseColor.rgb * mix(vec3(1.0, 0.72, 0.32), vec3(1.0, 0.42, 0.14), step(0.5, uFireLights[i].w)) * uFireLights[i].w * pow(max(0.0, 1.0 - fireD / 10.0), 3.0) * 0.17; // round 24 (seat C: the pool right-sized, the ground past it 49 against 34): a tighter falloff
  }
  {
    // round 10 (R9B-2: mockups B, C and D put near-black land under the glow, 13-19 against our 47-74, the far land darker
    // than the near): in the late dusk the far dunes fall toward silhouette with distance
    // round 11 (round 10's ledger note: a fade to black from 8 m flattened D's bands and the late clip's ground): the sky fill
    // only, from 30 m, so the key's bands still read on the far land
    // round 12 (seat C R11-2: D's late land lit rising slopes; the mockup's flat dark bands with one lit stripe): in the late
    // dusk the faces turned from the afterglow fall dark, the faces toward it (the crests' far sides) keep their light
    vec2 glowXZ = normalize(vec2(${SUN_GLOW.x.toFixed(3)}, ${SUN_GLOW.z.toFixed(3)}));
    float toGlow = dot(normalize(vSandN).xz, glowXZ);
    // (no distance gate: the lead after round 12, the clip's ground fell to 6-9 with black blots at the gate)
    // a tilted face only (flat sand has no facing; ungated, the near flats went dark too: B 26 / 39.7)
    // round 14 (the lead: it cut flat ground ~40 %, C's near sand 18 / 33): clearly turned away (toGlow < -0.1) and clearly tilted (> ~12 deg) only
    float away = smoothstep(0.3, 0.85, uDusk) * (1.0 - smoothstep(-0.45, -0.05, toGlow)) * smoothstep(0.08, 0.3, length(normalize(vSandN).xz)); // round 15 (the lead: hard-edged dark ovals on the dune faces in the clip): windows widened; round 17 (seat C: round 15's reached faces toward the glow and nearly flat ground): back near round 14's, still soft
    // round 23 (TOP10-3 row 2: D's land a smooth 39-46 where its mockup alternates troughs 13-20 with lit rims 54-60): the
    // faces turned from the afterglow fall to a quarter, from gentler slopes (the flat crests and rims keep their light)
    // round 24 (seats B and C after round 23: x0.25 put 21 % of D's land under luma 8, near-black blots in the late clip,
    // p5 3.4 against round 22's 16.4): darker troughs, not black, x0.45
    reflectedLight.indirectDiffuse *= 1.0 - 0.55 * away; reflectedLight.directDiffuse *= 1.0 - 0.55 * away;
    // (round 15's late far-land darkening by distance from the camera is gone: the lead's hard rule after round 15, darkening
    // comes from facing, height, occlusion or the engine fog only)
  }
  {
    // E409 second top-10 row 1 (seat B after round 17: in the mockups the sand's saturation rises with its light, a
    // violet-grey shade at 0.21-0.31 and an orange light at 0.57-0.69; the game's sat flat near 0.45-0.55): the amber key's
    // light saturated, the sky fill desaturated and cooled toward violet-grey
    vec3 W3 = vec3(0.2126, 0.7152, 0.0722);
    float dL = dot(reflectedLight.directDiffuse, W3), iL = dot(reflectedLight.indirectDiffuse, W3);
    // round 23 (seats B and C after round 21: B's lantern pool pink, h356-3, the lit sand red where the mockups' is gold,
    // h15-22): 1.6, not 2.5 (scaling about the luma drags every warm light toward red: at 2.5 the lantern pool came out h3,
    // dusk-fire's lit sand h16; unboosted, h12 / h24 and A's h26 against 21)
    // round 25 (seats B and C after round 24: the dusk-ramped 2.5 boost reddened the shade and the mid-tones, the lit faces
    // palest): the direct light saturated by how squarely the face takes the key, never by the dusk (flat sand and the
    // lantern's pool 1.2, a face turned into the key 2.2)
    reflectedLight.directDiffuse = max(mix(vec3(dL), reflectedLight.directDiffuse, 1.2 + 1.0 * smoothstep(0.2, 0.45, sandKeyN)), vec3(0.0));
    reflectedLight.indirectDiffuse = mix(vec3(iL) * vec3(0.9, 0.9, 1.28), reflectedLight.indirectDiffuse, 0.4); // round 19 (seat B: the shade measured A 0.45 against 0.31)
  }
  reflectedLight.indirectDiffuse *= 1.0 + (0.5 * sin(sandPhase) * sandRip1 + 0.07 * sin(sandPhase2) * sandRip2) * sandShade + (sandTex.r - 0.5) * 0.18;`);
      }, { scope });
      const mesh = new Mesh(geometry, material); mesh.receiveShadow = false;
      terrain.group.add(mesh); terrain.mesh = mesh; terrain.material = material;
      // Round 1 (R1C-5 / R1B-14): the dune sea runs on past the square to the buttes (from above the ground ended in a
      // ruler-straight edge over nothing). A coarse skirt, its inner edge on the ground's own edge heights, easing out into
      // gentle swells along the wind; the same sand material, so the fog lays it back with the rest.
      const skirt = skirtGeometry((x, z) => field.heightAt(x, z)); scope.own(skirt);
      const skirtMesh = new Mesh(skirt, material); skirtMesh.receiveShadow = false; terrain.group.add(skirtMesh);
      holdSkirt(skirtMesh, (half) => skirtGeometry((x, z) => field.heightAt(x, z), half), scope); // G99: cut back to the cube in a grid cell
      return Promise.resolve();
    } },
  };
}
