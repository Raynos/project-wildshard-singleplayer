/** Named hook ids are resolved by the platform; AssemblyScript receives bounded next-tick events. */
export const INK_HOOKS = {
  conditions: [{ id: 'ink.door.open', scope: 'shared', fieldId: 101, equals: 1 }],
  scenes: [{ id: 'ink.door.toggle', type: 201, value: 1 },
    { id: 'ink.lantern.toggle', type: 102, value: 3 }, { id: 'ink.lantern.refill', type: 102, value: 4 }],
} as const;
/** Door is script-owned; lamp values are read-only projections from the one authoritative item runtime. */
export const INK_STATE = { version: 1, sharedOwner: 'host', playerKey: 'actorId', shared: [
  { id: 101, name: 'ink.door.open', type: 'bool', privacy: 'public', default: false },
], player: [
  { id: 201, name: 'ink.lantern.oil', type: 'f64', privacy: 'owner', default: 1, min: 0, max: 1 },
  { id: 202, name: 'ink.lantern.lit', type: 'bool', privacy: 'owner', default: false },
] } as const;
