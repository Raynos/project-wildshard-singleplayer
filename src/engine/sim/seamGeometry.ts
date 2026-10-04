import { edgeSample, edgeSampleLocations } from './edgeProfiles';
import { seamLatticeRows } from './seamLattice';
import type { StripCorner, StripMesh, StripProfile } from './strips';

/** Collision and rendering share these ordered triangle ranges; materials never reconstruct seam geometry. */
export type SeamFeatureKind = 'deck' | 'neutral-buffer' | 'gradient' | 'overlap' | 'retaining-wall' | 'cliff' | 'talus' | 'parapet' | 'dike' | 'culvert' | 'guard-rail' | 'road-wall' | 'turn-in';
/** Index offsets refer directly to the returned mesh, including every physical wall and rail face. */
export interface SeamFeature { readonly kind: SeamFeatureKind; readonly firstIndex: number; readonly indexCount: number; readonly side: -1 | 0 | 1; readonly from: number; readonly to: number; readonly bottom: number; readonly top: number; readonly sourceSurface?: string }
/** Admitted edge observations, with an explicit absence of blendable ground instead of an invented terrain height. */
export interface SeamEdge { readonly profile: StripProfile; readonly entryWidth: number; readonly geometry?: 'ground' | 'void'; readonly waterSurface?: number; readonly sourceSurface?: string; readonly outflows?: readonly { readonly from: number; readonly to: number }[] }
/** One midpoint turn-in per road segment; each present side supplies its admitted opening width. */
export interface SeamTurnIn { readonly at: 0; readonly widths: readonly [number, number] }
/** The exact physical mesh and its surface descriptions, without renderer or Rapier objects. */
export interface SeamGeometry { readonly mesh: StripMesh; readonly features: readonly SeamFeature[]; readonly turnIn: SeamTurnIn }
/** Every gradient has a vertex at most 2 m apart; the 6/10 m re-frame lines remain explicit vertices. */
export const SEAM_OFFSETS: readonly number[] = Object.freeze([...Array.from({ length: 11 }, (_, i) => -27.5 + i * 2), ...Array.from({ length: 11 }, (_, i) => 7.5 + i * 2)]);
const neutral = [0.25, 0.25, 0.25] as const;
const smooth = (t: number): number => t * t * (3 - 2 * t);
const bounded = (h: number): number => Math.max(-1.5, Math.min(6, h));
/** A corner's floor height: B, held at 0 or above for a shore corner (the §3.2 shore rule: B = max(0, clamp(H, −1.5, 6))). */
const cornerFloor = (corner: StripCorner): number => (corner.shore === true ? Math.max(0, bounded(corner.height)) : bounded(corner.height));
const blend = (u: number): number => smooth(Math.max(0, Math.min(1, (Math.abs(u) - 11.5) / 16)));
const tan85 = Math.tan(85 * Math.PI / 180);
// G101: single jump + autostep stays below this obstacle; double jump clears it.
const roadWallTop = 1.85, guardRailTop = 2;
type Point = readonly [number, number, number];

class MeshWriter {
  readonly positions: number[] = [];
  readonly colours: number[] = [];
  readonly indices: number[] = [];
  readonly features: SeamFeature[] = [];
  readonly axis: 'x' | 'z';
  constructor(axis: 'x' | 'z') { this.axis = axis; }
  vertex(u: number, y: number, v: number, colour: readonly number[] = neutral): number {
    const index = this.positions.length / 3;
    this.positions.push(...(this.axis === 'x' ? [u, y, v] : [v, y, u])); this.colours.push(...colour); return index;
  }
  quad(points: readonly [Point, Point, Point, Point], feature: Omit<SeamFeature, 'firstIndex' | 'indexCount'>): void {
    const firstIndex = this.indices.length, at = points.map(([u, y, v]) => this.vertex(u, y, v));
    const [a, b, c, d] = at;
    if (a === undefined || b === undefined || c === undefined || d === undefined) throw new Error('Missing seam face');
    this.indices.push(...(this.axis === 'x' ? [a, b, c, b, d, c] : [a, c, b, b, c, d])); this.features.push({ ...feature, firstIndex, indexCount: 6 });
  }
  box(u: number, v0: number, v1: number, bottom: number, top: number, thickness: number, feature: Omit<SeamFeature, 'firstIndex' | 'indexCount'>): void {
    const firstIndex = this.indices.length, left = u - thickness / 2, right = u + thickness / 2;
    const a: Point = [left, bottom, v0], b: Point = [right, bottom, v0], c: Point = [left, top, v0], d: Point = [right, top, v0];
    const e: Point = [left, bottom, v1], f: Point = [right, bottom, v1], g: Point = [left, top, v1], h: Point = [right, top, v1];
    const start = this.features.length;
    for (const points of [[a, b, c, d], [e, g, f, h], [a, c, e, g], [b, f, d, h], [c, d, g, h], [a, e, b, f]] as const) this.quad(points, feature);
    this.features.splice(start); this.features.push({ ...feature, firstIndex, indexCount: this.indices.length - firstIndex });
  }
  mesh(origin: { readonly x: number; readonly z: number }): StripMesh { return { origin: { ...origin }, positions: new Float32Array(this.positions), colours: new Float32Array(this.colours), indices: new Uint32Array(this.indices) }; }
}

