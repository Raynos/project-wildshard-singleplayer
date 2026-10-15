// SHARD-PLATFORM M3 (look-family rows): Driftwood's faceted ground (look/terrainPainter.ts builds it through
// runtime/looks/facetedGround.ts): the materials it wears, the build's band, the cliff lip, the slab walls and the sand
// paths. The colours by height and slope are look/groundColor.ts.
import type { GraphIr } from '@wildshard/format/materialGraph';
import type { FacetedGroundRow } from './lookRows';

/** the look.materials ids the ground and its slab walls wear */
export const GROUND_MATERIAL = 'driftwood-ground';
export const SLAB_MATERIAL = 'driftwood-ground-slab';

/**
 * Faceted ground: 64 rows a task (the 256² grid was one ~120 ms task at 4x CPU); a cliff's top lip where the normal y is
 * under 0.8 and nothing within 2.5 m rises 0.4–1.4 m higher (L6: the grass lips over it); the slab: 96 segments a side in
 * rock '#5a5d63' darkening to '#1c1f26' at the chunk's depth, 5 cm over the ground, a bulge 4–9 m out at 55 % depth, its
 * foot 2 m out, shaded 0.85–1.15.
 */
export const GROUND_LOOK: FacetedGroundRow = {
  materials: { ground: GROUND_MATERIAL, slab: SLAB_MATERIAL },
  band: 64,
  lip: { steep: 0.8, reach: 2.5, from: 0.4, to: 1.4 },
  slab: { segs: 96, rock: '#5a5d63', deep: '#1c1f26', top: 0.05, bulge: [4, 5], foot: 2, mid: 0.55, shade: [0.85, 0.3] },
};

/** The sand paths over the grass: more than 1.5 m over the sea, a bed blended in from 4.5 m to 2.2 m off a trail's
 *  centre line, its colour jittered 0.94–1.06. */
export const GROUND_PATHS: { readonly above: number; readonly from: number; readonly to: number; readonly shade: readonly [number, number] } = {
  above: 1.5, from: 2.2, to: 4.5, shade: [0.94, 0.12],
};

/**
 * The ground's SF59 material graphs (SHARD-PLATFORM W2 C2; the shardfile's `look.materials`, compiled by the look's
 * `prepareWorld` before the ground builds): the toon family's light model (its numbers the catalogue's live toon look,
 * following the day clock: look/toon.ts `followToon`), flat-shaded, matte (no sun specular). The grid's colour is a `flat`
 * varying, so each triangle takes its provoking vertex's paint (solid facets on one indexed grid); the slab's colour
 * darkens with depth along the wall (matte 0.95).
 *
 * E156, the ground wears the cover (runtime/looks/coverGrid.ts `tintTerrain` fills `aCover` rgb + top and `aCoverSide`
 * per vertex, `flat` like the paint): the facet mixes toward the cover's colour by how much of the ground the plants hide
 * from where you look, 1 − (1 − top)·(1 − side)^(√(1 − f²) / f) at facing f (the classic patch's
 * 1 − e^−τ, τ = −ln(1 − top) − ln(1 − side)·√(1 − f²) / f; each share kept under 0.999). `coverMix(base)` mixes node
 * `base` into `covered` (the baked cove's terrain wears it too, data/islandLook.ts).
 */
export const coverMix = (base: string): GraphIr['nodes'] => ({
  coverIn: { op: 'attribute', name: 'aCover', type: 'vec4' }, cover: { op: 'varying', in: ['coverIn'], interpolation: 'flat' },
  sideIn: { op: 'attribute', name: 'aCoverSide', type: 'float' }, side: { op: 'varying', in: ['sideIn'], interpolation: 'flat' },
  at: { op: 'positionWorld' }, dx: { op: 'dFdx', in: ['at'] }, dy: { op: 'dFdy', in: ['at'] },
  faceX: { op: 'cross', in: ['dx', 'dy'] }, faceN: { op: 'normalize', in: ['faceX'] },
  eye: { op: 'cameraPosition' }, toEye: { op: 'sub', in: ['eye', 'at'] }, view: { op: 'normalize', in: ['toEye'] },
  facingRaw: { op: 'dot', in: ['faceN', 'view'] }, facingAbs: { op: 'abs', in: ['facingRaw'] }, facing: { op: 'clamp', in: ['facingAbs', 0.03, 1] },
  f2: { op: 'mul', in: ['facing', 'facing'] }, sin2: { op: 'oneMinus', in: ['f2'] }, sinF: { op: 'pow', in: ['sin2', 0.5] },
  slant: { op: 'div', in: ['sinF', 'facing'] },
  top: { op: 'swizzle', in: ['cover'], mask: 'w' }, coverRgb: { op: 'swizzle', in: ['cover'], mask: 'xyz' },
  bareTop: { op: 'oneMinus', in: ['top'] }, bareTopK: { op: 'max', in: ['bareTop', 0.001] },
  bareSide: { op: 'oneMinus', in: ['side'] }, bareSideK: { op: 'max', in: ['bareSide', 0.001] },
  bareSeen: { op: 'pow', in: ['bareSideK', 'slant'] }, bare: { op: 'mul', in: ['bareTopK', 'bareSeen'] }, seen: { op: 'oneMinus', in: ['bare'] },
  covered: { op: 'mix', in: [base, 'coverRgb', 'seen'] },
});

function groundGraph(roughness: number, facetColour: boolean): GraphIr {
  return { version: 1, kind: 'material', model: 'toon', flatShading: true,
    nodes: { paint: { op: 'vertexColour' }, ...(facetColour ? { facet: { op: 'varying', in: ['paint'], interpolation: 'flat' }, ...coverMix('facet') } : {}) },
    stages: { surface: { colour: facetColour ? 'covered' : 'paint', roughness, metalness: 0 } } };
}

/** The ground's graphs by look.materials id. */
export const GROUND_GRAPHS: Readonly<Record<string, GraphIr>> = { [GROUND_MATERIAL]: groundGraph(0.92, true), [SLAB_MATERIAL]: groundGraph(0.95, false) };
