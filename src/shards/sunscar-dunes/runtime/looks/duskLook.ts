import { BackSide, Color, Fog, Mesh, MeshBasicMaterial, SphereGeometry, Vector3, type DataTexture, type HemisphereLight, type Material, type Texture } from 'three';
import type { LookStrategy, PainterField } from '@wildshard/engine/render/look';
import { Scope } from '@wildshard/engine/app/scope';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import type { Terrain } from '@wildshard/engine/world/Terrain';
import type { GroundPool } from '@wildshard/engine/render/families/ground';
import { curveAt } from './duskCurves';
import { duskSand, duskSky, type DuskSand, type DuskSky } from './duskFamilies';
import { loadPaintedStrips } from './paintedStrips';
import { loadBakedMaps, type BakedMapRow, type CubeSkirt, type TintedTileGround } from './bakedGround';
import type { PackedGeometryJson } from '@wildshard/sdk/kit/geometryPack';
import type { DuskLookRow, DuskTintRow } from '../../data/lastLight';

/** The sand's three baked maps a dusk look draws with. */
export type DuskSandMaps = Record<'shadow' | 'trail' | 'grain', DataTexture>;

/** What a dusk look reads live: the quest's dusk and the fires' light uniforms, the sand's wind, the exact authored ring means, the baked sand maps, the tile ground and the held skirt with its baked pack. */
export interface DuskLookParts {
  readonly dusk: { readonly value: number };
  readonly fires: { readonly value: readonly GroundPool[] };
  readonly wind: { readonly x: number; readonly z: number };
  readonly mean: () => Promise<(x: number, z: number) => number>;
  readonly maps: () => Promise<DuskSandMaps>;
  readonly tiles: TintedTileGround;
  readonly skirt: CubeSkirt;
  readonly skirtPack: { readonly url: string; readonly rows: PackedGeometryJson & { readonly cubeHalf: number }; readonly fault: string };
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
function sandTint(row: DuskTintRow, tones: { sand: Color; hollow: Color; crest: Color }, meanAt: (x: number, z: number) => number, x: number, z: number, h: number, c: Color): Color {
  const { span, hollowGain, crestGain } = row;
  const mean = meanAt(x, z);
  const rel = Math.max(-1, Math.min(1, (h - mean) / span));
  c.copy(tones.sand); if (rel < 0) c.lerp(tones.hollow, -rel * hollowGain); else c.lerp(tones.crest, rel * crestGain);
  return c;
}

/**
 * A dusk look (`extend`): the engine's clean chain, the painted sky family on its dome (a strip that fails to load is a
 * page fault: the dome stands in the fog's colour), the scene's fog edited in place, a low key light that dims and deepens with the dusk, the sky fill, the fog's sun
 * tint, the far rings' haze and the aerial fog on their curves, and the sand family over the tile ground with its skirt
 * (cut back to a grid cell's cube through `parts.skirt`), tinted by height against its ring.
 */
export function duskLook(row: DuskLookRow, parts: DuskLookParts): LookStrategy {
  const key = { dir: new Vector3(...row.key.dir).normalize(), color: new Color(...row.key.color), intensity: row.key.intensity }, deepKey = new Color(...row.key.deep);
  const tones = { sand: new Color(...row.tint.sand), hollow: new Color(...row.tint.hollow), crest: new Color(...row.tint.crest) };
  const sun = new Vector3(...row.sun).normalize(), site = { wind: parts.wind, glow: sun }, dusk = parts.dusk;
  // 120 m: the dome draws first with no depth test, so its size never occludes; at 300 m the far plane clipped it (an arc)
  const dome = new Mesh<SphereGeometry, Material>(new SphereGeometry(120, 48, 24), new MeshBasicMaterial({ color: row.fog.color, side: BackSide, depthTest: false, depthWrite: false, fog: false }));
  dome.renderOrder = -1000; dome.frustumCulled = false;
  let painted: { scope: Scope; sky: DuskSky; textures: readonly Texture[] } | null = null;
  let sand: DuskSand | null = null;
  const buildSand = async (terrain: Terrain, field: PainterField, scope: Scope): Promise<void> => {
    await field.ready();
    const [{ shadow, trail, grain }, skirt, meanAt] = await Promise.all([parts.maps(), parts.skirt.load(parts.skirtPack.url, parts.skirtPack.rows, parts.skirtPack.fault), parts.mean()]);
    scope.own(shadow); scope.own(trail); scope.own(grain);
    const familyGround = duskSand(row.sand, { grain, trail, shadow }, site, dusk.value, scope); sand = familyGround;
    scope.onDispose(() => { if (sand === familyGround) sand = null; });
    const material = familyGround.material; terrain.material = material;
    // The authored f64 ring means preserve the original analytic tint, independently of the collider.
    const c = new Color();
    const skirtMesh = skirt === null ? null : new Mesh(scope.own(skirt.standalone), material);
    if (skirtMesh !== null) { skirtMesh.receiveShadow = false; terrain.group.add(skirtMesh); }
    await parts.tiles.bind(terrain, field, material, (x, z, h, out, at) => {
      sandTint(row.tint, tones, meanAt, x, z, h, c); out[at] = c.r; out[at + 1] = c.g; out[at + 2] = c.b;
    }, scope);
    if (skirt !== null && skirtMesh !== null) parts.skirt.hold(skirtMesh, skirt.cube, skirt.half, scope);
  };
  const fog = row.fog;
  // the clean chain is declared as well as composed, so a grid cell carries it without composing (absent: cinematic)
  return { mode: 'extend', chain: 'clean',
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
        const standIn = dome.material, skyScope = new Scope(row.painted.scope), family = duskSky(row.sky, stages, dusk.value, skyScope);
        dome.material = family.material; standIn.dispose(); painted = { scope: skyScope, sky: family, textures: stages };
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
