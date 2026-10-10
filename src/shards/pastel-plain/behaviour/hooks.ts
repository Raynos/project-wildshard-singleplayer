/** Named hook ids are resolved by the platform; AssemblyScript receives bounded next-tick events. */
export const PASTEL_HOOKS = {
  conditions: [{ id: 'pastel.door.open', scope: 'shared', fieldId: 101, equals: 1 }],
  scenes: [{ id: 'pastel.door.toggle', type: 201, value: 1 },
    { id: 'pastel.lantern.toggle', type: 102, value: 3 }, { id: 'pastel.lantern.refill', type: 102, value: 4 }],
} as const;
/** Door is script-owned; lamp values are read-only projections from the one authoritative item runtime. */
export const PASTEL_STATE = { version: 1, sharedOwner: 'host', playerKey: 'actorId', shared: [
  { id: 101, name: 'pastel.door.open', type: 'bool', privacy: 'public', default: false },
], player: [
  { id: 201, name: 'pastel.lantern.oil', type: 'f64', privacy: 'owner', default: 1, min: 0, max: 1 },
  { id: 202, name: 'pastel.lantern.lit', type: 'bool', privacy: 'owner', default: false },
] } as const;
