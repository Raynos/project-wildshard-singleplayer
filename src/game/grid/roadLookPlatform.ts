/**
 * The platform's road system in one call (SHARD-PLATFORM SF17b look and per-view budget, G144 admission): the seams' solid
 * parts and curtain (`seamLook.ts`), the boulevard (`roadLook.ts`), the void and its rail (`voidLook.ts`), and the deck: the
 * seams, kerbs, islands, streetlights and the void's rail + posts as ONE solid mesh (`roadSolid.ts`) plus the seams' additive
 * curtain, every road mesh culled per view (`roadCull.ts`).
 *
 * Six allocations, each with an exact preflight byte plan (retained JS: typed arrays, canvases and the grain data; GPU:
 * vertex and index buffers and every mip level): `road.asphalt`, `road.junctions`, `road.signs`, `road.void`, `road.deck`
 * (with the grain array it alone samples) and `road.curtain`. Each is built only after its plan is admitted and
 * disposes on the admission's child scope; a refusal never builds. G112 removed the unmetered grid composition.
 *
 * Construction transients (the meshers' number arrays, the seams' split parts, the solid parts the deck merges) are made
 * before the deck's and the boulevard's claims and dropped after; the curtain's split arrays become its geometry without a
 * copy (they are counted in `road.curtain`).
 */
import { Mesh, type Camera, type Object3D } from 'three';
import type { GridCell } from './assembly';
import type { LookScope, RoadLayout } from './roadLayout';
import type { PlatformRenderAdmission, PlatformRenderBytePlan } from './renderResidency';
import { installRoadLook, type RoadLookState } from './roadLook';
import { installVoidLook } from './voidLook';
import { CURTAIN_FLOATS, curtainGeometry, curtainMaterial, curtainSource, gravel, riprap, seamSolidSource, stone, strata, type SeamCurtain, type SeamLookState, type SeamPiece } from './seamLook';
import { bytePlan, cullInto, gpuOnlyRoad, meshBytes, ROAD_LOD, type CullPlan, type RoadCuller } from './roadCull';
import { GRAIN_LAYERS, GRAIN_SIZE, gpuOnlyTextureBytes, grainArray, SOLID_FLOATS, solidGeometry, solidMaterial, solidSource, type SolidPart } from './roadSolid';

/** What the road system reads and where it draws. */
export interface PlatformRoadInput {
  /** the generator's strips (the same triangles the colliders use) */
  readonly strips: readonly SeamPiece[];
  readonly home: GridCell;
  readonly pitch: number;
  readonly layout: RoadLayout;
  readonly scene: Object3D;
  readonly scope: LookScope;
  /** the view camera the per-view cull follows (absent: every camera culls) */
  readonly camera?: () => Camera | undefined;
  /** each culled mesh's plan, for the budget readouts (`roadViewCost`, `roadResident`) */
  readonly plans: Map<Mesh, CullPlan>;
  /** G144: admit each allocation's byte plan before building it. */
  readonly admission: PlatformRenderAdmission;
}
/** The readouts and the roots the road budget measures. */
export interface PlatformRoad { readonly road: RoadLookState; readonly seams: SeamLookState; readonly roots: readonly Object3D[] }

/** G144's preflight for the deck: the merged solid parts after clip and far LOD, and the grain array (every mip of every
 *  layer); admitted, the vertex buffers and the grain data keep no JS copy once uploaded (`gpuOnlyRoad`). */
export function deckPlan(parts: readonly SolidPart[], pitch: number): PlatformRenderBytePlan {
  return bytePlan('road.deck', meshBytes(parts.map(solidSource), SOLID_FLOATS, { pitch, lod: ROAD_LOD }, true), gpuOnlyTextureBytes(GRAIN_SIZE, GRAIN_SIZE, GRAIN_LAYERS.length, 'data'));
}
/** G144's preflight for the curtain: its positions and index after clip (no LOD, no texture), positions GPU-only. */
export function curtainPlan(curtain: SeamCurtain, pitch: number): PlatformRenderBytePlan {
  return bytePlan('road.curtain', meshBytes([curtainSource(curtain)], CURTAIN_FLOATS, { pitch }, true));
}

/** Install the platform's road system; everything disposes with `scope` (or, admitted, with each allocation's child scope). */
export function installPlatformRoad(input: PlatformRoadInput): PlatformRoad {
  const { strips, home, pitch, layout, scene, scope, admission } = input;
  const culler: RoadCuller = { pitch, plans: input.plans, ...(input.camera === undefined ? {} : { camera: input.camera }) };
  const admit = (plan: () => PlatformRenderBytePlan, build: (owner: LookScope) => void): void => {
    admission.allocate(plan(), build);
  };
  // the seams' materials keyed by the generator's feature ranges: the same triangles the world collides with
  const seams = seamSolidSource(strips, home, undefined, pitch);
  const parts: SolidPart[] = [...seams.parts], solid = (part: SolidPart): void => { parts.push(part); };
  const road = installRoadLook({ layout, home, scene, scope, solid, cull: culler, admission });
  installVoidLook({ rail: layout.rail, home, scene, scope, solid, admission });
  const meshes: Mesh[] = [];
  admit(() => deckPlan(parts, pitch), (owner) => {
    const grain = grainArray({ gravel, stone, strata, riprap }), material = solidMaterial(grain), deck = new Mesh(solidGeometry(parts), material);
    owner.onDispose(() => { deck.removeFromParent(); deck.geometry.dispose(); material.dispose(); grain.dispose(); });
    deck.name = 'grid-deck'; deck.receiveShadow = true;
    deck.castShadow = false; deck.matrixAutoUpdate = false; deck.updateMatrix(); scene.add(deck); cullInto(culler, deck, ROAD_LOD); meshes.push(deck);
    gpuOnlyRoad(deck, [grain]); // G144: admitted, its JS copies go on upload (the plan counts them gone)
  });
  admit(() => curtainPlan(seams.curtain, pitch), (owner) => {
    const material = curtainMaterial(home), curtain = new Mesh(curtainGeometry(seams.curtain), material);
    owner.onDispose(() => { curtain.removeFromParent(); curtain.geometry.dispose(); material.dispose(); });
    curtain.name = 'grid-seam-curtain'; curtain.receiveShadow = false;
    curtain.castShadow = false; curtain.matrixAutoUpdate = false; curtain.updateMatrix(); scene.add(curtain); cullInto(culler, curtain); meshes.push(curtain);
    gpuOnlyRoad(curtain, []);
  });
  const roots = [...meshes, scene.getObjectByName('grid-boulevard'), scene.getObjectByName('grid-void')].filter((o): o is Object3D => o !== undefined);
  return { road, seams: seams.state, roots };
}
