/** Death consequences in their original listener phase; contracts retain their board/save owner. */
export const PINE_DEATH_EFFECTS = [
  { effects: [{ kind: 'kill' }] },
  { when: [{ variant: 'thrall' }, { label: 'Thrall' }], effects: [{ kind: 'event', event: 'thrall' }] },
  { effects: [{ kind: 'call', name: 'contracts' }] },
] as const;
/** Only the page sets the King flag here; the native boss owns its own death flag. */
export const PINE_PAGE_DEATH_EFFECTS = [
  { when: [{ kind: 'antler-king' }], effects: [{ kind: 'flag', flag: 'dead:king' }] },
  ...PINE_DEATH_EFFECTS,
] as const;
