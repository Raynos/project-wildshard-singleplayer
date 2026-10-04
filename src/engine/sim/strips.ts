/** Deterministic platform seam data, independent of rendering, devices and physics wrappers. */
export interface StripProfile { readonly heights: readonly number[]; readonly colours: readonly (readonly number[])[]; readonly roadHeight: number }
/** Southwest, southeast, northwest and northeast outer corner values, in that order. */
export interface StripCorner { readonly height: number; readonly colour: readonly [number, number, number] }
/** A regional placement is used only to translate the platform's duplicate collider. */
export interface StripCell { readonly instance: string; readonly origin: { readonly x: number; readonly z: number } }
/** A triangle mesh is local to its origin. Colour triples use the same vertex ordering. */
export interface StripMesh { readonly origin: { readonly x: number; readonly z: number }; readonly positions: Float32Array; readonly indices: Uint32Array; readonly colours: Float32Array }
/** The highway owns the primary mesh; neighbouring worlds receive exact translated duplicates. */
export interface GeneratedStrip { readonly id: string; readonly mesh: StripMesh; readonly duplicates: readonly { readonly instance: string; readonly mesh: StripMesh }[] }
/** Declared edge data placed on an integer platform grid; placement never enters a regional simulation. */
export interface PlatformCell extends StripCell { readonly cell: readonly [number, number]; readonly edges: Readonly<Record<'north' | 'east' | 'south' | 'west', StripProfile>> }
/** The 55 m gap consists of two 20 m strips and a 15 m highway. Entries at 6/10 m are explicit mesh vertices. */
export const STRIP_OFFSETS: readonly number[] = Object.freeze([-27.5, -21.5, -17.5, -7.5, 7.5, 17.5, 21.5, 27.5]);
const neutral = [0.25, 0.25, 0.25] as const;
const smooth = (t: number): number => t * t * (3 - 2 * t);
function validate(profile: StripProfile): void {
  if (profile.heights.length !== 129 || profile.colours.length !== 129 || profile.roadHeight !== 0
    || profile.heights.some((h) => !Number.isFinite(h) || Math.abs(h) > 250)
    || profile.colours.some((c) => c.length !== 3 || c.some((v) => !Number.isFinite(v) || v < 0 || v > 1))) throw new RangeError('Invalid platform edge profile');
}
function build(id: string, origin: { x: number; z: number }, axis: 'x' | 'z', across: readonly number[], along: readonly number[], cells: readonly StripCell[], sample: (u: number, v: number) => { height: number; colour: readonly number[] }): GeneratedStrip {
  if (id.length === 0 || ![origin.x, origin.z].every(Number.isFinite) || new Set(cells.map((c) => c.instance)).size !== cells.length
    || cells.some((c) => c.instance.length === 0 || ![c.origin.x, c.origin.z].every(Number.isFinite))) throw new RangeError('Invalid platform placement');
  const positions = new Float32Array(across.length * along.length * 3), colours = new Float32Array(positions.length), indices: number[] = [];
  for (let row = 0; row < along.length; row++) for (let col = 0; col < across.length; col++) {
    const u = across[col] ?? 0, v = along[row] ?? 0, value = sample(u, v), at = (row * across.length + col) * 3;
    positions.set(axis === 'x' ? [u, value.height, v] : [v, value.height, u], at); colours.set(value.colour, at);
    if (col > 0 && row > 0) {
      const d = row * across.length + col, c = d - 1, b = d - across.length, a = b - 1;
      indices.push(...(axis === 'x' ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
    }
  }
  const mesh: StripMesh = { origin: { ...origin }, positions, indices: new Uint32Array(indices), colours };
  return { id, mesh, duplicates: cells.map((cell) => ({ instance: cell.instance, mesh: { ...mesh, origin: { x: origin.x - cell.origin.x, z: origin.z - cell.origin.z } } })) };
}
/** Both profiles run in positive lateral order (south→north or west→east); no neighbour reversal is implicit. */
export function generateStrip(input: { id: string; axis: 'x' | 'z'; origin: { x: number; z: number }; profiles: readonly [StripProfile, StripProfile]; adjacent: readonly StripCell[] }): GeneratedStrip {
  input.profiles.forEach(validate);
  const along = Array.from({ length: 129 }, (_, i) => -250 + i * 500 / 128);
  return build(input.id, input.origin, input.axis, STRIP_OFFSETS, along, input.adjacent, (u, v) => {
    const edge = input.profiles[u < 0 ? 0 : 1], i = Math.round((v + 250) * 128 / 500), weight = smooth(Math.max(0, (Math.abs(u) - 7.5) / 20));
    const colour = edge.colours[i] ?? neutral;
    return { height: (edge.heights[i] ?? 0) * weight, colour: neutral.map((c, channel) => c + ((colour[channel] ?? c) - c) * weight) };
  });
}
/** Four corner samples meet the strips exactly, while both crossing highway lanes remain at road height zero. */
export function generateCrossroads(input: { id: string; origin: { x: number; z: number }; corners: readonly [StripCorner, StripCorner, StripCorner, StripCorner]; adjacent: readonly StripCell[] }): GeneratedStrip {
  if (input.corners.some((c) => !Number.isFinite(c.height) || Math.abs(c.height) > 250 || c.colour.some((v) => !Number.isFinite(v) || v < 0 || v > 1))) throw new RangeError('Invalid crossroads corner');
  return build(input.id, input.origin, 'x', STRIP_OFFSETS, STRIP_OFFSETS, input.adjacent, (x, z) => {
    const corner = input.corners[(z < 0 ? 0 : 2) + (x < 0 ? 0 : 1)];
    if (corner === undefined) throw new Error('Missing crossroads corner');
    const weight = smooth(Math.max(0, (Math.abs(x) - 7.5) / 20)) * smooth(Math.max(0, (Math.abs(z) - 7.5) / 20));
    return { height: corner.height * weight, colour: neutral.map((c, channel) => c + ((corner.colour[channel] ?? c) - c) * weight) };
  });
}

/** Generate every deck corridor and four-way junction, including the explicit empty-neighbour perimeter. */
export function generatePlatform(cells: readonly PlatformCell[], empty: StripProfile): readonly GeneratedStrip[] {
  validate(empty);
  if (cells.length === 0 || cells.length > 9 || new Set(cells.map((c) => c.instance)).size !== cells.length
    || new Set(cells.map((c) => c.cell.join(','))).size !== cells.length
    || cells.some((c) => c.cell.some((n) => !Number.isInteger(n) || Math.abs(n) > 1) || c.origin.x !== c.cell[0] * 555 || c.origin.z !== c.cell[1] * 555)) throw new RangeError('Invalid platform cells');
  for (const cell of cells) Object.values(cell.edges).forEach(validate);
  const byCell = new Map(cells.map((c) => [c.cell.join(','), c]));
  const xs = cells.map((c) => c.cell[0]), zs = cells.map((c) => c.cell[1]), minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const get = (x: number, z: number): PlatformCell | undefined => byCell.get(`${x},${z}`);
  const present = (rows: readonly (PlatformCell | undefined)[]): PlatformCell[] => rows.filter((c): c is PlatformCell => c !== undefined);
  const result: GeneratedStrip[] = [];
  for (let x = minX - 1; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
    const low = get(x, z), high = get(x + 1, z);
    result.push(generateStrip({ id: `gap.x.${x}.${z}`, axis: 'x', origin: { x: x * 555 + 277.5, z: z * 555 }, profiles: [low?.edges.east ?? empty, high?.edges.west ?? empty], adjacent: present([low, high]) }));
  }
  for (let z = minZ - 1; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
    const low = get(x, z), high = get(x, z + 1);
    result.push(generateStrip({ id: `gap.z.${x}.${z}`, axis: 'z', origin: { x: x * 555, z: z * 555 + 277.5 }, profiles: [low?.edges.north ?? empty, high?.edges.south ?? empty], adjacent: present([low, high]) }));
  }
  const corner = (cell: PlatformCell | undefined, horizontal: 'north' | 'south', vertical: 'east' | 'west'): StripCorner => {
    const a = cell?.edges[horizontal] ?? empty, b = cell?.edges[vertical] ?? empty, i = vertical === 'east' ? 128 : 0, j = horizontal === 'north' ? 128 : 0;
    const height = a.heights[i] ?? 0, otherHeight = b.heights[j] ?? 0, colour = a.colours[i], otherColour = b.colours[j];
    if (colour === undefined || otherColour === undefined || Math.abs(height - otherHeight) > 0.02 || colour.some((c, k) => Math.abs(c - (otherColour[k] ?? Infinity)) > 1e-6)) throw new RangeError('Authored corner edges disagree');
    return { height, colour: [colour[0] ?? 0, colour[1] ?? 0, colour[2] ?? 0] };
  };
  for (let x = minX - 1; x <= maxX; x++) for (let z = minZ - 1; z <= maxZ; z++) {
    const sw = get(x, z), se = get(x + 1, z), nw = get(x, z + 1), ne = get(x + 1, z + 1);
    result.push(generateCrossroads({ id: `cross.${x}.${z}`, origin: { x: x * 555 + 277.5, z: z * 555 + 277.5 }, corners: [corner(sw, 'north', 'east'), corner(se, 'north', 'west'), corner(nw, 'south', 'east'), corner(ne, 'south', 'west')], adjacent: present([sw, se, nw, ne]) }));
  }
  return result;
}
