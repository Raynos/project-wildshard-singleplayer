import { App } from './app';

/** The page app; legacy active-service entry points delegate here during the migration. */
export const app = new App();

/** One gameplay draw from the seeded `gameplay` stream (01 §2): aim spread and other rolls that change a hit. */
export function gameplayRandom(): number { return app.rng.stream('gameplay').next(); }
