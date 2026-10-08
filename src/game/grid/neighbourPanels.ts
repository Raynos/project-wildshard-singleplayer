/**
 * A grid neighbour's declared panels (G222 playtest #7): the doors and gates a shardfile shows and hides through
 * `targets.panels`. The ring tiles carry only the baked props, so before this a neighbour's door was never drawn while its
 * region's collider still stood in the doorway: an invisible wall in a doorway that looked open, and a door that, once
 * opened, let the board into a hut that looked no different. Each cell now draws its panels in its own root and shows each
 * one exactly when its region says the panel is there: the region's collider state when the region is admitted (the
 * region's sim drives it from the published field, `syncTargetColliders`), else the field's declared default.
 *
 * Presentation only: nothing here writes a simulation, a field or a collider.
 */
import type { Group, Object3D } from 'three';
import type { ClientTileViews } from '../shardfile/clientViews';
import type { ShardfileSimulation } from '../shardfile/simulation';
import type { Shardfile } from '../shardfile/schema';
import type { GridCell } from './assembly';

/** What the panels read from the session: a cell's admitted region (absent until the live host admits it). */
/** The page scope the panels live and die with (the views' own scope type). */
type PageScope = Parameters<ClientTileViews['panels']>[3];
export interface NeighbourPanelPorts { readonly scope: PageScope; readonly simulation: (instance: string) => ShardfileSimulation | undefined }
type TargetRow = Shardfile['targets']['panels'][number];
interface Binding { readonly row: TargetRow; readonly panel: Object3D; readonly fallback: number }
interface CellPanels { readonly instance: string; readonly source: Shardfile; readonly bindings: readonly Binding[] }

/** A declared field default as the script world holds it (a bool is 0 / 1; text never matches a number). */
function numeric(value: boolean | number | string | undefined): number {
  return typeof value === 'boolean' ? Number(value) : typeof value === 'number' ? value : Number.NaN;
}

/**
 * Whether a target row's condition holds now: through its first collider's state when the region is admitted (that
 * collider is active exactly when `matched === activeWhenMatched`), else through the field (live, or its default).
 */
export function targetMatched(row: TargetRow, fallback: number, region: ShardfileSimulation | undefined, source: Shardfile): boolean {
  if (region !== undefined) {
    const id = row.colliders[0], port = id === undefined ? undefined : region.colliders.get(id);
    if (port !== undefined) return port.active() === row.activeWhenMatched;
    const field = source.state[row.scope].find((f) => f.id === row.fieldId), lane = region.lane;
    if (field !== undefined && lane !== undefined) return (lane.world.view(region.host.player.id)[row.scope][field.name] ?? fallback) === row.equals;
  }
  return fallback === row.equals;
}

/** The page's neighbour panels: one set per shardfile neighbour whose targets show or hide a panel; disposed with the scope. */
export class NeighbourPanels {
  private readonly ports: NeighbourPanelPorts;
  private readonly cells = new Map<string, CellPanels>();
  constructor(ports: NeighbourPanelPorts) { this.ports = ports; }

  /** Draw one neighbour's declared panels in its cell root (the session's shared per-slug load supplies views and bytes). */
  async admit(cell: GridCell, root: Group, source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, views: ClientTileViews): Promise<void> {
    const props = source.props;
    if (props === null || props.panels.length === 0 || source.targets.panels.length === 0 || this.cells.has(cell.instance)) return;
    const panels = await views.panels(props, assets, root, this.ports.scope);
    if (this.ports.scope.disposed) return;
    const bindings = source.targets.panels.map((row): Binding => {
      const panel = panels.get(row.panel); if (panel === undefined) throw new Error('Missing admitted target panel');
      const field = source.state[row.scope].find((f) => f.id === row.fieldId);
      return { row, panel, fallback: numeric(field?.default) };
    });
    const cellPanels: CellPanels = { instance: cell.instance, source, bindings };
    this.cells.set(cell.instance, cellPanels);
    this.sync(cellPanels);
  }

  /** The page's late phase: every panel shown exactly when its region has it standing. */
  late(): void { for (const cell of this.cells.values()) this.sync(cell); }

  /** The drawn panels' visibility per cell (tests and the probe). */
  state(): ReadonlyMap<string, readonly { panel: string; visible: boolean }[]> {
    return new Map([...this.cells].map(([id, cell]) => [id, cell.bindings.map((b) => ({ panel: b.row.panel, visible: b.panel.visible }))]));
  }

  private sync(cell: CellPanels): void {
    const region = this.ports.simulation(cell.instance);
    for (const { row, panel, fallback } of cell.bindings) panel.visible = targetMatched(row, fallback, region, cell.source) === row.visibleWhenMatched;
  }
}
