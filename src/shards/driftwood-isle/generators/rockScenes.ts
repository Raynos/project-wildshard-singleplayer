/** Final rock geometry and native hulls. No sculpting or normal work survives admission. */
import { BufferAttribute, BufferGeometry, Matrix4 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '@wildshard/engine/core/rng';
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { drawnHullWorld, poseGeometry, poseOf } from '@wildshard/engine/models/colliders';
import { supportPoints } from '@wildshard/engine/models/hull';
import type { Placement } from '@wildshard/engine/models/model';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { authoredRockGeometry } from './rocks';
import { REEF_ROCK, SHORE_ROCK } from './rockProfiles';

/** A boulder's hull as its drawn mesh's support points (models/hull.ts: ~50 of its ~1,800 vertices, within ~5 cm of the
 *  surface): Rapier's quickhull ran on every vertex of the 91 shore boulders each time a world registered them. */
function supportHull(desc: ColliderDesc): ColliderDesc {
  if (desc.kind !== 'hull') return desc;
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(desc.points, 3));
  try { return { ...desc, points: supportPoints(geometry, new Matrix4()) }; } finally { geometry.dispose(); }
}

export interface ShoreParams { readonly r: number; readonly squash: number }
export interface SmallParams { readonly r: number; readonly sq: number }
export interface ReefParams { readonly r: number; readonly squash: number; readonly moss: number }
export interface SmallPlacement { readonly x: number; readonly y: number; readonly z: number; readonly matrix: readonly number[]; readonly params: SmallParams }
/** Authored copy identities survive a merged world draw for picking and place-set membership. */
export interface RockWorldCopy {
  readonly params: object; readonly matrix: readonly number[];
  readonly from: number; readonly count: number; readonly box: readonly number[];
  readonly colliders: readonly ColliderDesc[];
}
export interface RockSceneBake {
  readonly geometry: ReadonlyMap<string, BufferGeometry>;
  readonly shoreColliders: readonly ColliderDesc[];
  readonly world: { readonly shore: readonly RockWorldCopy[]; readonly small: readonly RockWorldCopy[] };
  readonly catalogue: readonly {
    readonly key: string; readonly id: string; readonly name: string; readonly seed: number;
    readonly defaults: object; readonly variants: readonly { readonly id: string; readonly label: string; readonly params: object }[];
    readonly choices: readonly { readonly id: string; readonly params: object; readonly geometry: string; readonly size: readonly number[]; readonly colliders: readonly ColliderDesc[] }[];
  }[];
}

/** Keep the original stream: moss consumes one draw before the sculptor, per copy. */
export function shoreGeometry(params: ShoreParams, rng: Rng): BufferGeometry {
  return authoredRockGeometry(params.r, rng, { moss: rng.range(0.25, 0.85), squash: params.squash,
    palette: SHORE_ROCK, ground: -0.35 * params.r * params.squash });
}
export function smallGeometry(params: SmallParams, rng: Rng): BufferGeometry {
  return authoredRockGeometry(params.r, rng, { moss: rng.range(0.3, 0.8), squash: params.sq,
    palette: SHORE_ROCK, ground: -0.25 * params.r * params.sq, detail: -1 });
}
export function reefGeometry(params: ReefParams, rng: Rng): BufferGeometry {
  return authoredRockGeometry(params.r, rng, { squash: params.squash, palette: REEF_ROCK,
    moss: params.moss, ground: -0.2 * params.r });
}

/** Original merged ordering and Float32 pose arithmetic, including every hull point. */
export function bakeRockScenes(shore: readonly Placement<ShoreParams>[], small: readonly SmallPlacement[]): RockSceneBake {
  // Matrix doubles are map inputs: native transcendental rounding differs on arm64 and x64.
  return withPortableMath(() => buildRockScenes(shore, small));
}

