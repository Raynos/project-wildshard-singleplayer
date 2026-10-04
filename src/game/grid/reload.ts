import type { Scope } from '@wildshard/engine/app/scope';
import type { SaveStore } from '@wildshard/engine/saves/store';
import { hudSlots } from '@wildshard/engine/ui/hudSlots';
import type { GridAssembly } from './assembly';
import type { LiveGridSession } from './liveSession';
import { devserverCellOn } from './debug';
import { gridMode } from './menu';
import { GridReloadExit, gridReloadSlot, gridReloadDeck, validGridReload, type GridReloadHandoff } from './reloadHandoff';
import { gridReloadRevision } from './reloadRevision';
import { RoadReload } from './roadReload';
import { replaceTravelDocument } from '../travel/travel';
import './reload.css';

/** Existing page ports; the installer adds no simulation loop or inventory transfer. */
export interface GridReloadHost {
  readonly scope: Scope; readonly store: SaveStore; readonly assembly: GridAssembly;
  readonly live: Pick<LiveGridSession, 'frame' | 'worldFeet' | 'roadPoint' | 'checkpointInstance' | 'bindReloadStatus'>
    & { readonly live: Pick<LiveGridSession['live'], 'ready'> };
  readonly homeSlug: string; readonly grounded: () => boolean;
  readonly admit?: () => boolean;
  readonly capture: () => Pick<GridReloadHandoff, 'heading' | 'mount' | 'loadout' | 'clock'>;
  readonly hold: (held: boolean) => void;
  readonly onFixed: (run: () => void) => void;
  readonly report: (error: unknown) => void;
}

/** One scoped document fade; disposal also settles pending timing without letting an exit navigate. */
export function gridReloadFade(scope: Scope, opaque = false): { out: () => Promise<void>; into: () => void } {
  const layer = scope.ownNode(document.createElement('div'));
  layer.className = 'ws-grid-reload'; layer.classList.toggle('opaque', opaque);
  layer.setAttribute('aria-hidden', 'true'); hudSlots.widget('band.1', layer, 0, scope);
  return {
    out: () => new Promise<void>((resolve) => {
      layer.classList.add('opaque');
      const forget = scope.capture('disposers', resolve);
      scope.timeout(250, () => { forget(); resolve(); });
    }),
    into: () => { layer.classList.remove('opaque'); scope.timeout(250, () => { hudSlots.discard(layer); }); },
  };
}

/** Default-off composition calls this only for a grid page. A real admitted interior visit arms its next road exit. */
export function installGridReload(host: GridReloadHost): void {
  const scope = host.scope.child('grid.reload'), fade = gridReloadFade(scope);
  const mode = gridMode(devserverCellOn());
  const reload = new RoadReload({ grid: host.assembly, report: host.report,
    capture: async (instance) => {
      const cell = host.assembly.cell(instance), feet = host.live.worldFeet(), state = host.capture();
      const point = host.live.roadPoint();
      if (point === null) throw new Error('Planned exit has no safe road recovery point');
      const revision = await gridReloadRevision(host.assembly, instance, scope);
      // A lane snap beside a junction may land on its island. The currently grounded asphalt is a safe fallback.
      const recovery = gridReloadDeck(host.assembly, point.x, point.z) ? point : { x: feet.x, z: feet.z, yaw: state.heading };
      const value: GridReloadHandoff = { v: 1, mode: 'grid', layout: { ...mode, nineDragon: mode.nineDragon ?? false },
        instance, revision, cell: [...cell.cell], roadPose: { ...feet }, ...state,
        recovery: { lastSafeRoadPoint: recovery, state: 'on-road' }, at: Date.now() };
      if (!validGridReload(value, host.assembly, () => revision, Date.now())) throw new Error('Planned exit has no valid road transfer');
      return value;
    },
    transaction: (source) => new GridReloadExit({ slot: gridReloadSlot(host.store), hold: host.hold,
      ...(host.admit === undefined ? {} : { admit: host.admit }),
      checkpoint: () => host.live.checkpointInstance(source), fade: fade.out,
      navigate: () => {
        const url = new URL('/', location.origin); url.searchParams.set('chunk', host.homeSlug);
        replaceTravelDocument(url.href, 'planned grid road exit (fresh page)');
      } }),
  });
  host.live.bindReloadStatus(() => reload.state(), scope);
  host.onFixed(() => {
    if (scope.disposed) return;
    const feet = host.live.worldFeet();
    reload.step({ instance: host.live.frame(), inside: host.assembly.at(feet.x, feet.z)?.instance ?? null,
      feet, grounded: host.grounded(), ready: host.live.live.ready(null) });
  });
  scope.onDispose(() => { reload.dispose(); host.hold(false); });
}
