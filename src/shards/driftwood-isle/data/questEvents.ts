/** First-match quest-kit presentation; actual inventory and flags are lent by the page. */
export const DRIFTWOOD_KIT_EVENTS = [
  { types: ['locked'], effects: [{ kind: 'toast', fallback: 'Locked', empty: true }, { kind: 'sound', sound: 'locked' }] },
  { types: ['found'], flagPrefix: 'shard:', effects: [{ kind: 'item', toast: true, fallback: true }, { kind: 'sound', sound: 'glyph', delay: 0.55 }, { kind: 'call', name: 'pickup' }] },
  { types: ['found'], effects: [{ kind: 'item', toast: true, fallback: true }, { kind: 'sound', sound: 'chime', delay: 0.55, gain: 0.8 }] },
  { types: ['take'], kind: 'pickup', look: 'seaglass', effects: [{ kind: 'item' }, { kind: 'call', name: 'glass' }, { kind: 'sound', sound: 'chime' }] },
  { types: ['take'], kind: 'pickup', look: 'shard', effects: [{ kind: 'item' }, { kind: 'toast' }, { kind: 'sound', sound: 'glyph' }, { kind: 'call', name: 'pickup' }] },
  { types: ['take'], effects: [{ kind: 'item' }, { kind: 'toast' }, { kind: 'sound', sound: 'chime' }, { kind: 'call', name: 'pickup' }] },
  { types: ['press'], effects: [{ kind: 'sound', sound: 'plate', release: false }] },
  { types: ['release'], effects: [{ kind: 'sound', sound: 'plate', release: true }] },
  { types: ['lever'], effects: [{ kind: 'sound', sound: 'lever' }, { kind: 'toast' }] },
  { types: ['door'], kind: 'door', look: 'plank', effects: [{ kind: 'sound', sound: 'door' }, { kind: 'toast' }] },
  { types: ['door'], kind: 'door', effects: [{ kind: 'sound', sound: 'grate' }, { kind: 'toast' }] },
  { types: ['door'], effects: [{ kind: 'sound', sound: 'door' }, { kind: 'toast' }] },
  { types: ['open'], effects: [{ kind: 'toast' }, { kind: 'sound', sound: 'chest' }] },
  { types: ['light'], effects: [{ kind: 'toast' }, { kind: 'sound', sound: 'ignite' }] },
  { types: ['use', 'sit', 'barrel-reset'], effects: [{ kind: 'toast' }, { kind: 'sound', sound: 'chime' }] },
] as const;