function buildRockScenes(shore: readonly Placement<ShoreParams>[], small: readonly SmallPlacement[]): RockSceneBake {
  const geometry = new Map<string, BufferGeometry>(), shoreColliders: ColliderDesc[] = [];
  const shoreCopies: RockWorldCopy[] = [], smallCopies: RockWorldCopy[] = [];
  const record = (copies: RockWorldCopy[], part: BufferGeometry, row: Placement<object>, params: object, colliders: readonly ColliderDesc[]): void => {
    part.computeBoundingBox();
    const box = part.boundingBox, previous = copies.at(-1);
    if (box === null) throw new Error('World rock omitted its copy bounds');
    copies.push({ params, matrix: [...poseOf(row).matrix.elements], from: previous === undefined ? 0 : previous.from + previous.count,
      count: part.getAttribute('position').count, box: [...box.min, ...box.max], colliders });
  };
  const merge = (key: string, parts: BufferGeometry[]): void => {
    if (parts.length === 0) throw new Error(`Empty rock scene: ${key}`);
    try { const joined = mergeGeometries(parts, false); joined.computeBoundingBox(); joined.computeBoundingSphere(); geometry.set(key, joined); }
    finally { for (const part of parts) part.dispose(); }
  };
  const shoreSeed = 0x5ea1 ^ 0x70c5, smallSeed = 0x5a11 ^ 0x70c8, reefSeed = 0x5a11 ^ 0x70c5;
  const shoreRng = new Rng(shoreSeed), smallRng = new Rng(smallSeed);
  merge('shore', shore.map(row => {
    if (row.params?.r === undefined || row.params.squash === undefined) throw new Error('Missing shore parameters');
    const part = shoreGeometry({ r: row.params.r, squash: row.params.squash }, shoreRng);
    poseGeometry(part, row);
    const colliders = row.params.r > 0.9 ? [supportHull(drawnHullWorld([part], poseOf(row)))] : [];
    shoreColliders.push(...colliders);
    record(shoreCopies, part, row, row.params, colliders);
    return part;
  }));
  merge('small', small.map(row => {
    const part = smallGeometry(row.params, smallRng);
    const placement = { ...row, matrix: new Matrix4().fromArray(row.matrix) };
    poseGeometry(part, placement);
    record(smallCopies, part, placement, row.params, []);
    return part;
  }));
  const catalogue: RockSceneBake['catalogue'][number][] = [];
  function cards<P extends { readonly r: number }>(key: string, id: string, name: string, seed: number, defaults: P,
    variants: readonly { readonly id: string; readonly label: string; readonly params: Partial<P> }[],
    build: (params: P, rng: Rng) => BufferGeometry, solid: boolean): void {
    const choices = variants.map(variant => {
      const params = { ...defaults, ...variant.params }, part = build(params, new Rng(seed)), source = `${key}-${variant.id}`;
      geometry.set(source, part);
      return { id: variant.id, params, geometry: source, size: [params.r * 2, params.r * 2, params.r * 2],
        colliders: solid && params.r > 0.9 ? [supportHull(drawnHullWorld([part], poseOf({ x: 0, y: 0, z: 0 })))] : [] };
    });
    catalogue.push({ key, id: `driftwood-isle/${id}`, name, seed, defaults, variants, choices });
  }
  cards('shoreBoulder', 'shore-boulder', 'Shore boulder', shoreSeed, { r: 1.8, squash: 0.72 }, [
    { id: 'medium', label: 'Medium', params: {} }, { id: 'small', label: 'Small', params: { r: 0.8, squash: 0.7 } }, { id: 'big', label: 'Big', params: { r: 3.6, squash: 0.62 } },
  ], shoreGeometry, true);
  cards('smallRock', 'small-rock', 'Small rock', smallSeed, { r: 0.35, sq: 0.7 }, [
    { id: 'round', label: 'Round', params: {} }, { id: 'flat', label: 'Flat', params: { sq: 0.45 } }, { id: 'big', label: 'Big', params: { r: 0.6, sq: 0.8 } },
  ], smallGeometry, false);
  cards('reefRock', 'reef-rock', 'Reef rock', reefSeed, { r: 1.2, squash: 0.62, moss: 0.9 }, [
    { id: 'mossy', label: 'Mossy', params: {} }, { id: 'bare', label: 'Bare', params: { moss: 0.5 } }, { id: 'tall', label: 'Tall', params: { r: 0.9, squash: 0.95, moss: 0.3 } },
  ], reefGeometry, false);
  return { geometry, shoreColliders, world: { shore: shoreCopies, small: smallCopies }, catalogue };
}
