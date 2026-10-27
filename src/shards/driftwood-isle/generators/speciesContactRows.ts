import authored from '../data/speciesActions.json' with { type: 'json' };

function onceTest(value: string): 'falsy' | 'not-value' {
  if (value === 'falsy' || value === 'not-value') return value;
  throw new Error('Unknown authored contact gate');
}
function damage(value: string): 'charge' {
  if (value !== 'charge') throw new Error('Unknown authored contact damage');
  return value;
}

/** Preserve authored state/action order while checking the consumed contact literals. */
export const CRAB_ACTIONS = { ...authored.CRAB_ACTIONS, actions: authored.CRAB_ACTIONS.actions.map(row => ({
  state: row.state, phase: row.phase, strike: row.strike, damage: damage(row.damage), radiusScale: row.radiusScale, sound: row.sound,
  once: { key: row.once.key, value: row.once.value, test: onceTest(row.once.test) },
})) };
/** The sailor consumes the same original once-only contact gate. */
export const SAILOR_ACTIONS = { ...authored.SAILOR_ACTIONS, actions: authored.SAILOR_ACTIONS.actions.map(row => ({
  state: row.state, phase: row.phase, strike: row.strike, sound: row.sound,
  once: { key: row.once.key, value: row.once.value, test: onceTest(row.once.test) },
})) };
