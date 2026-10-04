import { parsePlumbing } from '@wildshard/sdk/plumbing';

export const TEMPLATE_PLUMBING = parsePlumbing({ namespace: 'template', input: [{ id: 'template.lantern', priority: 20,
  actions: [{ id: 'template.lantern.toggle', keys: ['KeyL'], scene: 'template.lantern.toggle' }],
  touch: { slot: 'verb.1', action: 'template.lantern.toggle', label: 'LANTERN', icon: '' },
}], knobs: [{ id: 'template.propCount', phone: 10, desktop: 20 }], debug: [{
  id: 'template.oil', group: 'tools', label: 'Template lantern oil', choices: [{ value: 'keep', text: 'Keep' }, { value: 'refill', text: 'Refill', scene: 'template.lantern.refill' }],
  initial: 'keep', note: 'E357 Z1: reset the teaching lantern oil.', ask: 'E357', reviewBy: '2026-12-01',
}] });
