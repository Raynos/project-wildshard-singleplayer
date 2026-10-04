import { parsePlumbing } from '@wildshard/sdk/plumbing';

export const TEMPLATE_PLUMBING = parsePlumbing({ namespace: 'template', input: [{ id: 'template.lantern', priority: 20,
  actions: [{ id: 'template.lantern.toggle', keys: ['KeyL'], scene: 'template.lantern.toggle' }],
  touch: { slot: 'verb.1', action: 'template.lantern.toggle', label: 'LANTERN', icon: '' },
}], knobs: [{ id: 'template.propCount', phone: 10, desktop: 20 }], debug: [] });
