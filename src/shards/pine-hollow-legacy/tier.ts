import { TIER_CONFIG as engine, buildTier } from '@wildshard/engine/core/tier';
import values from './tierValues.json' with { type: 'json' };
import { pineTiers } from './look/viewDistance';

// Required compatibility for G486: sealed callers retain their original knobs and trim.
const rows = pineTiers(values);
export const TIER_CONFIG = new Proxy({ ...engine, ...values[buildTier()] }, {
  get: (_target, key): unknown => typeof key === 'string' && Object.hasOwn(values.phone, key)
    ? Reflect.get(rows[buildTier()], key) : Reflect.get(engine, key),
});
