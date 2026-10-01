import type { SystemSpec } from './systems';

/** Replaced by the save implementation at F10; use before then fails loudly. */
export class PendingSaves {
  read(): never { throw new Error('Save service is not installed (F10)'); }
  write(): never { throw new Error('Save service is not installed (F10)'); }
  flush(): never { throw new Error('Save service is not installed (F10)'); }
}

/** Until rate classes land, every registered system remains eligible on every frame. */
export class EveryFrameScheduler {
  runs(_system: SystemSpec): boolean { return true; }
}

export class AppDebug {
  leakBaseline: Readonly<Record<string, unknown>> | null = null;
  private readonly values = new Map<string, unknown>();
  expose(name: string, value: unknown): void { this.values.set(name, value); }
  snapshot(): Readonly<Record<string, unknown>> { return Object.freeze(Object.fromEntries(this.values)); }
}

/** Resolve a base grade and its optional look layer without content vocabulary. */
export function resolveGrade<Grade extends object, Look extends { grade: Partial<Grade> }>(spec: { grade: Grade; look?: Look }): { grade: Grade; look: Look | null } {
  const look = spec.look ?? null;
  return { grade: look ? { ...spec.grade, ...look.grade } : spec.grade, look };
}
