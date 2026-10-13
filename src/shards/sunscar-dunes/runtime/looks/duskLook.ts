import { BackSide, Color, Fog, Mesh, MeshBasicMaterial, SphereGeometry, Vector3, type HemisphereLight, type Material, type Texture } from 'three';
import type { LookStrategy, PainterField } from '@wildshard/engine/render/look';
import { Scope } from '@wildshard/engine/app/scope';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import type { Terrain } from '@wildshard/engine/world/Terrain';
import { setGroundPools, type GroundPool } from '@wildshard/engine/render/families/ground';
import { curveAt } from '@wildshard/format/materials';
import { duskSky, type DuskSky } from './duskFamilies';
import { loadPaintedStrips } from './paintedStrips';
import type { CubeSkirt } from './bakedGround';
import type { PackedGeometryJson } from '@wildshard/sdk/kit/geometryPack';
import type { DuskLookRow } from '../../data/lastLight';

/**
 * What a dusk look reads live: the quest's dusk and the fires' light uniforms, the sand the data client lends (null until
 * lent), the binding of the level frame's ground and the held skirt with its baked pack.
 */
export interface DuskLookParts {
  readonly dusk: { readonly value: number };
  readonly fires: { readonly value: readonly GroundPool[] };
  readonly sand: { material: Material | null };
  readonly ground: (field: PainterField, scope: Scope) => Promise<void>;
  readonly skirt: CubeSkirt;
  readonly skirtPack: { readonly url: string; readonly rows: PackedGeometryJson & { readonly cubeHalf: number }; readonly fault: string };
}

/**
 * A dusk look (`extend`): the engine's clean chain, the painted sky family on its dome (a strip that fails to load is a
 * page fault: the dome stands in the fog's colour), the scene's fog edited in place, a low key light that dims and deepens with the dusk, the sky fill, the fog's sun
 * tint, the far rings' haze and the aerial fog on their curves, the level frame's ground bound and the skirt held (cut back to
 * a grid cell's cube through `parts.skirt`). The data client draws the tiles in the look's sand (G345); the skirt wears it
 * once lent, and the burning fires' light pools are fed to it each frame.
 */
export function duskLook(row: DuskLookRow, parts: DuskLookParts): LookStrategy {
  const key = { dir: new Vector3(...row.key.dir).normalize(), color: new Color(...row.key.color), intensity: row.key.intensity }, deepKey = new Color(...row.key.deep);
  const dusk = parts.dusk;
  // 120 m: the dome draws first with no depth test, so its size never occludes; at 300 m the far plane clipped it (an arc)
  const dome = new Mesh<SphereGeometry, Material>(new SphereGeometry(120, 48, 24), new MeshBasicMaterial({ color: row.fog.color, side: BackSide, depthTest: false, depthWrite: false, fog: false }));
  dome.renderOrder = -1000; dome.frustumCulled = false;
  let painted: { scope: Scope; sky: DuskSky; textures: readonly Texture[] } | null = null;
  const buildSand = async (terrain: Terrain, field: PainterField, scope: Scope): Promise<void> => {
    const skirt = await parts.skirt.load(parts.skirtPack.url, parts.skirtPack.rows, parts.skirtPack.fault);
    if (skirt !== null) parts.skirt.hold(terrain.group, skirt.standalone, skirt.cube, skirt.half, scope);
    // the collider is the level's ground (its required ground counts as loaded once bound), so it binds before ready()
    await parts.ground(field, scope);
    await field.ready();
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
          painted?.sky.blend(dusk.value);
          if (parts.sand.material !== null) setGroundPools(parts.sand.material, parts.fires.value);
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
