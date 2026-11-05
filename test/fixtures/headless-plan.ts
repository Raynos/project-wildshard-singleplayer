import type { ShardProduct } from '../../src/game/shared/shardfile/shardProduct';
import type { HeadlessRuntimePlan } from '../../src/sdk/headlessRuntime';
import { createSimHost, type SimHost } from '../../src/engine/server/sim';
import type { Rapier } from '../../src/engine/shared/physics/rapier';

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
export function fresh(level: HeadlessRuntimePlan['level'], ports: NonNullable<HeadlessRuntimePlan['ports']>, rapier: Rapier,
  install: (host: SimHost) => void, prove: (host: SimHost) => ReturnType<NonNullable<HeadlessRuntimePlan['proveEntries']>>): ReturnType<NonNullable<HeadlessRuntimePlan['proveEntries']>> {
  const host = createSimHost(level, { ...ports, rapier });
  try { install(host); host.step(); return prove(host); } finally { host.dispose(); }
}
