import { parseClientScripts } from '@wildshard/sdk/clientScripts';

/** Built by compileScript(idle.as, {maximumPages: 2}); byte identity is checked by the idle-module fixture. */
export const CLIENT_IDLE_HASH = '875e798b8b1be62129b477e6b85e7c45cf11ae67cba006596d869133b469726b';
/** The compiled module's size (its compressed and decoded cost: the bytes ship as they are). */
export const CLIENT_IDLE_BYTES = 3913;
/** Presentation guest copies and six particle slots are reserved independently of the authoritative simulation. */
export const CLIENT_IDLE_RESIDENT = CLIENT_IDLE_BYTES + 3 * 2 * 65536 + 6 * 88;
/** Frozen neighbours breathe and graze; active creatures retain their authoritative pose and clips. */
export const PASTEL_CLIENT_SCRIPTS = parseClientScripts({ divisor: 2, bindings: [
  { module: CLIENT_IDLE_HASH, entity: 1, name: 'grey-blob.idle', target: { kind: 'creature', id: 'grey-blob:1' }, reads: [], parameters: [0, 0.06, 1.6, 1],
    pose: true, maxOffset: 0.5, minScale: 0.8, maxScale: 1.25, emitters: [{ id: 1, recipe: 'platform.particles', perTick: 1, live: 6, lifetimeTicks: 90, colour: [0.78, 0.8, 0.84], size: 0.12, velocity: [0, 0.6, 0], gravity: -0.2 }] },
  { module: CLIENT_IDLE_HASH, entity: 2, name: 'greyback.idle', target: { kind: 'creature', id: 'greyback' }, reads: [], parameters: [1, 0.35, 1, 0],
    pose: true, maxOffset: 0.6, minScale: 0.9, maxScale: 1.1, emitters: [] },
  { module: CLIENT_IDLE_HASH, entity: 3, name: 'big-blob.idle', target: { kind: 'creature', id: 'big-blob' }, reads: [], parameters: [0, 0.05, 1.1, 0],
    pose: true, maxOffset: 0.5, minScale: 0.8, maxScale: 1.25, emitters: [] },
] });
