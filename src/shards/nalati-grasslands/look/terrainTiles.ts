/**
 * Nalati's painted terrain as the painterly family's painted-terrain layer (SHARD-PLATFORM G227): the material entry
 * the shardfile's tiled terrain will name, and a test cell that redraws today's terrain as 62.5 m tiles with it.
 *
 * `NALATI_TERRAIN_SURFACE` is the catalogue entry (`look.materials`): today's terrain knobs (bands 0.5, rim 0, shade 0.85)
 * and `terrainSurface.ts`'s numbers as the layer's data. Its texture references are the painted layers' names here; the
 * bake swaps them for the admitted KTX2 hashes.
 *
 * `terrainTileProbe` is the parity harness's handle (the probe's `shard.terrainTiles`, no Debug row, no URL switch): `set(mode)`
 * hides today's terrain mesh and draws the same terrain as an 8 × 8 grid of tiles with the family material (`slice`: the
 * live grid cut at the tile lines, vertex-identical; `lattice`: each 62.5 m tile resampled on the L0 lattice, 33 × 33, as
 * the bake writes it), sharing today's live bake and the painterly look's live values; `set('off')` puts today's back.
 * Nothing switches live: the shipped terrain is untouched unless a harness calls it.
 */
import * as THREE from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { familyMaterial } from '@wildshard/engine/render/families/registry';
import { PainterlyLook } from '@wildshard/engine/render/families/painterly';
import { ToonLook } from '@wildshard/engine/render/families/toon';
import { bindPaintedTerrainBake } from '@wildshard/engine/render/families/paintedTerrain';
import { PAINTED_TERRAIN_ATTRIBUTES, type FamilyMaterialInput } from '@wildshard/engine/render/families/params';
import { patchShader, PATCH_ORDER } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { painterlyUniforms } from '@wildshard/engine/world/painterly';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { SNOW_LINE, GLACIER } from '../layout';
import { TEX_METRES, TEX_MEAN, loadNalatiTextures } from './nalatiTextures';
import { bakeUniforms } from './bake';
import { builtTerrain, paintTerrainLattice } from './terrainPainter';

/** Nalati's terrain surface as a painterly family entry with the painted-terrain layer. */
export const NALATI_TERRAIN_SURFACE = {
  family: 'painterly', bands: 0.5, rim: 0, shade: 0.85,
  terrain: {
    maps: { base: 'meadow', track: 'path', gravel: 'gravel', rock: 'rock', snow: 'snow' },
    metres: { base: TEX_METRES.meadow, track: TEX_METRES.path, gravel: TEX_METRES.gravel, rock: TEX_METRES.rock, snow: TEX_METRES.snow },
    means: { base: [...TEX_MEAN.meadow], rock: [...TEX_MEAN.rock] },
    snow: { line: SNOW_LINE, high: [44, 84] },
    wet: [-9.2, -9.9],
    ice: { from: [GLACIER.x0, GLACIER.z0], to: [GLACIER.x1, GLACIER.z1], half: GLACIER.half },
  },
} satisfies FamilyMaterialInput;

/** the live grid's attribute → the layer's attribute */
const RENAME = [['surf', PAINTED_TERRAIN_ATTRIBUTES.mask.name], ['rdir', PAINTED_TERRAIN_ATTRIBUTES.track.name], ['zone', PAINTED_TERRAIN_ATTRIBUTES.zone.name]] as const;
const TILES = 8;

/** cut the live res × res grid into 8 × 8 tiles at the 62.5 m lines (each tile's rows include the shared edge row) */
function sliceTile(src: THREE.BufferGeometry, res: number, tx: number, tz: number): THREE.BufferGeometry {
  const n = res - 1, edge = (t: number): number => Math.round(t * n / TILES);
  const x0 = edge(tx), x1 = edge(tx + 1), z0 = edge(tz), z1 = edge(tz + 1), w = x1 - x0 + 1, h = z1 - z0 + 1;
  const geo = new THREE.BufferGeometry();
  for (const [from, to] of [['position', 'position'], ['normal', 'normal'], ['color', 'color'], ...RENAME] as const) {
    const a = src.getAttribute(from), size = a.itemSize, out = new Float32Array(w * h * size);
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
      const i = (z0 + z) * res + x0 + x;
      for (let k = 0; k < size; k++) out[(z * w + x) * size + k] = a.getComponent(i, k);
    }
    geo.setAttribute(to, new THREE.BufferAttribute(out, size));
  }
  geo.setIndex(gridIndex(w, h));
  geo.computeBoundingSphere();
  return geo;
}

function gridIndex(w: number, h: number): THREE.BufferAttribute {
  const idx = new Uint32Array((w - 1) * (h - 1) * 6);
  let k = 0;
  for (let z = 0; z < h - 1; z++) for (let x = 0; x < w - 1; x++) {
    const a = z * w + x, b = a + 1, c = a + w, e = c + 1;
    idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = e;
  }
  return new THREE.BufferAttribute(idx, 1);
}

