/** First-match quest-kit presentation; actual counters and inventory stay with the page. */
export const PINE_KIT_EVENTS = [
  { types: ['take'], kind: 'pickup', look: 'resin', effects: [{ kind: 'call', name: 'resin' }, { kind: 'sound', sound: 'chime', gain: 0.7 }, { kind: 'call', name: 'all-resin' }] },
  { types: ['take'], kind: 'pickup', look: 'token', effects: [{ kind: 'call', name: 'token' }, { kind: 'sound', sound: 'glyph' }, { kind: 'call', name: 'all-tokens' }] },
  { types: ['take'], effects: [{ kind: 'toast' }, { kind: 'sound', sound: 'chime' }, { kind: 'call', name: 'pickup' }] },
  { types: ['locked'], effects: [{ kind: 'toast', fallback: 'Locked', empty: true }, { kind: 'sound', sound: 'locked' }] },
  { types: ['lever'], effects: [{ kind: 'sound', sound: 'lever' }, { kind: 'toast' }] },
  { types: ['door'], effects: [{ kind: 'sound', sound: 'grate' }, { kind: 'toast' }] },
  { types: ['open', 'light', 'found', 'use', 'barrel-reset'], effects: [{ kind: 'toast' }] },
] as const;
