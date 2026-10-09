/** The quest's flags (saved per shard): the four steps, the vanes, the reward and the boss. */
export const FLAGS = { notes: 'far.notes', roost: 'far.roost', vanes: 'far.vanes', raised: 'far.bridge', complete: 'far.complete', roc: 'far.roc.down' } as const;
export const vaneFlag = (id: string): string => `far.vane.${id}`;
