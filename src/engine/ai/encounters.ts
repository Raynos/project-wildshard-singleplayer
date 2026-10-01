import type { Scope } from '../app/scope';

export interface EncounterDefinition { id: string; displayName?: string; showHeadBar?: boolean }
interface Entry { definition: EncounterDefinition; scope: Scope }
/** Resident content names are read from the active level and released with their scope. */
export class EncounterRegistry {
  private readonly entries = new Map<string, Entry[]>();
  private readonly active: () => Scope | null;
  constructor(active: () => Scope | null) { this.active = active; }
  register(definition: EncounterDefinition, scope: Scope): void {
    if (scope.disposed) throw new Error('Cannot register an encounter on a disposed scope');
    const list = this.entries.get(definition.id) ?? [];
    if (list.some((entry) => entry.scope === scope)) throw new Error(`Duplicate encounter: ${definition.id}`);
    const entry = { definition, scope }; list.push(entry); this.entries.set(definition.id, list);
    scope.onDispose(() => { const i = list.indexOf(entry); if (i !== -1) list.splice(i, 1); if (list.length === 0) this.entries.delete(definition.id); });
  }
  get(id: string): EncounterDefinition | undefined {
    const active = this.active(); if (active === null) return undefined;
    return this.entries.get(id)?.find((entry) => entry.scope.belongsTo(active))?.definition;
  }
}
