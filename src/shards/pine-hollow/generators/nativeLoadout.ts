/** Native equipment and input order authored into combat/items. */
export const NATIVE_LOADOUT = { slots: [0, 1, 2], initial: 0, lower: 0.25, raise: 0.25,
  ownership: [null, 'owned:lever-rifle', 'paid:king'],
  input: { step: 'pine.loadout', phase: 'afterBodies', command: 'pine.weapon',
    publication: { step: 'pine.combat-input', phase: 'afterBodies', aim: { command: 'pine.aim', initial: 0.5, min: 0, max: 1, sentinel: 2 } } } } as const;
