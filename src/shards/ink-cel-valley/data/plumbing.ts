import { parsePlumbing } from '@wildshard/sdk/plumbing';

export const INK_PLUMBING = parsePlumbing({ namespace: 'ink', input: [{ id: 'ink.lantern', priority: 20,
  actions: [{ id: 'ink.lantern.toggle', keys: ['KeyL'], scene: 'ink.lantern.toggle' }],
  touch: { slot: 'verb.1', action: 'ink.lantern.toggle', label: 'LANTERN', icon: '' },
}], knobs: [{ id: 'ink.propCount', phone: 10, desktop: 20 }], debug: [] });
