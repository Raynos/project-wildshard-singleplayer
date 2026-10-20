import wreck from '../data/wreckBake.json' with { type: 'json' };
import cove from '../data/coveBake.json' with { type: 'json' };
import composition from '../data/coveComposition.json' with { type: 'json' };
import rocks from '../data/rockScenes.generated.json' with { type: 'json' };
import { parseWorldScenePlacement, type WorldScenePlacementRow } from '@wildshard/format/worldScenePlacement';

interface Spot { readonly x: number; readonly y: number; readonly z: number; readonly variant?: string; readonly params?: Readonly<Record<string, unknown>> }
interface Copies { readonly placements: readonly Spot[]; readonly boxes: readonly number[] }
interface Baked { readonly params: Readonly<Record<string, number>>; readonly matrix: readonly number[]; readonly box: readonly number[]; readonly colliders: readonly unknown[] }

/** Upright copies drawn into a scene part's weld: their placement point, variant and params as baked; `bare` drops the
 *  model's own colliders (the reef rocks stand in the sea without hulls). */
function upright(id: string, model: string, part: string, piece: string, copies: Copies, bare = false): WorldScenePlacementRow {
  return parseWorldScenePlacement({ id, model, draw: 'merged', drawnInto: { part, boxes: copies.boxes }, ...(bare ? { colliders: [] } : {}),
    poses: copies.placements.map(({ x, y, z, variant, params }) => ({ x, y, z, ...(variant === undefined ? {} : { variant }), ...(params === undefined ? {} : { params }), yxz: { yaw: 0, scale: 1 } })), piece: { id: piece } });
}
/** Baked rock copies (bake-rock-scenes): each its own matrix, box and native hulls. */
function baked(id: string, model: string, part: string, piece: { id: string; solidFloor?: boolean }, rows: readonly Baked[]): WorldScenePlacementRow {
  return parseWorldScenePlacement({ id, model, draw: 'merged', drawnInto: { part, boxes: rows.flatMap(row => row.box) },
    poses: rows.map(row => ({ x: row.matrix[12] ?? 0, y: row.matrix[13] ?? 0, z: row.matrix[14] ?? 0, params: row.params, matrix: row.matrix })),
    colliders: rows.flatMap(row => row.colliders), piece });
}

/** Poses whose baked matrix is a bare translation (the palms and hibiscus) as an upright yxz pose: the same matrix, a
 *  sixth of the bytes. Any turned or scaled copy keeps its matrix. */
export function uprightPoses(poses: readonly Readonly<{ matrix: readonly number[] } & Record<string, unknown>>[]): Readonly<Record<string, unknown>>[] {
  const bare = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  return poses.map(pose => {
    if (!bare.every((value, i) => pose.matrix[i] === value) || pose.matrix[15] !== 1) return pose;
    const { matrix: _matrix, ...rest } = pose;
    return { ...rest, yxz: { yaw: 0, scale: 1 } };
  });
}

/**
 * The world's declared copies the world build used to place by hand (world/build.ts and the old Blender island module): the cove's
 * small rocks, the wreck and its cargo and reef rocks, the sea cave's reef rocks. Each is a world
 * scene placement drawn into the part its scene step publishes, registering its piece's colliders and floors.
 */
export const WORLD_PLACEMENTS: readonly WorldScenePlacementRow[] = [
  baked('rocks.small.copies', 'smallRock', 'rocks.small', { id: 'cove-small-rocks' }, rocks.world.small),
  parseWorldScenePlacement({ id: 'wreck.ship', model: 'shipwreck', draw: 'merged', drawnInto: { part: 'wreck.root', boxes: wreck.shipBox },
    poses: [{ x: wreck.spec.x, y: wreck.floorY, z: wreck.spec.z, params: { site: wreck.spec }, yxz: { yaw: wreck.spec.heading, scale: 1 } }],
    colliders: wreck.descs, piece: { id: 'wreck', floors: wreck.floors, floorPolicy: 'first', solidFloor: true } }),
  upright('wreck.barrels', 'barrel', 'wreck.root', 'wreck-barrels', wreck.catalogue.barrels),
  upright('wreck.crates', 'crate', 'wreck.root', 'wreck-crates', wreck.catalogue.crates),
  upright('wreck.coils', 'ropeCoil', 'wreck.root', 'wreck-coils', wreck.catalogue.coils),
  upright('wreck.reef', 'reefRock', 'wreck.root', 'wreck-reef-rocks', wreck.catalogue.rocks, true),
  upright('cove.reef', 'reefRock', composition.rocks, composition.reefPiece, cove.catalogue, true),
];
