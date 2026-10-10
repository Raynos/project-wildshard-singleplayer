import { ENCOUNTER_UI } from './encounters';
import { INK_TEXT } from './text';
import terrain from './terrain.json' with { type: 'json' };

/** Existing baseline HUD slots, labels and bag text; content has no custom HTML renderer. */
export const INK_UI = [
  { kind: 'marker', id: 'ink.door-pin', label: INK_TEXT.hut, at: terrain.sites.door },
  { kind: 'counter', id: 'ink.oil', label: INK_TEXT.oil, band: 'band.3', order: 20, min: 0, max: 1, field: 'ink.lantern.oil' },
  { kind: 'relabel', id: 'ink.jump-label', spot: 'jump', label: 'JUMP', icon: null },
  { kind: 'bagPanel', id: 'ink.notes', tab: { id: 'notes', title: INK_TEXT.notes, icon: 'book', order: 50 }, order: 0, paragraphs: [INK_TEXT.note] },
  ...ENCOUNTER_UI,
];
