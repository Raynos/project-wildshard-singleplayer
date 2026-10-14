
/** The timed crack retains its original eye, command phase and exact version-2 continuation wire order. */
export const SIGNAL_MELEE_HOST = {
  step: 'item.weapon.sunscar-whip', held:{action:1,mode:'replace',continuation:{kind:'step',id:'sunscar.whip-input'}}, eye: 1.68,
  mode: 'timed', pitchLimit: null, zeroAim: 'retain', body: 'volumes', liveTargetsOnly: false, commandsAfterCool: false,
  actions: [{ action: 0, move: 0, aim: 'selected', hook: null }, { action: 1, move: 1, aim: 'selected', hook: null }],
  continuation: { encoding: 'json', fields: [
    { key: 'version', source: 'constant', constant: 2 }, { key: 'cooldown', source: 'primary' },
    { key: 'crackT', source: 'time' }, { key: 'heavy', source: 'heavy' }, { key: 'landed', source: 'landed', min: 0, max: 2 },
    { key: 'target', source: 'target' }, { key: 'world', source: 'world' }, { key: 'dir', source: 'direction' },
  ] },
} as const;
