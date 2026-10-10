import {
  MoverRuntime as PlatformMoverRuntime, createMoverHost as platformCreateMoverHost,
  moverQueries as platformMoverQueries, installDeclaredMovers as platformInstallDeclaredMovers,
  verifiedMoverModules as platformVerifiedMoverModules, createHeadlessMovers as platformCreateHeadlessMovers,
  stepHeadlessMovers as platformStepHeadlessMovers, installHeadlessMovers as platformInstallHeadlessMovers,
  type MoverInstallation as PlatformInstallation, type MoverView as PlatformView, type MoverPorts as PlatformPorts,
  type HeadlessMovers as PlatformHeadlessMovers, type HeadlessMoverSet as PlatformHeadlessSet,
  type HeadlessMoverPorts as PlatformHeadlessPorts, type HeadlessMoverInstallation as PlatformHeadlessInstallation,
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
/** Published native poses and the count of refused headless script calls. */
export type HeadlessMovers = PlatformHeadlessMovers;
/** A caller-driven headless script host, entity world and permission table. */
export type HeadlessMoverSet = PlatformHeadlessSet;
/** Scoped native ownership and a getter that follows restored physics worlds. */
export type HeadlessMoverPorts = PlatformHeadlessPorts;
/** Stable fixed-system identity and trusted headless mover permissions. */
export type HeadlessMoverInstallation = PlatformHeadlessInstallation;
/** Detach and hash-check admitted guest bytes before constructing native movers. */
export const verifiedMoverModules: typeof platformVerifiedMoverModules = platformVerifiedMoverModules;
/** Construct native movers without advancing the caller's clock. */
export const createHeadlessMovers: typeof platformCreateHeadlessMovers = platformCreateHeadlessMovers;
/** Advance one caller-owned fixed tick and publish native mover poses. */
export const stepHeadlessMovers: typeof platformStepHeadlessMovers = platformStepHeadlessMovers;
/** Install fixed-step movers with exact guest memory and native handle continuation. */
export const installHeadlessMovers: typeof platformInstallHeadlessMovers = platformInstallHeadlessMovers;
