/**
 * E156 — the ground wears the cover. Driftwood's ground cover is drawn only round the camera (GroundCover.ts, the Blender
 * cove's cover tiles); past that the terrain was bare facet colour, so plants seemed to appear as you walked up to them.
 * The chunk-wide cover grid (@wildshard/sdk/looks/coverGrid) holds what the cover makes the ground look like per 4 m:
 * The build combines the density estimate and the Blender island’s actual placed cover; runtime borrows that full grid, and the terrains sample it per vertex and mix their facets towards it by how much of the ground the plants hide
 * from where you look. The plants fade into the same colour (`coverSeen`). The GLSL and the patch are data
 * (data/coverGlsl.ts).
 *
 *   const grid = CoverGrid.create(admitted, bounds); // Borrow the validated, cropped full-grid body
 *   tintTerrain(terrain.mesh);                // after the fill: aCover per vertex + the shader
 *
 * Always on (E318: the decided Debug row "Ground tint" is gone).
 */
import type * as THREE from 'three';
import { CoverGrid as SdkCoverGrid, coverJitter as sdkCoverJitter, coverSample as sdkCoverSample, tintTerrain as sdkTintTerrain, type CoverSample as SdkCoverSample, type CoverTintRow } from '../runtime/looks/coverGrid';
import { COVER_GLSL, COVER_TINT } from '../runtime/looks/coverGlsl';

const TINT: CoverTintRow = { glsl: COVER_GLSL, ...COVER_TINT };

/** What the grid holds at a point. */
export type CoverSample = SdkCoverSample;
/** An empty sample to fill. */
export const coverSample: typeof sdkCoverSample = sdkCoverSample;
/** The chunk's cover grid (4 m cells). */
export const CoverGrid: typeof SdkCoverGrid = SdkCoverGrid;
/** ×0.88 … ×1.12 per point (the facets of covered ground keep their light / dark mosaic). */
export const coverJitter: typeof sdkCoverJitter = sdkCoverJitter;

/** Give a low-poly terrain mesh the cover's look (`matrixWorld`: the mesh's; the Blender tiles keep meshopt's dequantisation there). */
export function tintTerrain(mesh: THREE.Mesh, matrixWorld = mesh.matrixWorld): void {
  sdkTintTerrain(mesh, TINT, matrixWorld);
}
