/**
 * RoadFurniture — split-rail fences along the valley roads (the N road from the gate to the bridge, the camp spur,
 * keeping the sheep pasture off the road) and carved signposts at the junctions (the camp turn, the foot of the sky
 * road, the gateway where it tops out, the bowl's crossroads, the E road's turn). The posts and boards are in the merged
 * POI mesh; the lettering is one small canvas atlas on one extra mesh (a painterly material with a map).
 *
 *   const roads = buildRoadFurniture(ctx);   // PoiPiece (object = a group of the meshes); it registers itself
 *
 * E306 / E315 second pass: the fence runs and the signposts are models (src/shards/nalati-grasslands/models/fence.ts,
 * signpost.ts) placed through a NalatiSet (./painted.ts) in the old builder's order — no set (the roads are not a place).
 */
import * as THREE from 'three';
import { PaintKit } from './paint';
import { NalatiSet } from './painted';
import { CAMP } from './layout';
import { PASTURE, HORSE_PLAINS, KOKPAR, EAGLE_ROCK, SUMMER_YURTS, WATCHTOWER, KURGANS } from '../layout';
import type { PoiCtx, PoiPiece } from './types';
import { fence, fenceRun } from '../models/fence';
import { signpost, boardSpots, letteringMesh, type Board, type BoardSpot } from '../models/signpost';

interface Signpost { x: number; z: number; boards: Board[] }

const dirTo = (x0: number, z0: number, x1: number, z1: number) => Math.atan2(x1 - x0, z1 - z0);
/** compass directions as `dir` yaws: +z north, +x west */
const N = 0, S = Math.PI, W = Math.PI / 2;

/** the kurgan field's middle (the mounds other than the great one) */
const KF = KURGANS.filter((k) => k.great !== true).reduce((a, k, _, l) => ({ x: a.x + k.x / l.length, z: a.z + k.z / l.length }), { x: 0, z: 0 });
/** signposts at the junctions of layout v2 (src/shards/nalati-grasslands/layout.ts): the camp turn on the N road, the sky road's
 *  foot at the bridge, the gateway at its top, the bowl's crossroads, the E road's turn */
const SIGNS: Signpost[] = [
  { x: -5.2, z: 217, boards: [{ text: 'NOMAD CAMP', dir: dirTo(0, 214, CAMP.x, CAMP.z) }, { text: 'SKY GRASSLAND', dir: S }, { text: 'SHEEP PASTURE', dir: dirTo(0, 217, PASTURE.x, PASTURE.z) }] },
  { x: -6, z: 152, boards: [{ text: 'SKY ROAD', dir: W + 0.1 }, { text: 'KUNES BRIDGE', dir: N }] },
  { x: 127, z: 75, boards: [{ text: 'HORSE PLAINS', dir: dirTo(127, 75, HORSE_PLAINS.x, HORSE_PLAINS.z) }, { text: 'EAGLE ROCK', dir: dirTo(127, 75, EAGLE_ROCK.x, EAGLE_ROCK.z) }, { text: 'W ROAD', dir: dirTo(127, 75, 250, 0) }, { text: 'VALLEY · CAMP', dir: dirTo(127, 75, 92, 90) }] },
  { x: 12, z: 14, boards: [{ text: 'SNOW LOTUS VALLEY', dir: S }, { text: 'KOKPAR FIELD', dir: dirTo(12, 14, KOKPAR.x, KOKPAR.z) }, { text: 'SUMMER CAMP', dir: dirTo(12, 14, SUMMER_YURTS.x, SUMMER_YURTS.z) }, { text: 'HORSE PLAINS', dir: dirTo(12, 14, HORSE_PLAINS.x, HORSE_PLAINS.z) }] },
  { x: -170, z: 22, boards: [{ text: 'KURGAN FIELD', dir: dirTo(-170, 22, KF.x, KF.z) }, { text: 'WATCHTOWER', dir: dirTo(-170, 22, WATCHTOWER.x, WATCHTOWER.z) }, { text: 'E ROAD', dir: dirTo(-170, 22, -250, 0) }] },
];

export function buildRoadFurniture(ctx: PoiCtx): PoiPiece {
  const { sky, ground } = ctx;
  const kit = new PaintKit(0x70ad);
  const set = new NalatiSet(kit, ctx);
  const run = (pts: [number, number][], o: { h?: number; spacing?: number } = {}): void => {
    const r = fenceRun(pts, o);
    set.paint(fence, { x: r.at.x, y: ground(r.at.x, r.at.z), z: r.at.z, yaw: 0 }, r.params);
  };

  // ── fences ──
  // N road, both sides, gate to the bridge; the west side opens for the camp spur
  run([[5.8, 244], [5.6, 232], [6.0, 221]]);
  run([[5.4, 209], [5.8, 196], [5.6, 190]]);
  run([[-5.8, 244], [-5.6, 224], [-5.9, 206], [-5.5, 190]]);
  // the camp spur's south side, and the pasture's paddock fence on its road side
  run([[9, 210], [26, 212.5], [42, 214.5], [60, 213]]);
  run([[PASTURE.x + PASTURE.r + 4, 242], [PASTURE.x + PASTURE.r + 3, 222], [PASTURE.x + PASTURE.r + 5, 200]], { h: 1.0, spacing: 2.8 });

  // ── signposts ──
  const lettered: { spots: BoardSpot[]; boards: Board[] }[] = [];
  for (const s of SIGNS) {
    const gy = ground(s.x, s.z);
    set.paint(signpost, { x: s.x, y: gy, z: s.z, yaw: 0 }, { boards: s.boards });
    lettered.push({ spots: boardSpots(s.x, s.z, gy, s.boards), boards: s.boards });
  }
  const mesh = kit.mesh(sky, { ground });
  mesh.name = 'nalati-roads';
  const wood = kit.texturedMesh(sky, 'rock', { ground });   // the fences + the sign posts (props.ts GRAIN)
  if (wood) wood.name = 'nalati-roads-wood';
  // the lettering: quads on both faces of every board, one atlas
  const text = letteringMesh(sky, lettered);
  const group = new THREE.Group();
  group.add(mesh, text);
  if (wood) group.add(wood);
  const tris = mesh.geometry.getAttribute('position').count / 3 + (text.geometry.index?.count ?? 0) / 3 + (wood ? wood.geometry.getAttribute('position').count / 3 : 0);
  return { name: 'roads', object: group, colliders: set.boxes, surface: 'wood', tris, register: (o) => set.register({ ...o, object: group }) };
}
