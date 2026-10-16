// SHARD-PLATFORM W2c (build-time look graphs): the faceted ground's SF59 material graphs, built only at build time and
// emitted as JSON (generators/lookMaterials.ts → data/lookMaterials.generated.json, the shardfile's `look.materials`);
// play code reads the ids and rows in data/groundLook.ts, never these builders.
import type { GraphIr } from '@wildshard/format/materialGraph';
import { GROUND_MATERIAL, SLAB_MATERIAL } from '../data/groundLook';

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
 * `base` into `covered` (the baked cove's terrain wears it too, ./islandGraphs.ts).
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
