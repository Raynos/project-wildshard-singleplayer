import terrain from './terrain.json' with { type: 'json' };
import { TEMPLATE_TEXT } from './text';

/** Published door state controls the existing named panel/collider, with its legacy interaction point and radius. */
export const TEMPLATE_TARGETS = {
  panels: [{ panel: 'template.door', scope: 'shared', fieldId: 101, equals: 1, visibleWhenMatched: false, colliders: ['template.door'], activeWhenMatched: false }],
  itemActions: [{ scene: 'template.lantern.toggle', item: 'tool.template-lantern', action: 3 }, { scene: 'template.lantern.refill', item: 'tool.template-lantern', action: 4 }],
  itemFields: [{ item: 'tool.template-lantern', fieldId: 201, property: 'fuel' }, { item: 'tool.template-lantern', fieldId: 202, property: 'lit' }],
  interactions: [{ id: 'template.door.use', at: terrain.sites.door, radius: 3, label: TEMPLATE_TEXT.door, scene: 'template.door.toggle' }],
};
