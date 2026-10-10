import { ENCOUNTER_UI } from './encounters';
import { PASTEL_TEXT } from './text';
import terrain from './terrain.json' with { type: 'json' };

/** Existing baseline HUD slots, labels and bag text; content has no custom HTML renderer. */
export const PASTEL_UI = [
  { kind: 'marker', id: 'pastel.door-pin', label: PASTEL_TEXT.hut, at: terrain.sites.door },
  { kind: 'counter', id: 'pastel.oil', label: PASTEL_TEXT.oil, band: 'band.3', order: 20, min: 0, max: 1, field: 'pastel.lantern.oil' },
  { kind: 'relabel', id: 'pastel.jump-label', spot: 'jump', label: 'JUMP', icon: null },
  { kind: 'bagPanel', id: 'pastel.notes', tab: { id: 'notes', title: PASTEL_TEXT.notes, icon: 'book', order: 50 }, order: 0, paragraphs: [PASTEL_TEXT.note] },
  ...ENCOUNTER_UI,
];
