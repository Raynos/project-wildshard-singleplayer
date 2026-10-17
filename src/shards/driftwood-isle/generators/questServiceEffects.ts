import { SEA_GLASS_COUNT, SEA_GLASS_FLAG } from './interactables';

/** Existing glass feedback and pickup motif; the entry retains its actual flags, HUD and music. */
export const QUEST_SERVICES = { version: 1, actions: [
  { id: 'glass', effects: [{ kind: 'toast', text: 'Sea glass', counter: { prefix: SEA_GLASS_FLAG, of: SEA_GLASS_COUNT } }] },
  { id: 'pickup', effects: [{ kind: 'sting', name: 'pickup' }] },
] } as const;
