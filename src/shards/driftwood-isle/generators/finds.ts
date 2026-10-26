import { DRIFTWOOD_PLACES } from './discovery';
import { SEA_GLASS_COUNT, SEA_GLASS_FLAG, SHARD_FLAGS } from './interactables';

const glass = { prefix: SEA_GLASS_FLAG, count: SEA_GLASS_COUNT };
/** Original Bag counters, sticker order, glass palette and whole-charm milestone. */
export const DRIFTWOOD_FINDS: { readonly counters: readonly [{ readonly label: "Sea glass"; readonly flags: { prefix: string; count: number; }; }, { readonly label: "Places"; readonly flags: string[]; }, { readonly label: "Glyph shards"; readonly flags: readonly ["shard:lookout", "shard:wreck", "shard:cave"]; }]; readonly next: { readonly counter: 0; readonly every: 5; readonly max: number; readonly text: "Next charm at"; }; readonly sections: readonly [{ readonly title: "Trophies"; readonly items: readonly [{ readonly label: "Bear claw"; readonly icon: "talon"; readonly owned: "bear-claw"; }, { readonly label: "Boar tusk"; readonly icon: "tusk"; readonly owned: "boar-tusk"; }, { readonly label: "Captain's hat"; readonly icon: "hat"; readonly owned: "captain-hat"; }]; }, { readonly title: "Treasures"; readonly items: readonly [{ readonly label: "Pearl necklace"; readonly icon: "necklace"; readonly flag: "found:reef-treasure"; }]; }]; readonly glass: { readonly flags: { prefix: string; count: number; }; readonly colors: readonly ["#7df0d0", "#8fd8ff", "#b7f59a", "#9fb8ff", "#f0f7a0"]; readonly fallback: "#7df0d0"; }; } = {
  counters: [
    { label: 'Sea glass', flags: glass },
    { label: 'Places', flags: DRIFTWOOD_PLACES.map(place => `seen:${place.id}`) },
    { label: 'Glyph shards', flags: SHARD_FLAGS },
  ],
  next: { counter: 0, every: 5, max: SEA_GLASS_COUNT, text: 'Next charm at' },
  sections: [
    { title: 'Trophies', items: [
      { label: 'Bear claw', icon: 'talon', owned: 'bear-claw' },
      { label: 'Boar tusk', icon: 'tusk', owned: 'boar-tusk' },
      { label: "Captain's hat", icon: 'hat', owned: 'captain-hat' },
    ] },
    { title: 'Treasures', items: [{ label: 'Pearl necklace', icon: 'necklace', flag: 'found:reef-treasure' }] },
  ],
  glass: { flags: glass, colors: ['#7df0d0', '#8fd8ff', '#b7f59a', '#9fb8ff', '#f0f7a0'], fallback: '#7df0d0' },
} as const;
