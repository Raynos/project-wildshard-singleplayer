import { Color, Fog, Mesh, SphereGeometry, Vector3, type DataTexture, type HemisphereLight, type Material, type Texture } from 'three';
import type { LookStrategy, PainterField } from '@wildshard/engine/render/look';
import { Scope } from '@wildshard/engine/app/scope';
import { DayCycle, type DayCycleSpec } from '@wildshard/engine/world/dayCycle';
import type { Terrain } from '@wildshard/engine/world/Terrain';
import type { GroundPool } from '@wildshard/engine/render/families/ground';
import { curveAt, type DuskCurve } from './duskCurves';
import { duskDomeMaterial, duskDomeSun, type DuskDomeStyle } from './duskDome';
import { duskSand, duskSky, type DuskSand, type DuskSandRow, type DuskSky, type DuskSkyRow } from './duskFamilies';
import { loadPaintedStrips } from './paintedStrips';
import { loadBakedMaps, skirtGrid, type BakedMapRow, type CubeSkirt, type SkirtGridRow, type SwellSkirtRow, type TintedTileGround } from './bakedGround';

type Rgb = readonly [number, number, number];

/** A dusk look's sand tint: a vertex's height against its `ring` m ring mean, over `span` m, lerps the sand toward the
 *  hollow (× `hollowGain`) or the crest (× `crestGain`); the skirt is the sand `skirtHollow` toward the hollow. */
export interface DuskTintRow { readonly sand: Rgb; readonly hollow: Rgb; readonly crest: Rgb; readonly ring: number; readonly span: number; readonly hollowGain: number; readonly crestGain: number; readonly skirtHollow: number }

/**
 * One dusk look as data (SHARD-PLATFORM M3, Signal Dunes' "Last Light"): the scene fog, the key light (direction, colour,
 * its colour at the deepest dusk, intensity), the held day clock, the dusk curves of the key, the sky fill, the fog's sun
 * tint, the far rings' haze and the aerial fog, the sand tint, the skirt, the procedural dome, the sand and sky family rows
 * and the painted sky stages that replace the dome once they load.
 */
export interface DuskLookRow {
  readonly fog: { readonly color: number; readonly near: number; readonly far: number };
  readonly key: { readonly dir: Rgb; readonly color: Rgb; readonly deep: Rgb; readonly intensity: number };
  readonly clock: DayCycleSpec;
  readonly curves: { readonly key: DuskCurve; readonly fill: DuskCurve; readonly fogSun: DuskCurve; readonly farHaze: DuskCurve; readonly aerialFog: DuskCurve };
  readonly tint: DuskTintRow;
  readonly skirt: { readonly grid: SkirtGridRow; readonly swell: SwellSkirtRow };
  readonly dome: DuskDomeStyle;
  readonly sand: DuskSandRow;
  readonly sky: DuskSkyRow;
  readonly painted: { readonly stages: readonly string[]; readonly urls: Readonly<Record<string, string>>; readonly tag: string; readonly fault: string; readonly scope: string };
}

/** The sand's three baked maps a dusk look draws with. */
export type DuskSandMaps = Record<'shadow' | 'trail' | 'grain', DataTexture>;

/** What a dusk look reads live: the quest's dusk and the fires' light uniforms, the sand's wind, the analytic field (built
 *  when the ground is), the baked sand maps, the tile ground and the held skirt. */
export interface DuskLookParts {
  readonly dusk: { readonly value: number };
  readonly fires: { readonly value: readonly GroundPool[] };
  readonly wind: { readonly x: number; readonly z: number };
  readonly field: () => (x: number, z: number) => number;
  readonly maps: () => Promise<DuskSandMaps>;
  readonly tiles: TintedTileGround;
  readonly skirt: CubeSkirt;
}

/**
 * A dusk look's sand maps (the dune-shadow map, the trail mask and the grain tile; R albedo, G / B its bump slope), the
 * grain tile carrying its own means so every distance-faded grain term is zero-mean. A map that fails to load is a page
 * fault: the sand draws without it.
 */
export async function loadDuskSandMaps(rows: Readonly<Record<'shadow' | 'trail' | 'grain', BakedMapRow>>, means: { readonly meanR: number; readonly meanGlint: number }, fault: string): Promise<DuskSandMaps> {
  const maps = await loadBakedMaps(rows, fault);
  maps.grain.userData['meanR'] = means.meanR; maps.grain.userData['meanGlint'] = means.meanGlint;
  return maps;
}

/** The sand's hollow / crest tint at one vertex: its height `h` against its ring's mean. */
function sandTint(row: DuskTintRow, tones: { sand: Color; hollow: Color; crest: Color }, heightAt: (x: number, z: number) => number, x: number, z: number, h: number, c: Color): Color {
  const { ring, span, hollowGain, crestGain } = row;
  const mean = (heightAt(x + ring, z) + heightAt(x - ring, z) + heightAt(x, z + ring) + heightAt(x, z - ring)) / 4;
  const rel = Math.max(-1, Math.min(1, (h - mean) / span));
  c.copy(tones.sand); if (rel < 0) c.lerp(tones.hollow, -rel * hollowGain); else c.lerp(tones.crest, rel * crestGain);
  return c;
}

/**
 * A dusk look (`extend`): the engine's clean chain, a dusk dome (replaced by the painted sky family once its stages
 * load), the scene's fog edited in place, a low key light that dims and deepens with the dusk, the sky fill, the fog's sun
 * tint, the far rings' haze and the aerial fog on their curves, and the sand family over the tile ground with its skirt
 * (cut back to a grid cell's cube through `parts.skirt`), tinted by height against its ring.
 */
