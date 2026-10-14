/** Priority-ten page consequences: key placement precedes flags and the visible notice. */
export const DRIFTWOOD_PAGE_DEATH_EFFECTS = [
  { when: [{ kind: 'sailor' }], effects: [{ kind: 'call', name: 'hold-key' }, { kind: 'flag', flag: 'dead:sailor' },
    { kind: 'toast', text: 'The drowned sailor collapses — his hold key clatters to the planks' }] },
  { when: [{ kind: 'captain' }], effects: [{ kind: 'flag', flag: 'dead:captain' }] },
] as const;
/** Native kill continuation sets the sailor flag before advancing its saved achievement counts. */
export const DRIFTWOOD_KILL_DEATH_EFFECTS = [
  { when: [{ kind: 'sailor' }], effects: [{ kind: 'flag', flag: 'dead:sailor' }] },
  { effects: [{ kind: 'kill' }] },
] as const;
