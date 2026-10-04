import * as v from 'valibot';
import { app } from '@wildshard/engine/app/runtime';
/**
 * Infinite Wildshard boots only from a one-shot tap intent (SF21a, R3-C5). The title's tap writes it, the next boot
 * consumes it, and it is gone: a reload, a Safari WebContent restart or an iOS memory kill never lands back in the grid,
 * it lands on the title with Select a shard focused (G58: the grid crashing must always leave a way back).
 *
 * Like the title arrival (src/engine/boot/titleArrival.ts) it is written twice: to the session (the normal case) and to the
 * device as a backup (iOS home-screen navigation can replace WebContent between the title and the game document, and the
 * new process may lose the session). Both copies are consumed together, and either expires after 60 s.
 */
export interface GridIntent { readonly instance: string; readonly slug: string; readonly at: number }
const MAX_AGE_MS = 60_000;
const finite = v.pipe(v.number(), v.finite());
const schema: v.GenericSchema<unknown, GridIntent | null> = v.nullable(v.object({ instance: v.string(), slug: v.string(), at: finite }));

export interface GridIntents {
  /** the title's tap on Infinite Wildshard: the home cell the grid boots into; false if neither copy persisted */
  set: (target: { readonly instance: string; readonly slug: string }) => boolean;
  /** the boot's one read: the intent for this page's shard (fresh, at most 60 s old) or null; both copies are removed */
  consume: (slug: string) => GridIntent | null;
}

/** The injectable store and clock let a Node test run the real write / consume / expiry round trip. */
/** the app's save store (src/engine/saves/store.ts) */
type Store = typeof app.saves;
export function gridIntents(store: Store, now: () => number = Date.now): GridIntents {
  const session = store.define({ key: 'gridIntent', scope: 'session', version: 1, schema, initial: () => null });
  const device = store.define({ key: 'gridIntent.once', scope: 'device', version: 1, schema, initial: () => null });
  const fresh = (intent: GridIntent | null, slug: string): GridIntent | null => {
    if (intent === null || ![slug].includes(intent.slug)) return null; // the same page's shard only
    const age = now() - intent.at;
    return age >= 0 && age <= MAX_AGE_MS ? intent : null;
  };
  return {
    set: (target) => {
      const intent: GridIntent = { instance: target.instance, slug: target.slug, at: now() };
      const inSession = session.write(intent), onDevice = device.write(intent);
      return inSession || onDevice;
    },
    consume: (slug) => {
      const fromSession = session.read(), fromDevice = device.read();
      session.reset(); device.reset();
      return fresh(fromSession, slug) ?? fresh(fromDevice, slug);
    },
  };
}

let page: GridIntents | null = null;
/** this page's intents, on the app's save store (defined on first use) */
export function pageGridIntents(): GridIntents {
  page ??= gridIntents(app.saves);
  return page;
}