function validateEdge(edge: SeamEdge): void {
  if (!Number.isFinite(edge.entryWidth) || edge.entryWidth < 0 || edge.entryWidth > 15
    || (edge.waterSurface !== undefined && (!Number.isFinite(edge.waterSurface) || Math.abs(edge.waterSurface) > 250))
    || edge.outflows?.some((row) => !Number.isFinite(row.from) || !Number.isFinite(row.to) || row.from < -250 || row.to > 250 || row.from >= row.to)) throw new RangeError('Invalid seam edge observations');
  if (edge.entryWidth > 0) {
    const locations = [...edgeSampleLocations([edge.profile]).filter((at) => Math.abs(at) <= edge.entryWidth / 2), -edge.entryWidth / 2, 0, edge.entryWidth / 2];
    if (locations.some((at) => Math.abs(edgeSample(edge.profile, at).height) > 0.02)) throw new RangeError('Midpoint entry boundary must meet road height zero');
  }
}
/** The 85° cliff and its 4 m talus fit inside w=4..20. An edge above this envelope refuses instead of becoming vertical. */
function cliffFoot(id: string, side: number, height: number, along: number, cornerWeight = 1): { u: number; bottom: number } {
  const base = (w: number): number => bounded(height) * smooth((w - 4) / 16) * cornerWeight + 1.5;
  if (height - base(8) > 12 * tan85) throw new RangeError(`Platform seam ${id} edge ${side} at ${along}: H=${height} exceeds the 85-degree cliff/talus envelope`);
  let low = 8, high = 20;
  for (let i = 0; i < 48; i++) { const mid = (low + high) / 2; if (height - base(mid) > (20 - mid) * tan85) high = mid; else low = mid; }
  const w = (low + high) / 2; return { u: 7.5 + w, bottom: base(w) };
}

