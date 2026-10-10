import terrain from './terrain.json' with { type: 'json' };
import { PASTEL_TEXT } from './text';

/** Published door state controls the existing named panel/collider, with its legacy interaction point and radius. */
export const PASTEL_TARGETS = {
  panels: [{ panel: 'pastel.door', scope: 'shared', fieldId: 101, equals: 1, visibleWhenMatched: false, colliders: ['pastel.door'], activeWhenMatched: false }],
  itemActions: [{ scene: 'pastel.lantern.toggle', item: 'tool.pastel-lantern', action: 3 }, { scene: 'pastel.lantern.refill', item: 'tool.pastel-lantern', action: 4 }],
  itemFields: [{ item: 'tool.pastel-lantern', fieldId: 201, property: 'fuel' }, { item: 'tool.pastel-lantern', fieldId: 202, property: 'lit' }],
  interactions: [{ id: 'pastel.door.use', at: terrain.sites.door, radius: 3, label: PASTEL_TEXT.door, scene: 'pastel.door.toggle' }],
};