export function duskLook(row: DuskLookRow, parts: DuskLookParts): LookStrategy {
  const key = { dir: new Vector3(...row.key.dir).normalize(), color: new Color(...row.key.color), intensity: row.key.intensity }, deepKey = new Color(...row.key.deep);
  const tones = { sand: new Color(...row.tint.sand), hollow: new Color(...row.tint.hollow), crest: new Color(...row.tint.crest) };
  const site = { wind: parts.wind, glow: duskDomeSun(row.dome) }, dusk = parts.dusk;
  // 120 m: the dome draws first with no depth test, so its size never occludes; at 300 m the far plane clipped it (an arc)
  const dome = new Mesh<SphereGeometry, Material>(new SphereGeometry(120, 48, 24), duskDomeMaterial(row.dome, dusk));
  dome.renderOrder = -1000; dome.frustumCulled = false;
  let painted: { scope: Scope; sky: DuskSky; textures: readonly Texture[] } | null = null;
  let sand: DuskSand | null = null;
  const buildSand = async (terrain: Terrain, field: PainterField, scope: Scope): Promise<void> => {
    const { shadow, trail, grain } = await parts.maps(); scope.own(shadow); scope.own(trail); scope.own(grain);
    const familyGround = duskSand(row.sand, { grain, trail, shadow }, site, dusk.value, scope); sand = familyGround;
    scope.onDispose(() => { if (sand === familyGround) sand = null; });
    const material = familyGround.material; terrain.material = material;
    // the skirt and the tint's ring mean read the analytic field (the code-built mesh's), never the collider the ground binds
    const heightAt = parts.field(), c = new Color(), { grid, swell } = row.skirt;
    const skirtColour = new Color().copy(tones.sand).lerp(tones.hollow, row.tint.skirtHollow), skirt = skirtGrid(grid, swell, heightAt, skirtColour); scope.own(skirt);
    const skirtMesh = new Mesh(skirt, material); skirtMesh.receiveShadow = false; terrain.group.add(skirtMesh);
    await parts.tiles.bind(terrain, field, material, (x, z, h, out, at) => {
      sandTint(row.tint, tones, heightAt, x, z, h, c); out[at] = c.r; out[at + 1] = c.g; out[at + 2] = c.b;
    }, scope);
    parts.skirt.hold(skirtMesh, (half) => skirtGrid(grid, swell, heightAt, skirtColour, half), scope);
  };
  const fog = row.fog;
  return { mode: 'extend',
    compose: ({ engineChain, scene, scope }) => {
      // the scene's own fog is edited in place: a new Fog would orphan the one the backdrop bound
      if (scene.fog instanceof Fog) { scene.fog.color.set(fog.color); scene.fog.near = fog.near; scene.fog.far = fog.far; }
      else scene.fog = new Fog(new Color(fog.color), fog.near, fog.far);
      const chain = engineChain('clean');
      scope.own(dome.geometry); scope.own(dome.material);
      scope.onDispose(() => {
        dome.removeFromParent(); scene.fog = null;
        if (painted) { painted.scope.dispose(); for (const t of painted.textures) t.dispose(); painted = null; }
      });
      return { chain };
    },
    // No sun disc or halo: the sun has just set; the dome paints the afterglow.
    sky: { clouds: false, planet: false, sun: { disc: false, halo: false } },
    backdrop: async ({ sky }) => {
      const strips = await loadPaintedStrips(row.painted.stages, row.painted.urls, row.painted.tag, row.painted.fault);
      const stages = strips?.[0] !== undefined && strips[1] !== undefined ? [strips[0], strips[1]] as const : null;
      if (stages) {
        const procedural = dome.material, skyScope = new Scope(row.painted.scope), family = duskSky(row.sky, stages, dusk.value, skyScope);
        dome.material = family.material; procedural.dispose(); painted = { scope: skyScope, sky: family, textures: stages };
      }
      const clock = new DayCycle(row.clock), keyColor = new Color();
      let hemi: HemisphereLight | null = null, hemiBase = 1;
      let fogOf: (() => Fog) | null = null, fogSun: Color | null = null, haze: Color | null = null, fogDist: { value: number } | null = null;
      const fogSunBase = new Color(), hazeBase = new Color(), curves = row.curves;
      return { clock, horizon: new Color(fog.color), lut: null, clouds: dome,
        // Hide the disc mesh too: `sun.disc: false` only hides its material, and three still uploads the geometry of a
        // visible mesh whose material is hidden.
        bind: (targets) => {
          targets.disc.visible = false; hemi = targets.hemi; hemiBase = targets.hemi.intensity;
          fogOf = () => targets.fog; fogSun = targets.fogU.fogSunColor.value; fogSunBase.copy(fogSun);
          haze = targets.far.uHazeCol.value; hazeBase.copy(haze); fogDist = targets.fogU.fogDistDensity;
        },
        update: () => {
          sky.setKeyLight(key.dir, keyColor.copy(key.color).lerp(deepKey, dusk.value), key.intensity * curveAt(curves.key, dusk.value));
          painted?.sky.update(dusk.value);
          sand?.update(dusk.value, parts.fires.value);
          if (hemi) hemi.intensity = hemiBase * curveAt(curves.fill, dusk.value);
          fogOf?.().color.set(fog.color);
          fogSun?.copy(fogSunBase).multiplyScalar(curveAt(curves.fogSun, dusk.value));
          haze?.copy(hazeBase).multiplyScalar(curveAt(curves.farHaze, dusk.value));
          if (fogDist) fogDist.value = curveAt(curves.aerialFog, dusk.value);
        },
        rebuild: () => undefined, attachPost: () => undefined };
    },
    terrainPainter: { build: buildSand },
  };
}
