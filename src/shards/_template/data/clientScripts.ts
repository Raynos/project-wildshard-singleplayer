import { parseClientScripts } from '@wildshard/sdk/clientScripts';

/** Built by compileScript(idle.as, {maximumPages: 2}); byte identity is checked by the idle-module fixture. */
export const CLIENT_IDLE_HASH = '8024a4e04f5550c715e2e167cb3f989320b6f917320a2e4ef98bbf8c62447940';
/** Presentation guest reserves live, last-good and in-flight memory independently of the authoritative simulation. */
export const CLIENT_IDLE_RESIDENT = 3877 + 3 * 2 * 65536;
/** Frozen neighbours breathe and graze; active creatures retain their authoritative pose and clips. */
export const TEMPLATE_CLIENT_SCRIPTS = parseClientScripts({ divisor: 2, bindings: [
  { module: CLIENT_IDLE_HASH, entity: 1, name: 'grey-blob.idle', target: { kind: 'creature', id: 'grey-blob:1' }, reads: [], parameters: [0, 0.06, 1.6, 1],
    pose: true, maxOffset: 0.5, minScale: 0.8, maxScale: 1.25, emitters: [{ id: 1, recipe: 'platform.particles', perTick: 1, live: 6, lifetimeTicks: 90, colour: [0.78, 0.8, 0.84], size: 0.12, velocity: [0, 0.6, 0], gravity: -0.2 }] },
  { module: CLIENT_IDLE_HASH, entity: 2, name: 'greyback.idle', target: { kind: 'creature', id: 'greyback' }, reads: [], parameters: [1, 0.35, 1, 0],
    pose: true, maxOffset: 0.6, minScale: 0.9, maxScale: 1.1, emitters: [] },
  { module: CLIENT_IDLE_HASH, entity: 3, name: 'big-blob.idle', target: { kind: 'creature', id: 'big-blob' }, reads: [], parameters: [0, 0.05, 1.1, 0],
    pose: true, maxOffset: 0.5, minScale: 0.8, maxScale: 1.25, emitters: [] },
] });
