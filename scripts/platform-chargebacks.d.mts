import type { Component } from './shard-components.mjs';
/** G520 reviewed ownership; these rows are the fixture-backed cut list. */
export function platformChargeback(path: string, name?: string): Component | null;
export function hasChargebackDeclarations(path: string): boolean;
export function chargePlatformUsers(moduleUsers: Map<string, Set<string>>, bindingUsers: Map<string, Set<string>>): void;
