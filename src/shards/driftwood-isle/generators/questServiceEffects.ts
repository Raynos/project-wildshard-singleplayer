import { SEA_GLASS_COUNT, SEA_GLASS_FLAG } from './interactables';

/** Existing feedback and motifs; the entry retains its actual flags, HUD and music. */
export const QUEST_SERVICES = { version: 1, actions: [
  { id: 'glass', effects: [{ kind: 'toast', text: 'Sea glass', counter: { prefix: SEA_GLASS_FLAG, of: SEA_GLASS_COUNT } }] },
  { id: 'pickup', effects: [{ kind: 'sting', name: 'pickup' }] },
  { id: 'captain-wake', effects: [{ kind: 'toast', text: 'The pool boils — the Drowned Captain rises!' }] },
  { id: 'captain-dead', effects: [{ kind: 'toast', text: 'Captain Brine sinks for good. The ring hums — go and stand in it' }, { kind: 'sting', name: 'chunk' }] },
] } as const;
