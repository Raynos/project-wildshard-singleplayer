import type { SimHost } from '@wildshard/engine/sim';
import type { MoverData } from '@wildshard/sdk/movers';
import {
  installHeadlessMovers,
  verifiedMoverModules as verifyModules, type MoverRuntimeInstance as MoverRuntime,
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
/** Install the shared platform owner with Sky's stable continuation key and trusted winch permission. */
export function installSkyMovers(host: SimHost, modules: ReadonlyMap<string, Uint8Array>, restoring: boolean, permission: () => number): SkyMovers {
  return installHeadlessMovers(host, HEADLESS_MOVERS, modules, {
    systemId: 'far.movers', restoring, initialPermissions: new Map([[WINCH_BRIDGE, 0]]),
    permissions: () => new Map([[WINCH_BRIDGE, permission()]]),
  });
}
