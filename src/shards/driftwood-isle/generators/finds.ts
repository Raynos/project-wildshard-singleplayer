import { DRIFTWOOD_PLACES } from '../data/discovery';
import { SEA_GLASS_COUNT, SEA_GLASS_FLAG, SHARD_FLAGS } from '../data/interactables';

const glass = { prefix: SEA_GLASS_FLAG, count: SEA_GLASS_COUNT };
/** Original Bag counters, sticker order, glass palette and whole-charm milestone. */
export const DRIFTWOOD_FINDS = {
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
