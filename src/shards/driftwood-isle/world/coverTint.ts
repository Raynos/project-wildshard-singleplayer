/**
 * E156 — the ground wears the cover. Driftwood's ground cover is drawn only round the camera (GroundCover.ts, the Blender
 * cove's cover tiles); past that the terrain was bare facet colour, so plants seemed to appear as you walked up to them.
 * The chunk-wide cover grid (@wildshard/sdk/looks/coverGrid) holds what the cover makes the ground look like per 4 m:
 * GroundCover fills it from its own density rules, the Blender island overwrites its area from the cover it actually
 * placed, and the terrains sample it per vertex and mix their facets towards it by how much of the ground the plants hide
 * from where you look. The plants fade into the same colour (`coverSeen`). The GLSL and the patch are data
 * (data/coverGlsl.ts).
 *
 *   const grid = CoverGrid.create();          // GroundCover.build() fills it (grid.fill), the Blender cove splats its own
 *   tintTerrain(terrain.mesh);                // after the fill: aCover per vertex + the shader
 *
 * Always on (E318: the decided Debug row "Ground tint" is gone).
 */
import type * as THREE from 'three';
import { CoverGrid as SdkCoverGrid, coverJitter as sdkCoverJitter, coverSample as sdkCoverSample, coverSeenGlsl, tintTerrain as sdkTintTerrain, triAreas as sdkTriAreas, type CoverSample as SdkCoverSample, type CoverTintRow, type CoverTri as SdkCoverTri } from '@wildshard/sdk/looks/coverGrid';
import { COVER_GLSL, COVER_TINT } from '../data/coverGlsl';

const TINT: CoverTintRow = { glsl: COVER_GLSL, ...COVER_TINT };

/** `coverSeen` as a shader fragment: how much of the ground the cover hides seen at `facing` (the plants fade into it). */
export const COVER_SEEN_GLSL = coverSeenGlsl(COVER_GLSL);
/** What the grid holds at a point. */
export type CoverSample = SdkCoverSample;
/** One triangle of cover for CoverGrid.splat. */
export type CoverTri = SdkCoverTri;
/** An empty sample to fill. */
export const coverSample: typeof sdkCoverSample = sdkCoverSample;
/** A triangle's ground area and upright cross-section (GroundCover's per-kind look and the Blender cove's splat). */
export const triAreas: typeof sdkTriAreas = sdkTriAreas;
/** The chunk's cover grid (4 m cells). */
export const CoverGrid: typeof SdkCoverGrid = SdkCoverGrid;
/** ×0.88 … ×1.12 per point (the facets of covered ground keep their light / dark mosaic). */
export const coverJitter: typeof sdkCoverJitter = sdkCoverJitter;

/** Give a low-poly terrain mesh the cover's look (`matrixWorld`: the mesh's; the Blender tiles keep meshopt's dequantisation there). */
export function tintTerrain(mesh: THREE.Mesh, matrixWorld = mesh.matrixWorld): void {
  sdkTintTerrain(mesh, TINT, matrixWorld);
}
