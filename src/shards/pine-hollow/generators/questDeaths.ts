/** Death consequences in their original listener phase; contracts retain their board/save owner. */
export const PINE_DEATH_EFFECTS = [
  { effects: [{ kind: 'kill' }] },
  { when: [{ variant: 'thrall' }, { label: 'Thrall' }], effects: [{ kind: 'event', event: 'thrall' }] },
  { effects: [{ kind: 'call', name: 'contracts' }] },
] as const;
/** Only the page sets the King flag here; the native boss owns its own death flag. */
export const PINE_PAGE_DEATH_EFFECTS: readonly [{ readonly when: readonly [{ readonly kind: "antler-king"; }]; readonly effects: readonly [{ readonly kind: "flag"; readonly flag: "dead:king"; }]; }, ...({ readonly effects: readonly [{ readonly kind: "kill"; }]; } | { readonly when: readonly [{ readonly variant: "thrall"; }, { readonly label: "Thrall"; }]; readonly effects: readonly [{ readonly kind: "event"; readonly event: "thrall"; }]; } | { readonly effects: readonly [{ readonly kind: "call"; readonly name: "contracts"; }]; })[]] = [
  { when: [{ kind: 'antler-king' }], effects: [{ kind: 'flag', flag: 'dead:king' }] },
  ...PINE_DEATH_EFFECTS.slice(0, -1),
] as const;