/** Build the G90 corridor, preserving all native sample locations and using the same triangles for every world and the renderer. */
export function seamGeometry(input: { readonly id: string; readonly axis: 'x' | 'z'; readonly origin: { readonly x: number; readonly z: number }; readonly edges: readonly [SeamEdge, SeamEdge] }): SeamGeometry {
  input.edges.forEach(validateEdge);
  const native = edgeSampleLocations(input.edges.map((edge) => edge.profile));
  const along = [...new Set([...native, 0, ...input.edges.flatMap((edge) => [-edge.entryWidth / 2, edge.entryWidth / 2]), ...input.edges.flatMap((edge) => edge.outflows?.flatMap((row) => [row.from, row.to]) ?? [])])].sort((a, b) => a - b);
  const writer = new MeshWriter(input.axis), count = SEAM_OFFSETS.length;
  const floorGroups = new Map<string, { kind: SeamFeatureKind; side: -1 | 0 | 1; indices: number[] }>();
  for (const v of along) for (const u of SEAM_OFFSETS) {
    const edge = input.edges[u < 0 ? 0 : 1], sample = edgeSample(edge.profile, v), weight = blend(u);
    writer.vertex(u, weight === 0 ? 0 : bounded(sample.height) * weight, v, neutral.map((c, channel) => c + ((sample.colour[channel] ?? c) - c) * weight));
  }
  const retained = seamLatticeRows({ positions: writer.positions, colours: writer.colours, columns: count, along });
  const columns = Array.from({ length: count }, (_, col) => col);
  for (let band = 1; band < columns.length; band++) {
    const col = columns[band], previous = columns[band - 1];
    if (col === undefined || previous === undefined) throw new Error('Missing seam band');
    const u0 = SEAM_OFFSETS[previous] ?? 0, u1 = SEAM_OFFSETS[col] ?? 0;
    const side = u1 <= -7.5 ? -1 : u0 >= 7.5 ? 1 : 0;
    const kind = side === 0 ? 'deck' : Math.max(Math.abs(u0), Math.abs(u1)) <= 11.5 ? 'neutral-buffer' : 'gradient';
    const key = `${kind}/${side}`, group = floorGroups.get(key) ?? { kind, side, indices: [] };
    const left = retained[previous], right = retained[col];
    if (left === undefined || right === undefined) throw new Error('Missing seam column');
    let l = 0, r = 0;
    const triangle = (a: number, b: number, c: number): void => { group.indices.push(...(input.axis === 'x' ? [a, b, c] : [a, c, b])); };
    while (l < left.length - 1 || r < right.length - 1) {
      const a = (left[l] ?? 0) * count + previous, b = (right[r] ?? 0) * count + col;
      const nextLeft = left[l + 1] ?? Infinity, nextRight = right[r + 1] ?? Infinity;
      if (nextLeft === nextRight) {
        const c = nextLeft * count + previous, d = nextRight * count + col;
        triangle(a, c, d); triangle(a, d, b); l++; r++;
      } else if (nextLeft < nextRight) { triangle(a, nextLeft * count + previous, b); l++; }
      else { triangle(a, nextRight * count + col, b); r++; }
    }
    floorGroups.set(key, group);
  }
  for (const group of floorGroups.values()) {
    const firstIndex = writer.indices.length; writer.indices.push(...group.indices);
    writer.features.push({ kind: group.kind, side: group.side, firstIndex, indexCount: group.indices.length, from: -250, to: 250, bottom: -1.5, top: 6 });
  }
  for (const [edgeIndex, edge] of input.edges.entries()) {
    const side = edgeIndex === 0 ? -1 : 1;
    const runs = new Map<number, number>(); let start = -1;
    for (let row = 0; row < along.length; row++) {
      const at = along[row] ?? 0, high = edgeSample(edge.profile, at).height > 14;
      if (high && start < 0) start = row;
      if ((!high || row === along.length - 1) && start >= 0) {
        const end = high ? row : row - 1, length = (along[end] ?? 0) - (along[start] ?? 0);
        for (let i = start; i < end; i++) runs.set(i, length); start = -1;
      }
    }
    // Keep the full native apron lattice, even when the adjacent bands are flat.
    for (let row = 0; row < along.length - 1; row++) {
      const from = along[row] ?? 0, to = along[row + 1] ?? 0;
      const a = edgeSample(edge.profile, from).height, b = edgeSample(edge.profile, to).height, min = Math.min(a, b), max = Math.max(a, b);
      // The shared native row stays at the cell boundary. A quarter-metre same-mesh apron
      // continues its upper surface under regional terrain so KCC never meets an open seam edge.
      const ia: Point = [side * 27.5, a, from], ib: Point = [side * 27.5, b, to], oa: Point = [side * 27.75, a, from], ob: Point = [side * 27.75, b, to];
      writer.quad(side < 0 ? [ia, oa, ib, ob] : [ia, ib, oa, ob], { kind: 'overlap', side, from, to, bottom: min, top: max,
        ...(edge.sourceSurface === undefined ? {} : { sourceSurface: edge.sourceSurface }) });
    }
    const guarded = (row: number): boolean => {
      const from = along[row] ?? 0, to = along[row + 1] ?? 0;
      if (Math.abs((from + to) / 2) < edge.entryWidth / 2) return false;
      const a = edgeSample(edge.profile, from).height, b = edgeSample(edge.profile, to).height;
      return Math.max(a, b) > 14 || Math.min(a, b) < -1.5 || edge.geometry === 'void';
    };
    // Guard heights do not follow H: one continuous solid replaces the old
    // coplanar boxes even when the protected cliff changes at every native sample.
    for (let row = 0; row < along.length - 1;) {
      if (!guarded(row)) { row++; continue; }
      let end = row + 1;
      while (end < along.length - 1 && guarded(end)) end++;
      const from = along[row] ?? 0, to = along[end] ?? 0;
      const feature = (kind: SeamFeatureKind, bottom: number, top: number): Omit<SeamFeature, 'firstIndex' | 'indexCount'> => ({ kind, side, from, to, bottom, top,
        ...(edge.sourceSurface === undefined ? {} : { sourceSurface: edge.sourceSurface }) });
      writer.box(side * 7.5, from, to, 0, roadWallTop, 0.25, feature('road-wall', 0, roadWallTop));
      writer.box(side * 7.5, from, to, roadWallTop, guardRailTop, 0.15, feature('guard-rail', roadWallTop, guardRailTop));
      row = end;
    }
    const classification = (row: number): string => {
      const middle = ((along[row] ?? 0) + (along[row + 1] ?? 0)) / 2;
      return `${Math.abs(middle) < edge.entryWidth / 2}/${(runs.get(row) ?? 0) >= 30}/${edge.outflows?.some(flow => middle >= flow.from && middle <= flow.to) ?? false}`;
    };
    for (let row = 0; row < along.length - 1;) {
      let end = row + 1;
      const from = along[row] ?? 0, a = edgeSample(edge.profile, from).height;
      // Merge only identical-height physical faces, never across an opening,
      // outflow, changing profile or cliff/retaining-treatment boundary.
      if (edgeSample(edge.profile, along[end] ?? 0).height === a) {
        while (end < along.length - 1 && classification(end) === classification(row)
          && edgeSample(edge.profile, along[end + 1] ?? 0).height === a) end++;
      }
      const to = along[end] ?? 0, middle = (from + to) / 2;
      const b = edgeSample(edge.profile, to).height, min = Math.min(a, b), max = Math.max(a, b);
      const cliff = max > 14 && (runs.get(row) ?? 0) >= 30;
      row = end;
      const feature = (kind: SeamFeatureKind, bottom: number, top: number): Omit<SeamFeature, 'firstIndex' | 'indexCount'> => ({ kind, side, from, to, bottom, top, ...(edge.sourceSurface === undefined ? {} : { sourceSurface: edge.sourceSurface }) });
      if (Math.abs(middle) < edge.entryWidth / 2) continue;
      if (cliff) {
        const fa = cliffFoot(input.id, side, a, from), fb = cliffFoot(input.id, side, b, to);
        writer.quad([[side * fa.u, fa.bottom, from], [side * fb.u, fb.bottom, to], [side * 27.5, a, from], [side * 27.5, b, to]], feature('cliff', Math.min(fa.bottom, fb.bottom), max));
        writer.quad([[side * (fa.u - 4), bounded(a) * blend(fa.u - 4), from], [side * (fb.u - 4), bounded(b) * blend(fb.u - 4), to], [side * fa.u, fa.bottom, from], [side * fb.u, fb.bottom, to]], feature('talus', Math.min(fa.bottom, fb.bottom) - 1.5, Math.max(fa.bottom, fb.bottom)));
      } else if (max > 6 || min < -1.5) {
        // Coordinator G90 gap decision: isolated >14 m runs shorter than30 m retain a face; never widen them over a legal entry.
        writer.quad([[side * 27.5, bounded(a), from], [side * 27.5, bounded(b), to], [side * 27.5, a, from], [side * 27.5, b, to]], feature(max > 6 ? 'retaining-wall' : 'parapet', min, max));
      }
      const outflow = edge.outflows?.some((flow) => middle >= flow.from && middle <= flow.to) ?? false;
      if (edge.waterSurface !== undefined && edge.waterSurface > 0 && !outflow) writer.box(side * 27.4, from, to, Math.min(bounded(a), bounded(b)), Math.max(1.3, edge.waterSurface + 0.5), 0.2, feature('dike', min, Math.max(1.3, edge.waterSurface + 0.5)));
      if (outflow) writer.quad([[side * 27.5, bounded(a), from], [side * 27.5, bounded(b), to], [side * 7.5, -1.5, from], [side * 7.5, -1.5, to]], feature('culvert', -1.5, 0));
    }
  }
  return { mesh: writer.mesh(input.origin), features: writer.features, turnIn: { at: 0, widths: [input.edges[0].entryWidth, input.edges[1].entryWidth] } };
}

