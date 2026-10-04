import { ENCOUNTER_UI } from './encounters';
import { TEMPLATE_TEXT } from './text';
import terrain from './terrain.json' with { type: 'json' };

/** Existing baseline HUD slots, labels and bag text; content has no custom HTML renderer. */
export const TEMPLATE_UI = [
  { kind: 'marker', id: 'template.door-pin', label: TEMPLATE_TEXT.hut, at: terrain.sites.door },
  { kind: 'counter', id: 'template.oil', label: TEMPLATE_TEXT.oil, band: 'band.3', order: 20, min: 0, max: 1, field: 'template.lantern.oil' },
  { kind: 'relabel', id: 'template.jump-label', spot: 'jump', label: 'JUMP', icon: null },
  { kind: 'bagPanel', id: 'template.notes', tab: { id: 'notes', title: TEMPLATE_TEXT.notes, icon: 'book', order: 50 }, order: 0, paragraphs: [TEMPLATE_TEXT.note] },
  ...ENCOUNTER_UI,
];
