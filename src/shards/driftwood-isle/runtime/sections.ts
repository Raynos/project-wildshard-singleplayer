import * as v from 'valibot';

/** Product-owned logical names; private source URLs never become fetch targets. */
export const SECTIONS = {
  'custom/assets': v.strictObject({
    byUrl: v.record(v.pipe(v.string(), v.maxLength(512)), v.pipe(v.string(), v.maxLength(240))),
  }),
} as const;
