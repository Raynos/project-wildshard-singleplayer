import { SEA_GLASS_COUNT, SEA_GLASS_FLAG } from './interactables';

/** Existing feedback and motifs; the entry retains its actual flags, HUD and music. */
export const QUEST_SERVICES: { readonly version: 1; readonly actions: readonly [{ readonly id: "glass"; readonly effects: readonly [{ readonly kind: "toast"; readonly text: "Sea glass"; readonly counter: { readonly prefix: "glass:"; readonly of: number; }; }]; }, { readonly id: "pickup"; readonly effects: readonly [{ readonly kind: "sting"; readonly name: "pickup"; }]; }, { readonly id: "captain-wake"; readonly effects: readonly [{ readonly kind: "toast"; readonly text: "The pool boils — the Drowned Captain rises!"; }]; }, { readonly id: "captain-dead"; readonly effects: readonly [{ readonly kind: "toast"; readonly text: "Captain Brine sinks for good. The ring hums — go and stand in it"; }, { readonly kind: "sting"; readonly name: "chunk"; }]; }]; } = { version: 1, actions: [
  { id: 'glass', effects: [{ kind: 'toast', text: 'Sea glass', counter: { prefix: SEA_GLASS_FLAG, of: SEA_GLASS_COUNT } }] },
  { id: 'pickup', effects: [{ kind: 'sting', name: 'pickup' }] },
  { id: 'captain-wake', effects: [{ kind: 'toast', text: 'The pool boils — the Drowned Captain rises!' }] },
  { id: 'captain-dead', effects: [{ kind: 'toast', text: 'Captain Brine sinks for good. The ring hums — go and stand in it' }, { kind: 'sting', name: 'chunk' }] },
] } as const;
