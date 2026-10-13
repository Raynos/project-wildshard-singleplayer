/** Stable mover owner and view identities; static ropes already collide through the native world bake. */
export const SKY_MOVER_BINDING = {
  systemId: 'far.movers',
  winch: 'far.winch.bridge',
  staticPrefix: 'far.rope.',
  socketPrefix: 'far.islet.',
} as const;

/** Borrow existing registered bridge pieces; islet bodies remain owned by the declared native mover runtime. */
export const SKY_NATIVE_MOVER_OWNERS = ['far.rope.windmill', 'far.rope.grove', 'far.rope.ruin', 'far.winch.bridge'];
