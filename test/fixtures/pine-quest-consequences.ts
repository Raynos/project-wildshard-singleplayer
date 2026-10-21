// Historical page callbacks at 268d75f2a3; the live entry uses named quest services.
/** Ordered page consequences; native NPC, encounter and clock owners decide when these run. */
export const PINE_QUEST_CONSEQUENCES = {
  actions: [
    { id: 'errand.complete', after: [
      { kind: 'call', target: 'errand.flag' },
      { kind: 'call', target: 'wheel.sync' },
      { kind: 'toast', text: 'The last of them goes down in the race. Behind you the mill wheel shudders, and turns' },
      { kind: 'call', target: 'chunk' },
    ] },
  ],
  bindings: { calls: [
    { target: 'errand.flag', owner: 'flags', path: ['set'], args: ['errand:done'] },
    { target: 'wheel.sync', owner: 'native', path: ['syncWheel'] },
    { target: 'chunk', owner: 'music', path: ['sting'], args: ['chunk'] },
  ] },
} as const;

