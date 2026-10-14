import { FLAGS } from '../quests/flags';
/** Stable mover owner and view identities; static ropes already collide through the native world bake. */
export const SKY_MOVER_BINDING = {
  systemId: 'far.movers',
  winch: 'far.winch.bridge',
  permissions: [{ name: FLAGS.roost, bit: 1 }, { name: FLAGS.vanes, bit: 2 }],
  staticPrefix: 'far.rope.',
  socketPrefix: 'far.islet.',
} as const;

/** Borrow existing registered bridge pieces; islet bodies remain owned by the declared native mover runtime. */
export const SKY_NATIVE_MOVER_OWNERS = ['far.rope.windmill', 'far.rope.grove', 'far.rope.ruin', 'far.winch.bridge'];

/** Native hanging bridge rest pitch; shared by the authored mover and the page pivot. */
export const FALLEN_ANGLE = -1.25;

/** Scoped page motion installation and the native permission bit order. */
export const SKY_CLIENT_MOTION = { systemId: SKY_MOVER_BINDING.systemId,
  permissions: [{ mover: SKY_MOVER_BINDING.winch, flags: SKY_MOVER_BINDING.permissions }] } as const;

/** The native host's empty numeric role and aggregate grants; item aliases stay in their consuming role. */
export const SKY_NATIVE_MOVER_COMPOSITION = { content: { sim: { bindings: [], scriptTickDivisor: 1 }, state: { shared: [], player: [] } },
  rules: { fields: {}, archetypes: [], events: [], maxEntities: 32 } } as const;
