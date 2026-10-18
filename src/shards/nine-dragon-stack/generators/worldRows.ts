import { Box3, Color, Matrix4, Vector3, type BufferGeometry } from 'three';
import { NINE_LAYOUT_PLAN } from '../data/layoutPlan';
import { SHEET_LAYERS, STEAM_PUFFS } from '../data/worldDressing';
import { NINE_FLOOR_PLAN } from '../data/floorPlan';
import { RIM, SHAFT, WELL_RECTS } from './wellBounds';
import { STAIR_TOP } from './fragmentFloor';
import { stairFloor, stairPlanData } from './stairPlan';
import { restoreQueued, takeLions, lionShares } from './props3d';
import { dealCrowd } from './crowd';
import { castGeometry } from './casts';
import { portalPlanRows } from './portalEntries';
import { tintAbove } from './lods';
import { BAKED, DRAWN_AS, SMALL, isPiece, type PieceId } from './facadeIds';
import { LayoutRowsSchema, WorldRowsSchema, type WorldRows } from './sections';
import * as v from 'valibot';


const stair = stairPlanData();

const { PLAZA, STREET, STAIR, WELL, Y0 } = NINE_LAYOUT_PLAN;

/** Compile placement queues and floor laws into immutable rows; no client queue or geometry scan remains. */
export async function worldRows(input: unknown, records: readonly number[], read: (url: string) => Uint8Array): Promise<{ rows: WorldRows; records: number[] }> {
  const rows = v.parse(LayoutRowsSchema, input), c = rows.counts, values: number[] = [];
  const store = (row: readonly number[]): number => { const at = values.length; for (const value of row) values.push(value); return at; };
  let offset = 0;
  const matrices = (count: number): Matrix4[] => Array.from({ length: count }, () => {
    const matrix = records.slice(offset, offset + 16); offset += 16;
    if (matrix.length !== 16) throw new Error('Nine world placement records are incomplete');
    return new Matrix4().fromArray(matrix);
  });
  const walkers = matrices(c.walkers), sitters = matrices(c.sitters);
  offset += (c.lanterns + c.acs) * 16 + (c.hooks + c.steam) * 3 + c.hookMounts * 6
    + c.pieces * 19 + c.windows * 26 + rows.inst.reduce((sum, [, count]) => sum + count * 19, 0);
  restoreQueued(matrices(c.lions), []);
  const lions = takeLions().map(matrix => store(matrix.toArray())), shares = lionShares();
  const sets = rows.sets.map(row => ({ ...row, frames: matrices(row.count).map(matrix => store(matrix.toArray())) }));
  if (offset !== records.length) throw new Error('Nine world placement inventory differs');
  const geometry = new Map<string, BufferGeometry>();
  for (const name of ['walker-dark', 'walker-light', 'sitter-dark', 'sitter-light'] as const) geometry.set(name, await castGeometry(name, read));
  const need = (key: string): BufferGeometry => { const value = geometry.get(key); if (value === undefined) throw new Error(`Missing crowd cast ${key}`); return value; };
  geometry.set('walker-oxblood', tintAbove(need('walker-dark'), 0x9a2e1c));
  geometry.set('walker-paper', tintAbove(need('walker-light'), 0xb07a34));
  const crowd = dealCrowd(walkers, sitters, { walker: pick => need(`walker-${pick}`), sitter: pick => need(`sitter-${pick}`) });
  const frames = (groups: readonly (readonly [string, readonly Matrix4[]])[]) => groups.flatMap(([variant, copies]) => copies.map(matrix => ({ variant, matrix: store(matrix.toArray()) })));
  const dealt = { walkers: frames(crowd.walkers), sitters: frames(crowd.sitters) };
  for (const value of geometry.values()) value.dispose();
  const rect = (x0: number, z0: number, x1: number, z1: number, y: number) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2, y });
  const cuts = [...new Set([STAIR.x0, STAIR.x1, STAIR_TOP.x1, ...stair.FLIGHTS.flatMap(flight => Array.from({ length: flight.steps + 1 }, (_, i) => flight.x0 + i * stair.RUN)), ...stair.LANDINGS.flatMap(landing => [landing.x0, landing.x1])])].sort((a, b) => b - a).filter((value, index, all) => index === 0 || Math.abs(value - (all[index - 1] ?? value)) > 1e-9);
  const floors = [rect(PLAZA.x0, PLAZA.z0, PLAZA.x1 + 0.6, PLAZA.z1 + 0.6, Y0), rect(STREET.x0, NINE_FLOOR_PLAN.fronts.streetEnd, STREET.x1, PLAZA.z0, Y0), rect(WELL.x0, RIM.z0, WELL.x1, RIM.z1, Y0)];
  for (let i = 1; i < cuts.length; i++) {
    const hi = cuts[i - 1], lo = cuts[i];
    if (hi === undefined || lo === undefined) throw new Error('Missing stair span');
    const y = stairFloor((lo + hi) / 2);
    floors.push({ ...rect(lo, STAIR.z0, hi, STAIR.z1, y), hw: (hi - lo) / 2 + 1e-12 });
  }
  const rim = new Set(['well-rim', 'well-r']);
  const regions = [
    { key: 'lantern-square', name: 'Lantern Square', extra: 'square', kit: (name: string) => name === 'paifang' },
    { key: 'stair-street', name: 'The stair-street', extra: 'stair', kit: (name: string) => name.startsWith('stair-') },
    { key: 'well-rim', name: 'The Well rim', extra: 'rim', kit: (name: string) => rim.has(name) },
    { key: 'crossings', name: "The Well's crossings", extra: '', kit: (name: string) => name.startsWith('well-c-') },
    { key: 'well-galleries', name: "The Well's galleries", extra: 'well', kit: (name: string) => name.startsWith('well-') && !rim.has(name) && !name.startsWith('well-c-') },
  ].map(row => ({ id: `nine-dragon-stack/${row.key}`, name: row.name, place: `nine-dragon-stack/${row.key}`, extra: row.extra,
    kits: [...new Set(rows.inKit.map(copy => copy.kit))].filter(row.kit) }));
  const portalLanterns = portalPlanRows().decks.flatMap(p => [-1, 1].map(sign => {
    const side = portalPlanRows().ring.r + 0.9;
    return store(new Matrix4().makeScale(1.1, 1.1, 1.1).setPosition(p.x + p.nx * 1.75 - p.nz * side * sign, 4.4, p.z + p.nz * 1.75 + p.nx * side * sign).toArray());
  }));
  // Resolve aliases, material tints and merged-copy boxes once, on the author.
  offset = (c.walkers + c.sitters + c.lanterns + c.acs) * 16 + (c.hooks + c.steam) * 3 + c.hookMounts * 6;
  const groups = new Map<PieceId, { matrix: number[]; color: number[] }[]>();
  const merged = new Map(rows.merged);
  const baked = new Map<PieceId, { poses: { matrix: number[]; color: number[] }[]; boxes: number[] }>();
  for (const piece of rows.pieces) {
    if (!isPiece(piece)) throw new Error(`Unknown facade piece ${piece}`);
    const matrix = matrices(1)[0]; if (matrix === undefined) throw new Error('Missing facade matrix');
    const color = new Color().fromArray(records.slice(offset, offset + 3)); offset += 3;
    if (BAKED.has(piece)) {
      const bounds = merged.get(piece); if (bounds === undefined) throw new Error(`Missing merged bounds ${piece}`);
      const box = new Box3(new Vector3(bounds[0], bounds[1], bounds[2]), new Vector3(bounds[3], bounds[4], bounds[5])).applyMatrix4(matrix);
      const group = baked.get(piece) ?? { poses: [], boxes: [] };
      group.poses.push({ matrix: matrix.toArray(), color: color.toArray() }); group.boxes.push(...box.min, ...box.max); baked.set(piece, group);
    } else {
      const alias = DRAWN_AS[piece], id = alias?.as ?? piece;
      if (alias !== undefined) { matrix.multiply(alias.local); color.multiply(new Color(alias.tint)); }
      const group = groups.get(id) ?? []; group.push({ matrix: matrix.toArray(), color: color.toArray() }); groups.set(id, group);
    }
  }
  const poseRecords = (poses: readonly { matrix: number[]; color: number[] }[]): number => store(poses.flatMap(pose => pose.matrix.concat(pose.color)));
  const facade = { drawn: [...groups].map(([id, poses]) => ({ id, poses: poseRecords(poses), count: poses.length, small: SMALL.has(id) })),
    baked: [...baked].map(([id, group]) => ({ id, poses: poseRecords(group.poses), count: group.poses.length, boxes: store(group.boxes) })) };
  return { rows: v.parse(WorldRowsSchema, { records: values.length, sheetLayers: SHEET_LAYERS, steamPuffs: STEAM_PUFFS, facade, portalLanterns, lions, shares, sets, crowd: dealt, floors, regions, shaft: SHAFT, wellRects: WELL_RECTS, rim: RIM, crossings: rows.crossings, sheets: rows.sheets }), records: values };
}
