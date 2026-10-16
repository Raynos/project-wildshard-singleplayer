import * as v from 'valibot';
import { isJsonData } from './json';

const key = v.pipe(v.string(), v.regex(/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/u));

/** Flat player-facing string table. Keys are stable content identities; no interpolation or code is stored. */
export const UiStringsSchema: v.GenericSchema<unknown, Record<string, string>> = v.pipe(v.unknown(),
  v.check(isJsonData, 'Strings must be plain JSON'),
  v.check(input => typeof input === 'object' && input !== null && !Array.isArray(input)
    && !Object.keys(input).some(name => ['__proto__', 'constructor', 'prototype'].includes(name)), 'Unsafe string key'),
  v.record(key, v.pipe(v.string(), v.maxLength(4096))), v.maxEntries(1024));

/** Admitted ui/strings payload, read directly by the runtime product's strings API. */
export type UiStrings = v.InferOutput<typeof UiStringsSchema>;

/** Validate before emission or platform-section publication; never coerce labels or remove invalid keys. */
export function parseUiStrings(input: unknown): UiStrings { return v.parse(UiStringsSchema, input); }
