import catalogue from './singleplayer.json' with { type: 'json' };
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { parseGridCatalogue, type CopyIdentity, type GridMode } from './catalogue';

/** A world-space or cell-local point; authoritative simulations only receive the latter. */
export interface GridPoint { x: number; y: number; z: number }
/** Stable instance identity with its independent cell placement and derived rendering translation. */
export interface GridCell { readonly instance: string; readonly slug: string; readonly cell: readonly [number, number]; readonly origin: Readonly<GridPoint>;
  /** a shared product's copy identity, when the placement declares one (copyIdentity.ts) */
  readonly identity?: CopyIdentity }
/**
 * G198 / G219: an open plot. A platform cell with no shard: the platform draws its floor, its four entry showrooms and its
 * centrepiece (`openPlot.ts`) and owns its colliders, so it is road-like ground (never in `cells`, never a sim, a save
 * namespace, a crossing or a ring tile).
 */
export interface GridPlot { readonly instance: string; readonly cell: readonly [number, number]; readonly origin: Readonly<GridPoint> }
/** Neighbour queries use the same signed convention as the grid: north is positive z. */
export type GridSide = 'north' | 'east' | 'south' | 'west';
/** Outside the finite grid, seams ease into road-level open water and fog instead of another sim. */
export interface EmptyNeighbour {
  readonly kind: 'sea'; readonly level: 0;
  readonly fog: { readonly colour: readonly [number, number, number]; readonly near: number; readonly far: number };
  readonly edge: { readonly heights: readonly number[]; readonly colours: readonly (readonly [number, number, number])[]; readonly roadHeight: 0 };
}
const directions = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] } as const;
const finite = (point: GridPoint): void => { if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error('Grid coordinates must be finite'); };

/** Assemble the one platform catalogue without changing any shard's local simulation or standalone placement. */
export class GridAssembly {
  readonly cells: readonly GridCell[];
  /** the open plots left after the mode's overrides (an override on a plot's cell replaces the plot) */
  readonly plots: readonly GridPlot[];
  readonly pitch: number;
  readonly emptyNeighbour: EmptyNeighbour;
  private readonly byInstance: ReadonlyMap<string, GridCell>;
  private readonly byCell: ReadonlyMap<string, GridCell>;
  constructor(mode: GridMode, input: unknown = catalogue.grid) {
    const data = parseGridCatalogue(input), selected = new Map(data.cells.map((row) => [row.cell.join(','), row]));
    if (mode.developer) for (const row of data.developer) selected.set(row.cell.join(','), row);
    if (mode.devserver && mode.nineDragon !== false) for (const row of data.devserver) selected.set(row.cell.join(','), row);
    if (new Set([...selected.values()].map((row) => row.instance)).size !== selected.size) throw new Error('Duplicate assembled grid identity');
    this.pitch = data.pitch;
    this.cells = Object.freeze([...selected.values()].map((row): GridCell => Object.freeze({ instance: row.instance, slug: row.slug,
      cell: Object.freeze([row.cell[0], row.cell[1]] as const), origin: Object.freeze({ x: row.cell[0] * data.pitch, y: 0, z: row.cell[1] * data.pitch }),
      ...(row.identity === undefined ? {} : { identity: row.identity }) })));
    this.plots = Object.freeze(data.plots.filter((row) => !selected.has(row.cell.join(','))).map((row): GridPlot => Object.freeze({ instance: row.instance,
      cell: Object.freeze([row.cell[0], row.cell[1]] as const), origin: Object.freeze({ x: row.cell[0] * data.pitch, y: 0, z: row.cell[1] * data.pitch }) })));
    this.byInstance = new Map(this.cells.map((row) => [row.instance, row])); this.byCell = new Map(this.cells.map((row) => [row.cell.join(','), row]));
    const colour = Object.freeze([...data.emptyNeighbour.edgeColour] as const);
    this.emptyNeighbour = Object.freeze({ kind: 'sea', level: 0, fog: Object.freeze({ colour: Object.freeze([...data.emptyNeighbour.fog.colour] as const), near: data.emptyNeighbour.fog.near, far: data.emptyNeighbour.fog.far }),
      edge: Object.freeze({ roadHeight: 0, heights: Object.freeze(Array.from({ length: 257 }, () => 0)), colours: Object.freeze(Array.from({ length: 257 }, () => colour)) }) });
  }
  /** Resolve a stable save/fact identity, independent of its current cell. */
  cell(instance: string): GridCell { const row = this.byInstance.get(instance); if (row === undefined) throw new Error(`Unknown grid instance ${instance}`); return row; }
  /** Only cell interiors select a shard; strips/highway remain the platform frame. */
  at(x: number, z: number): GridCell | undefined {
    if (![x, z].every(Number.isFinite)) throw new Error('Grid coordinates must be finite');
    return this.cells.find((row) => Math.abs(x - row.origin.x) <= CHUNK_HALF && Math.abs(z - row.origin.z) <= CHUNK_HALF);
  }
  /** Adjacent cells or the explicit empty-neighbour seam profile. */
  neighbour(cell: GridCell, side: GridSide): GridCell | EmptyNeighbour {
    const [x, z] = directions[side]; return this.byCell.get(`${cell.cell[0] + x},${cell.cell[1] + z}`) ?? this.emptyNeighbour;
  }
  /** Rebase rendering to this cell; all visible cells subtract this origin from their render translations. */
  renderOrigin(cell: GridCell): GridPoint { return { ...cell.origin }; }
  /** Global placement never enters authoritative shard state. */
  local(point: GridPoint, cell: GridCell): GridPoint { finite(point); return { x: point.x - cell.origin.x, y: point.y, z: point.z - cell.origin.z }; }
  /** Convert a pose to world coordinates without mutating or respawning an actor. */
  world(point: GridPoint, cell: GridCell): GridPoint { finite(point); return { x: point.x + cell.origin.x, y: point.y, z: point.z + cell.origin.z }; }
  /** Horizontal cell/strip traversal belongs to the grid driver; the authored fall floor still recovers the player. */
  boundsMode(): boolean { return true; }
}
