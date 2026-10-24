import type { ShardProduct } from '../../src/game/shardfile/shardProduct';
import type { HeadlessRuntimePreparation, HeadlessRuntimePlan, HeadlessRuntimeInstallation } from '../../src/sdk/headlessRuntime';
import { ReturnProgram } from '../../src/game/population/returnProgram';
import { ReturnModulesSchema } from '../../src/format/scriptContract';
import { parse } from 'valibot';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import type { Rapier } from '../../src/engine/physics/rapier';
import { combatSpeedFactor } from '../../src/engine/player/combatMotion';
import { installNativeBodyScripts } from '../../src/game/quest/nativeBodyScripts';
import { hasStaticGround } from '../../src/engine/physics/query';
import { onSimHostRestored } from '../../src/engine/sim/snapshot';

export function need<T>(value: T, message: string): NonNullable<T> {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}
/** Named product JSON is admitted by the same build schema before this typed proof read. */
export async function readJson<T>(product: ShardProduct, name: string, fatal = true): Promise<T> {
  const value: unknown = JSON.parse(new TextDecoder('utf-8', {fatal}).decode(await product.file(name)));
  return value as T;
}
/** Arguments are deliberately evaluated eagerly, including pickup-side effects. */
export function coalesce<T,U>(first:T,second:U): NonNullable<T>|U { return first ?? second; }
/** Retain full program admission before prepare and the original per-host module loan on install. */
export async function prepareReturns(preparation: HeadlessRuntimePreparation): Promise<(host: SimHost) => void> {
  const returns = preparation.product.has('actors/return-scripts') ? parse(ReturnModulesSchema, preparation.product.section('actors/return-scripts')) : [];
  if (returns.length > 0) await ReturnProgram.prepareModules(preparation.product, preparation.assets, returns);
  return host => { if (returns.length > 0) ReturnProgram.lendModules(host.scope, preparation.assets, returns); };
}
export function fresh(level: HeadlessRuntimePlan['level'], ports: NonNullable<HeadlessRuntimePlan['ports']>, rapier: Rapier,
  install: (host: SimHost) => void, prove: (host: SimHost) => ReturnType<NonNullable<HeadlessRuntimePlan['proveEntries']>>): ReturnType<NonNullable<HeadlessRuntimePlan['proveEntries']>> {
  const host = createSimHost(level, { ...ports, rapier });
  try { install(host); host.step(); return prove(host); } finally { host.dispose(); }
}
/** The original native frame observer, called directly by typed gameplay proofs. */
export function installCombatMotion(host: SimHost, context: HeadlessRuntimeInstallation, speed: number): void {
  if (host.scope.disposed || host.scope.disposing) throw new Error('Native capability owner has ended');
  const frame = context.combat;
  if (frame === undefined) throw new Error('Native combat motion requires its combat frame');
  host.observePlayerMotion(sample => { frame.speedFactor = sample === null ? null : combatSpeedFactor(
    Math.sqrt(sample.velocityX * sample.velocityX + sample.velocityZ * sample.velocityZ), sample.grounded, sample.swimming, sample.hover, speed); });
}
/** The original direct body-script admission and deferred restored-ground fence. */
export function installBodyScripts(host: SimHost, context: HeadlessRuntimeInstallation, preparation: HeadlessRuntimePreparation): void {
  if (host.scope.disposed || host.scope.disposing) throw new Error('Native capability owner has ended');
  const requireGround = (): void => { if (!hasStaticGround(host.physics)) throw new Error('Native body scripts require admitted ground'); };
  if (context.restoring) onSimHostRestored(host, requireGround); else requireGround();
  const sections = new Map<string, unknown>();
  for (const name of ['sim/scripts', 'sim/bodies', 'actors/moves', 'actors/strikes', 'world/targets', 'sim/runtime-plan'] as const)
    if (preparation.product.has(name)) sections.set(name, preparation.product.section(name));
  installNativeBodyScripts(host, preparation.product.shardfile, preparation.assets, context.restoring, sections);
}
