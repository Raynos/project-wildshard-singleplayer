import type { LevelSpec } from './spec';

let selected: LevelSpec | null = null;
const listeners = new Set<(level: LevelSpec) => void>();

/** The composition root supplies engine data before constructing the renderer or world. */
export function configureLevel(level: LevelSpec): void {
  selected = level;
  for (const listener of listeners) listener(level);
}

/** Early error reporting and the renderer-free page can inspect selection without requiring a world. */
export function selectedLevel(): LevelSpec | null { return selected; }

export function activeLevel(): LevelSpec {
  if (selected === null) throw new Error('No level has been configured');
  return selected;
}

export function onLevelChange(listener: (level: LevelSpec) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
