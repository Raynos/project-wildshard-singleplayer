import terrain from './terrain.json' with { type: 'json' };
import { INK_TEXT } from './text';

/** Published door state controls the existing named panel/collider, with its legacy interaction point and radius. */
export const INK_TARGETS = {
  panels: [{ panel: 'ink.door', scope: 'shared', fieldId: 101, equals: 1, visibleWhenMatched: false, colliders: ['ink.door'], activeWhenMatched: false }],
  itemActions: [{ scene: 'ink.lantern.toggle', item: 'tool.ink-lantern', action: 3 }, { scene: 'ink.lantern.refill', item: 'tool.ink-lantern', action: 4 }],
  itemFields: [{ item: 'tool.ink-lantern', fieldId: 201, property: 'fuel' }, { item: 'tool.ink-lantern', fieldId: 202, property: 'lit' }],
  interactions: [{ id: 'ink.door.use', at: terrain.sites.door, radius: 3, label: INK_TEXT.door, scene: 'ink.door.toggle' }],
};
