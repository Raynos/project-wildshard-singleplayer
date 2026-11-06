import { describe, expect, it } from 'vitest';
import { apiOrigin, apiUrl } from './apiOrigin';

describe('apiUrl', () => {
  it('keeps today\'s calls until the build value is set', () => {
    expect(apiUrl('errors', '', false)).toBe('/api/errors');
    expect(apiUrl('inbox', '', true)).toBe('https://wildshard-singleplayer.vercel.app/api/inbox');
  });

  it('sends web and native to the one value once it is set', () => {
    for (const native of [false, true]) expect(apiUrl('telemetry', 'https://api.wildshard.io', native)).toBe('https://api.wildshard.io/api/telemetry');
  });
});

describe('apiOrigin', () => {
  it('reads blank and missing as unset, and drops a trailing slash', () => {
    for (const value of [undefined, null, '', '  ']) expect(apiOrigin(value)).toBe('');
    expect(apiOrigin(' https://api.wildshard.io/ ')).toBe('https://api.wildshard.io');
  });

  it('has no value in this repo\'s builds by default', () => {
    expect(apiOrigin()).toBe('');
  });
});
