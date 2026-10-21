/** Fixed page services commit through the original bound quest, HUD and music host. */
export const PINE_QUEST_SERVICES = { version: 1, actions: [
  { id: 'miller.pay', effects: [
    { kind: 'toast', text: 'Brandt pays · 3 lodge ribbons · 4 amber resin' },
    { kind: 'sting', name: 'pickup' },
  ] },
  { id: 'stag.appear', effects: [{ kind: 'toast', text: 'On the west road, something pale is standing very still' }] },
  { id: 'stag.complete', effects: [{ kind: 'toast', text: 'The stag is gone. Ahead, the standing stones, and the fog between them' }] },
] } as const;

/** The existing building command and sound owner; no chained prompt hook. */
export const PINE_MILL_DOOR = {
  actions: [{ id: 'miller.door', needs: [
    { any: ['errand:done', 'errand:asked'], else: 'unknown' },
    { all: ['errand:done'], else: 'asked' },
  ], denied: {
    unknown: 'The mill door is barred from inside',
    asked: 'Barred from inside. Brandt keeps the mill shut until the race is clear',
  }, refused: { unknown: [{ kind: 'call', target: 'locked' }], asked: [{ kind: 'call', target: 'locked' }] },
  after: [{ kind: 'call', target: 'toggle' }] }],
  bindings: { calls: [
    { target: 'toggle', owner: 'door', path: ['use'] },
    { target: 'locked', owner: 'sfx', path: ['interact'], args: ['locked', { owner: 'door', path: ['prompt', 'position'] }] },
  ], prompts: [{ target: 'miller.door', owner: 'door', path: ['prompt', 'onInteract'] }] },
} as const;

