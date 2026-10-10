import { DUSK, fillAt, keyAt } from './dusk';
import { curveAt } from '@wildshard/sdk/looks/duskCurves';
import { AERIAL_FOG, FAR_HAZE, FOG_SUN } from '../data/dusk';
import { Color, Fog, Mesh, SphereGeometry, Vector3, type DataTexture, type HemisphereLight, type Material, type Texture } from 'three';
import type { LookStrategy, PainterField } from '@wildshard/engine/render/look';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { SEED, SPAWN, TRAIL } from '../data/layout';
import { duneHeight } from '../world/dunes';
import { FIRE_LIGHTS } from '../world/fireFx';
import { duskDomeMaterial } from '@wildshard/sdk/looks/duskDome';
import { SKY_STYLE } from '../data/sky';
import { loadPaintedSky } from './painted';
import { familySand, familySky, type FamilySand, type FamilySky } from './families';
import { KEY_DIR, SAND_MAPS, SKIRT_GRID, SKIRT_SWELL } from '../data/sand';
import sandMeans from '../data/sand.json' with { type: 'json' };
import { Scope } from '@wildshard/engine/app/scope';
import { buildTerrain } from '@wildshard/engine/world/terrainField';
import type { Terrain } from '@wildshard/engine/world/Terrain';
import { CubeSkirt, loadBakedMaps, skirtGrid, TintedTileGround } from '@wildshard/sdk/looks/bakedGround';
import source from '../shard.config';

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
export const KEY = { dir: new Vector3(...KEY_DIR).normalize(), color: new Color(1, 0.68, 0.34), intensity: 1.85 } as const; // E399 (R2B-1): measured against the mockups' ground patches, not eyeballed // loop 5 targets: saturated lit faces, deep shade
/** Violet aerial perspective: far dune rows cool and lift into layers (R9), never pink. */
/** The key's colour at the blue hour (look/dusk.ts): a low red ember of the set sun. */
const DEEP_KEY = new Color(0.78, 0.42, 0.4);
// round 22 (the lead after round 21: the light band's 0x5e5288 turned A's mid dunes and D's far land milky lilac): the
// horizon's darker violet near the ground
export const FOG = { color: 0x3e3452, near: 80, far: 430 } as const;
// loop 6: lit sand a gold-orange, less saturated and a little lighter than loop 5 (the targets' lit faces)
// E399 (council round 2, R2B-1: the mockups' ground measures warm brown, R/B ~3): less blue in every tone
const SAND = new Color(0.5, 0.23, 0.075),
  HOLLOW = new Color(0.22, 0.14, 0.12), CREST = new Color(0.64, 0.33, 0.1);
/**
 * The sand's three baked maps (SF72, `generators/sand.ts` → `scripts/bake-signal-sand.mjs`, uploaded from data/sand.ts
 * SAND_MAPS): the dune-shadow map (R1, E407 row 3), the trail mask (round 2) and the grain tile (loop 2; R albedo, G / B
 * its bump slope). A map that fails to load is a page fault: the sand draws without it (fully lit, no trail, flat grain).
 */
export async function loadSandMaps(): Promise<Record<'shadow' | 'trail' | 'grain', DataTexture>> {
  const maps = await loadBakedMaps(SAND_MAPS, '[sunscar-dunes] the baked sand map did not load:');
  // round 17: the shader subtracts the tile's own means, so every distance-faded grain term is zero-mean
  maps.grain.userData['meanR'] = sandMeans.meanR; maps.grain.userData['meanGlint'] = sandMeans.meanGlint;
  return maps;
}
/** The sand's tiles (G227 M3; the only ground since Jake's G266), their fine ring following the player past 8 m. */
export const SAND_TILES = new TintedTileGround({ source, x: SPAWN.x, z: SPAWN.z, follow: 8, name: 'Signal Dunes', tag: 'sunscar-dunes' });
/** The skirt, held so the plugin can cut it back to a grid cell's cube (G99). */
export const SKIRT = new CubeSkirt();

