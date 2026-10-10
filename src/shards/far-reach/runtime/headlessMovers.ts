import type { SimHost } from '@wildshard/engine/sim';
import type { MoverData } from '@wildshard/sdk/movers';
import {
  createHeadlessMovers, stepHeadlessMovers, installHeadlessMovers,
  verifiedMoverModules as verifyModules, type MoverRuntimeInstance as MoverRuntime, type HeadlessMoverSet,
} from '@wildshard/sdk/runtime/movers';
import { SKY_MOVERS, WINCH_BRIDGE } from './moverRows';

/** Sky's static rope bridges already collide through the resident bake; the other rows own native platform bodies. */
export const HEADLESS_MOVERS: MoverData = SKY_MOVERS.filter(row => !row.id.startsWith('far.rope.'));

/** Hash-check and detach every admitted module before constructing a headless host. */
export function verifiedMoverModules(assets: ReadonlyMap<string, Uint8Array>, rows: MoverData = HEADLESS_MOVERS): Promise<ReadonlyMap<string, Uint8Array>> {
  return verifyModules(assets, rows);
}

/** Published mover poses and refused calls from Sky's installed platform owner. */
export interface SkyMovers { readonly runtime: MoverRuntime; failures: () => number }
/** Sky's scoped native ports and trusted bridge permission source. */
export interface SkyMoverPorts { physics: () => SimHost['physics']; scope: SimHost['scope']; restoring: boolean; permission: () => number }

/** Construct Sky's declared platforms without a tick; a caller explicitly drives the fixed clock. */
export function createSkyMovers(modules: ReadonlyMap<string, Uint8Array>, ports: SkyMoverPorts, rows: MoverData = HEADLESS_MOVERS): HeadlessMoverSet {
  return createHeadlessMovers(rows, modules, ports, new Map([[WINCH_BRIDGE, 0]]));
}

/** Publish one fixed tick with Sky's winch permission, retaining the same admitted motion law. */
export function stepSkyMovers(movers: Pick<HeadlessMoverSet, 'runtime' | 'host' | 'permissions'>, tick: number, permission: number): void {
  movers.permissions.set(WINCH_BRIDGE, permission); stepHeadlessMovers(movers, tick);
}

/** Install the shared platform owner with Sky's stable continuation key and trusted winch permission. */
export function installSkyMovers(host: SimHost, modules: ReadonlyMap<string, Uint8Array>, restoring: boolean, permission: () => number): SkyMovers {
  return installHeadlessMovers(host, HEADLESS_MOVERS, modules, {
    systemId: 'far.movers', restoring, initialPermissions: new Map([[WINCH_BRIDGE, 0]]),
    permissions: () => new Map([[WINCH_BRIDGE, permission()]]),
  });
}