/** Four B-clamped corner fields join the corridors; physical faces turn10m around each corner, outside both road lanes. */
export function cornerSeamGeometry(input: { readonly id: string; readonly origin: { readonly x: number; readonly z: number }; readonly corners: readonly [StripCorner, StripCorner, StripCorner, StripCorner] }): { readonly mesh: StripMesh; readonly features: readonly SeamFeature[] } {
  if (input.corners.some((c) => !Number.isFinite(c.height) || Math.abs(c.height) > 250 || c.colour.some((n) => !Number.isFinite(n) || n < 0 || n > 1))) throw new RangeError('Invalid seam corner');
  const writer = new MeshWriter('x'), count = SEAM_OFFSETS.length;
  for (const z of SEAM_OFFSETS) for (const x of SEAM_OFFSETS) {
    const corner = input.corners[(z < 0 ? 0 : 2) + (x < 0 ? 0 : 1)];
    if (corner === undefined) throw new Error('Missing seam corner');
    const weight = blend(x) * blend(z);
    writer.vertex(x, weight === 0 ? 0 : cornerFloor(corner) * weight, z, neutral.map((c, i) => c + ((corner.colour[i] ?? c) - c) * weight));
  }
  const retained = seamLatticeRows({ positions: writer.positions, colours: writer.colours, columns: count, along: SEAM_OFFSETS, corner: true });
  for (let col = 1; col < count; col++) {
    const left = retained[col - 1], right = retained[col];
    if (left === undefined || right === undefined) throw new Error('Missing corner column');
    let l = 0, r = 0;
    while (l < left.length - 1 || r < right.length - 1) {
      const a = (left[l] ?? 0) * count + col - 1, b = (right[r] ?? 0) * count + col;
      const nextLeft = left[l + 1] ?? Infinity, nextRight = right[r + 1] ?? Infinity;
      if (nextLeft === nextRight) {
        const c = nextLeft * count + col - 1, d = nextRight * count + col;
        writer.indices.push(a, c, b, b, c, d); l++; r++;
      } else if (nextLeft < nextRight) { writer.indices.push(a, nextLeft * count + col - 1, b); l++; }
      else { writer.indices.push(a, nextRight * count + col, b); r++; }
    }
  }
  writer.features.push({ kind: 'gradient', firstIndex: 0, indexCount: writer.indices.length, side: 0, from: -27.5, to: 27.5, bottom: -1.5, top: 6 });
  for (const [index, corner] of input.corners.entries()) {
    const sx = index % 2 === 0 ? -1 : 1, sz = index < 2 ? -1 : 1;
    for (const axis of ['x', 'z'] as const) {
      const across = axis === 'x' ? sx : sz, along = axis === 'x' ? sz : sx;
      const start = writer.positions.length / 3, before = writer.features.length;
      const from = along * 27.5, to = along * 17.5;
      const feature = (kind: SeamFeatureKind, bottom: number, top: number): Omit<SeamFeature, 'firstIndex' | 'indexCount'> => ({ kind, side: across, from: Math.min(from, to), to: Math.max(from, to), bottom, top });
      // G149: a shore corner's field stays at 0 (cornerFloor) and needs neither the drop face nor the road wall: the
      // strips' revetments close the shoreline and no cyan drop wall crosses it
      const h = corner.height, a = cornerFloor(corner), b = a * blend(to), shore = corner.shore === true;
      if (h > 14) {
        const fa = cliffFoot(input.id, across, h, from), fb = cliffFoot(input.id, across, h, to, blend(to));
        writer.quad([[across * fa.u, fa.bottom, from], [across * fb.u, fb.bottom, to], [across * 27.5, h, from], [across * 27.5, h, to]], feature('cliff', Math.min(fa.bottom, fb.bottom), h));
        writer.quad([[across * (fa.u - 4), bounded(h) * blend(fa.u - 4), from], [across * (fb.u - 4), bounded(h) * blend(fb.u - 4) * blend(to), to], [across * fa.u, fa.bottom, from], [across * fb.u, fb.bottom, to]], feature('talus', Math.min(a, b), Math.max(fa.bottom, fb.bottom)));
      } else if (h > 6 || (h < -1.5 && !shore)) writer.quad([[across * 27.5, a, from], [across * 27.5, b, to], [across * 27.5, h, from], [across * 27.5, h, to]], feature(h > 6 ? 'retaining-wall' : 'parapet', Math.min(h, a, b), Math.max(h, a, b)));
      if (h > 14 || (h < -1.5 && !shore)) {
        writer.box(across * 7.5, Math.min(from, to), Math.max(from, to), 0, roadWallTop, 0.25, feature('road-wall', 0, roadWallTop));
        writer.box(across * 7.5, Math.min(from, to), Math.max(from, to), roadWallTop, guardRailTop, 0.15, feature('guard-rail', roadWallTop, guardRailTop));
      }
      if (axis === 'z') {
        for (let vertex = start; vertex < writer.positions.length / 3; vertex++) {
          const x = writer.positions[vertex * 3] ?? 0; writer.positions[vertex * 3] = writer.positions[vertex * 3 + 2] ?? 0; writer.positions[vertex * 3 + 2] = x;
        }
        for (let f = before; f < writer.features.length; f++) {
          const range = writer.features[f]; if (range === undefined) continue;
          for (let i = range.firstIndex; i < range.firstIndex + range.indexCount; i += 3) {
            const aIndex = writer.indices[i]; writer.indices[i] = writer.indices[i + 1] ?? 0; writer.indices[i + 1] = aIndex ?? 0;
          }
        }
      }
    }
  }
  return { mesh: writer.mesh(input.origin), features: writer.features };
}
