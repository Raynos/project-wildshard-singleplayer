/** Stable host fields carry the paid beat and the Roc's durable encounter record; no native controller state is serialized. */
export const SKY_STATE = { version: 1, sharedOwner: 'host', playerKey: 'actorId', shared: [
  { id: 1, name: 'far-reach.rewarded', type: 'bool', privacy: 'host', default: false },
  { id: 2, name: 'far-reach.roc', type: 'string', privacy: 'host', default: '{"defeated":false,"rewardTaken":false,"kills":0}' },
], player: [] };
