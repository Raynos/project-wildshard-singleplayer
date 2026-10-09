import { DUSK, fillAt, keyAt } from './dusk';
import { BackSide, ClampToEdgeWrapping, Color, DataTexture, Float32BufferAttribute, Fog, LinearFilter, LinearMipmapLinearFilter, Mesh, PlaneGeometry, RedFormat, RepeatWrapping, RGBAFormat, ShaderMaterial, SphereGeometry, UnsignedByteType, Vector3, type BufferGeometry, type HemisphereLight, type Material, type Texture } from 'three';
import type { LookStrategy, PainterField } from '@wildshard/engine/render/look';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { GROUND_HALF, SEED, TRAIL } from '../layout';
import { duneHeight, WIND } from '../world/dunes';
import { FIRE_LIGHTS } from '../world/fireFx';
import { SKY_FRAGMENT, SKY_VERTEX, SUN_GLOW } from './sky';
import { loadPaintedSky } from './painted';
import { familySand, familySky, SHADOW_HALF, type FamilySand, type FamilySky } from './families';
import { Scope } from '@wildshard/engine/app/scope';
import { holdSkirt } from './cube';
import { buildTerrain } from '@wildshard/engine/world/terrainField';
import type { Terrain } from '@wildshard/engine/world/Terrain';
import { bindSandTiles, groundTiles } from './groundTiles';

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

/** The baked dune-shadow map's size and reach (E407 row 3: it covered only the 480 m ground; the far skirt's dunes, out to
 *  the range rings, cast no shade): 896 texels a side over +-520 m, 1.16 m a texel. */
const SHADOW_TEX = 896;

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

/** The sand's hollow / crest tint at one vertex (round 1): its height `h` against the mean of a 14 m ring around it. */
function sandTint(heightAt: (x: number, z: number) => number, x: number, z: number, h: number, c: Color): Color {
  const mean = (heightAt(x + 14, z) + heightAt(x - 14, z) + heightAt(x, z + 14) + heightAt(x, z - 14)) / 4;
  const rel = Math.max(-1, Math.min(1, (h - mean) / 2.5));
  c.copy(SAND); if (rel < 0) c.lerp(HOLLOW, -rel * 0.75); else c.lerp(CREST, rel * 0.6);
  return c;
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
  const dome = new Mesh<SphereGeometry, Material>(new SphereGeometry(120, 48, 24), new ShaderMaterial({ side: BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { uSun: { value: SUN_GLOW.clone() }, uDusk: DUSK }, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT }));
  dome.renderOrder = -1000; dome.frustumCulled = false;
  // E409 second top-10 row 2: the painted dusk skies replace the procedural dome once they load (the backdrop); freed with the look
  let painted: { scope: Scope; sky: FamilySky; textures: readonly Texture[] } | null = null;
  // the sand's family material once the terrain painter built it (its adapter is fed in the backdrop's update)
  let sand: FamilySand | null = null;
  /**
   * M3 tiles-swap (G227, E435): the same sand over the compiled shardfile terrain tiles (`look/groundTiles.ts`): the baked
   * maps from the same 257-sample grid of the field as the code-built mesh (so the dune shadows and the trail bed are the
   * same texels), the tiles in place of that mesh, the skirt as before, and the ground's queries and collider from the
   * tiles' collider.
   */
  const buildTiledSand = async (terrain: Terrain, field: PainterField, scope: Scope): Promise<void> => {
    const segments = 256, side = segments + 1, cell = (GROUND_HALF * 2) / segments, heights = new Float32Array(side * side);
    for (let iz = 0; iz < side; iz++) for (let ix = 0; ix < side; ix++) heights[iz * side + ix] = field.heightAt(ix * cell - GROUND_HALF, iz * cell - GROUND_HALF);
    const gridAt = (x: number, z: number): number => {
      const fx = Math.min(segments - 1e-3, Math.max(0, (x + GROUND_HALF) / cell)), fz = Math.min(segments - 1e-3, Math.max(0, (z + GROUND_HALF) / cell));
      const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, w = fz - iz, at = (a: number, b: number): number => heights[b * side + a] ?? 0;
      return (at(ix, iz) * (1 - u) + at(ix + 1, iz) * u) * (1 - w) + (at(ix, iz + 1) * (1 - u) + at(ix + 1, iz + 1) * u) * w;
    };
    const shadow = bakeDuneShadow((x, z) => skirtAt(gridAt, x, z)); scope.own(shadow);
    const trail = bakeTrail((x, z) => field.trailDistance(x, z)); scope.own(trail);
    const grain = sandGrainTexture(); scope.own(grain);
    const familyGround = familySand({ grain, trail, shadow }, DUSK.value, scope); sand = familyGround;
    scope.onDispose(() => { if (sand === familyGround) sand = null; });
    const material = familyGround.material; terrain.material = material;
    // the skirt and the tint's ring mean read the analytic field (the code-built mesh's), never the collider the ground binds
    const analytic = buildTerrain(SEED, { landscape: duneHeight, trails: TRAIL, cabinSites: [] }), c = new Color();
    const skirt = skirtGeometry(analytic.heightAt); scope.own(skirt);
    const skirtMesh = new Mesh(skirt, material); skirtMesh.receiveShadow = false; terrain.group.add(skirtMesh);
    await bindSandTiles(terrain, field, material, (x, z, h, out, at) => {
      sandTint(analytic.heightAt, x, z, h, c); out[at] = c.r; out[at + 1] = c.g; out[at + 2] = c.b;
    }, scope);
    holdSkirt(skirtMesh, (half) => skirtGeometry(analytic.heightAt, half), scope); // G99: cut back to the cube in a grid cell
  };
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
        if (painted) { painted.scope.dispose(); for (const t of painted.textures) t.dispose(); painted = null; }
      });
      return { chain };
    },
    // No sun disc or halo (G25): the sun has just set; the dome paints the afterglow.
    sky: { clouds: false, planet: false, sun: { disc: false, halo: false } },
    backdrop: async ({ sky }) => {
      const stages = await loadPaintedSky();
      if (stages) {
        // SF50 / SF10a (A10): the emissive family's sky over the two painted stages; the dusk is its look's blend
        const procedural = dome.material, skyScope = new Scope('sunscar-dunes.sky'), family = familySky(stages, DUSK.value, skyScope);
        dome.material = family.material; procedural.dispose(); painted = { scope: skyScope, sky: family, textures: stages };
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
          painted?.sky.update(DUSK.value);
          sand?.update(DUSK.value, FIRE_LIGHTS.value);
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
      // M3 tiles-swap (default off: the groundTiles Developer tool, look/groundTiles.ts): the compiled shardfile tiles instead of this mesh
      if (groundTiles()) return buildTiledSand(terrain, field, scope);
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
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i);
        // Hollow vs crest: this vertex against the mean of a 14 m ring around it.
        sandTint((hx, hz) => field.heightAt(hx, hz), x, z, h, c);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      // SF50 / SF10a (A10): the PBR family's ground layer over the baked maps; the dusk and the fires move it (backdrop update)
      const familyGround = familySand({ grain, trail, shadow }, DUSK.value, scope); sand = familyGround;
      scope.onDispose(() => { if (sand === familyGround) sand = null; });
      const material = familyGround.material;
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
