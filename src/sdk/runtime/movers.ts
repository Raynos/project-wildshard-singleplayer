import {
  MoverRuntime as PlatformMoverRuntime, createMoverHost as platformCreateMoverHost,
  moverQueries as platformMoverQueries, installDeclaredMovers as platformInstallDeclaredMovers,
  type MoverInstallation as PlatformInstallation, type MoverView as PlatformView, type MoverPorts as PlatformPorts,
} from '@wildshard/game/shardfile/moverRuntime';

/** Presentation recipes read published poses and may adopt an existing native chain. */
export type MoverView = PlatformView;
/** Declared rows, admitted modules and trusted presentation callbacks for page installation. */
export type MoverInstallation = PlatformInstallation;
/** Explicit native physics, script host and scoped ownership. */
export type MoverPorts = PlatformPorts;
/** Native platform and chain ownership driven by admitted mover scripts. */
export const MoverRuntime: typeof PlatformMoverRuntime = PlatformMoverRuntime;
/** An installed native mover runtime. */
export type MoverRuntimeInstance = PlatformMoverRuntime;
/** Admit declared mover modules and create their explicit script host. */
export const createMoverHost: typeof platformCreateMoverHost = platformCreateMoverHost;
/** Read declared parameters through the trusted calling entity and retain physics queries. */
export const moverQueries: typeof platformMoverQueries = platformMoverQueries;
/** Install the page's scoped fixed-step platform ownership from declared rows. */
export const installDeclaredMovers: typeof platformInstallDeclaredMovers = platformInstallDeclaredMovers;