/** one 62.5 m tile on the L0 lattice (33 × 33), every vertex painted by the live painter's own functions */
function latticeTile(tx: number, tz: number): THREE.BufferGeometry {
  const size = (CHUNK_HALF * 2) / TILES, res = 33;
  const geo = paintTerrainLattice(-CHUNK_HALF + tx * size, -CHUNK_HALF + tz * size, size, res);
  for (const [from, to] of RENAME) { geo.setAttribute(to, geo.getAttribute(from)); geo.deleteAttribute(from); }
  geo.setIndex(gridIndex(res, res));
  geo.computeBoundingSphere();
  return geo;
}

/** What `set` reports: the tiles drawn, their vertices and the family material's program key. */
export interface TerrainTileReport { mode: 'off' | 'slice' | 'lattice'; tiles: number; vertices: number; key: string }

/** The parity handle (see the header). */
export function terrainTileProbe(sky: SkyRig, scope: Scope): { set: (mode: 'off' | 'slice' | 'lattice') => Promise<TerrainTileReport> } {
  let group: THREE.Group | null = null, material: THREE.Material | null = null, geometries: THREE.BufferGeometry[] = [];
  const clear = (): void => {
    const t = builtTerrain();
    group?.removeFromParent();
    for (const geo of geometries) geo.dispose();
    geometries = [];
    group = null;
    if (t !== null) t.mesh.visible = true;
  };
  scope.onDispose(() => { clear(); material?.dispose(); });
  const build = async (): Promise<THREE.Material> => {
    if (material !== null) return material;
    const tex = await loadNalatiTextures(['meadow', 'path', 'gravel', 'rock', 'snow']);
    const resolve = (ref: string): THREE.Texture => {
      if (ref === 'meadow' || ref === 'path' || ref === 'gravel' || ref === 'rock' || ref === 'snow') return tex[ref];
      throw new Error(`Nalati terrain tiles: no texture ${ref}`);
    };
    // today's grade is the v2 post pass: the family look must not grade again
    const paint = new PainterlyLook({ grade: null });
    const m = familyMaterial(NALATI_TERRAIN_SURFACE, { toon: new ToonLook(), painterly: paint, textures: resolve, scope });
    bindPaintedTerrainBake(m, { famTBakeShadow: bakeUniforms.tBakeShadow, famTBakeMatrix: bakeUniforms.uBakeMatrix, famTBakeInfo: bakeUniforms.uBakeInfo, famTBakeContact: bakeUniforms.tBakeContact, famTContactXf: bakeUniforms.uContactXf });
    patchShader(m, 'nalati.terrainTiles.fog', PATCH_ORDER.decorate, (shader) => { attachFogUniforms(shader); });
    // the shard's painterly look moves by the page-wide painterly uniforms (the day keys, the weather): follow them each draw
    const before = m.onBeforeRender.bind(m);
    m.onBeforeRender = (renderer, scene, camera, geometry, object, g) => {
      const u = paint.uniforms, p = painterlyUniforms;
      u.famPaintShade.value.copy(p.uPShade.value); u.famPaintRimColour.value.copy(p.uPRimColor.value);
      u.famPaintWarm.value = p.uPWarm.value; u.famPaintFloor.value = p.uPFloor.value; u.famPaintWet.value = p.uPWet.value;
      u.famPaintTime.value = p.uPTime.value; u.famPaintWind.value.copy(p.uPWind.value);
      before(renderer, scene, camera, geometry, object, g);
    };
    sky.setupMaterial(m);
    material = m;
    return m;
  };
  return {
    set: async (mode) => {
      clear();
      const t = builtTerrain();
      if (mode === 'off' || t === null) return { mode: 'off', tiles: 0, vertices: 0, key: '' };
      const m = await build();
      const live = t.mesh.geometry, res = Math.round(Math.sqrt(live.getAttribute('position').count));
      const g = new THREE.Group();
      g.name = 'terrain-tiles';
      let vertices = 0;
      for (let tz = 0; tz < TILES; tz++) for (let tx = 0; tx < TILES; tx++) {
        const geo = mode === 'slice' ? sliceTile(live, res, tx, tz) : latticeTile(tx, tz);
        vertices += geo.getAttribute('position').count;
        geometries.push(geo);
        const mesh = new THREE.Mesh(geo, m);
        mesh.receiveShadow = true; mesh.castShadow = false;
        g.add(mesh);
      }
      t.mesh.visible = false;
      t.group.add(g);
      group = g;
      return { mode, tiles: TILES * TILES, vertices, key: m.customProgramCacheKey() };
    },
  };
}