/** The sand's hollow / crest tint at one vertex (round 1): its height `h` against the mean of a 14 m ring around it. */
function sandTint(heightAt: (x: number, z: number) => number, x: number, z: number, h: number, c: Color): Color {
  const mean = (heightAt(x + 14, z) + heightAt(x - 14, z) + heightAt(x, z + 14) + heightAt(x, z - 14)) / 4;
  const rel = Math.max(-1, Math.min(1, (h - mean) / 2.5));
  c.copy(SAND); if (rel < 0) c.lerp(HOLLOW, -rel * 0.75); else c.lerp(CREST, rel * 0.6);
  return c;
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
  const dome = new Mesh<SphereGeometry, Material>(new SphereGeometry(120, 48, 24), duskDomeMaterial(SKY_STYLE, DUSK)); // data/sky.ts
  dome.renderOrder = -1000; dome.frustumCulled = false;
  // E409 second top-10 row 2: the painted dusk skies replace the procedural dome once they load (the backdrop); freed with the look
  let painted: { scope: Scope; sky: FamilySky; textures: readonly Texture[] } | null = null;
  // the sand's family material once the terrain painter built it (its adapter is fed in the backdrop's update)
  let sand: FamilySand | null = null;
  /**
   * The sand over the compiled shardfile terrain tiles (`SAND_TILES`; G227 M3 tiles-swap, the only ground since
   * Jake's G266): the baked dune-shadow and trail maps from a 257-sample grid of the field (the dune shadows and the trail
   * bed at 1.95 m), the tiles as the ground, the skirt round them, and the ground's queries and collider from the tiles'
   * collider.
   */
  const buildSand = async (terrain: Terrain, field: PainterField, scope: Scope): Promise<void> => {
    const { shadow, trail, grain } = await loadSandMaps(); scope.own(shadow); scope.own(trail); scope.own(grain);
    const familyGround = familySand({ grain, trail, shadow }, DUSK.value, scope); sand = familyGround;
    scope.onDispose(() => { if (sand === familyGround) sand = null; });
    const material = familyGround.material; terrain.material = material;
    // the skirt and the tint's ring mean read the analytic field (the code-built mesh's), never the collider the ground binds
    const analytic = buildTerrain(SEED, { landscape: duneHeight, trails: TRAIL, cabinSites: [] }), c = new Color();
    const skirtColour = new Color().copy(SAND).lerp(HOLLOW, 0.25), skirt = skirtGrid(SKIRT_GRID, SKIRT_SWELL, analytic.heightAt, skirtColour); scope.own(skirt);
    const skirtMesh = new Mesh(skirt, material); skirtMesh.receiveShadow = false; terrain.group.add(skirtMesh);
    await SAND_TILES.bind(terrain, field, material, (x, z, h, out, at) => {
      sandTint(analytic.heightAt, x, z, h, c); out[at] = c.r; out[at + 1] = c.g; out[at + 2] = c.b;
    }, scope);
    SKIRT.hold(skirtMesh, (half) => skirtGrid(SKIRT_GRID, SKIRT_SWELL, analytic.heightAt, skirtColour, half), scope); // G99: cut back to the cube in a grid cell
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
          // round 22: the fog keeps the horizon sky's lighter violet-blue at every step; the sun-side tint, the far ranges' haze
          // and the aerial fog follow their dusk curves (data/dusk.ts)
          fogOf?.().color.set(FOG.color);
          fogSun?.copy(fogSunBase).multiplyScalar(curveAt(FOG_SUN, DUSK.value));
          haze?.copy(hazeBase).multiplyScalar(curveAt(FAR_HAZE, DUSK.value));
          if (fogDist) fogDist.value = curveAt(AERIAL_FOG, DUSK.value);
        },
        rebuild: () => undefined, attachPost: () => undefined };
    },
    terrainPainter: { build: buildSand },
  };
}
