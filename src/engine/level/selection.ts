import type { LevelSpec } from './spec';

let selected: LevelSpec | null = null;
const frames: { level: LevelSpec }[] = [];
const listeners = new Set<(level: LevelSpec) => void>();

/** The composition root supplies engine data before constructing the renderer or world. */
export function configureLevel(level: LevelSpec): void {
  selected = level;
  for (const listener of listeners) listener(level);
}

/** Early error reporting and the renderer-free page can inspect selection without requiring a world. */
export function selectedLevel(): LevelSpec | null { return frames.at(-1)?.level ?? selected; }

export function activeLevel(): LevelSpec {
  const level = selectedLevel();
  if (level === null) throw new Error('No level has been configured');
  return level;
}

/** Frame-local selection without changing the configured page or notifying page-load listeners. */
export function bindLevelSelection(level: LevelSpec): () => void {
  const entry = { level }; frames.push(entry);
  return () => { const index = frames.indexOf(entry); if (index !== -1) frames.splice(index, 1); };
}

export function onLevelChange(listener: (level: LevelSpec) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
