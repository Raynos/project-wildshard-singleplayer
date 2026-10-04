import terrain from './terrain.json' with { type: 'json' };
import { TEMPLATE_TEXT } from './text';

/** Published door state controls the existing named panel/collider, with its legacy interaction point and radius. */
export const TEMPLATE_TARGETS = {
  panels: [{ panel: 'template.door', scope: 'shared', fieldId: 101, equals: 1, visibleWhenMatched: false, colliders: ['template.door'], activeWhenMatched: false }],
  interactions: [{ id: 'template.door.use', at: terrain.sites.door, radius: 3, label: TEMPLATE_TEXT.door, scene: 'template.door.toggle' }],
};
