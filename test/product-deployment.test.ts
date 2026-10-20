import { expect, test, vi } from 'vitest';
import { currentDeploymentResponse } from '../src/game/shardfile/productDeployment';

test('a stale app refreshes before parsing a newly introduced product feature', async () => {
  const response = Response.json({ feature: 'population.wildlife' });
  const parse = vi.spyOn(response, 'json');
  const refresh = vi.fn((build: string): Promise<never> => Promise.reject(new Error(`navigate ${build}`)));
  const pending = currentDeploymentResponse(response, {
    build: 'old-client', version: () => Promise.resolve(Response.json({ build: 'new-client' })), refresh,
  }).then(value => value.json());
  await expect(pending).rejects.toThrow('navigate new-client');
  expect(refresh).toHaveBeenCalledExactlyOnceWith('new-client');
  expect(parse).not.toHaveBeenCalled();
});

test('current, offline and unavailable version checks preserve product admission', async () => {
  const refresh = vi.fn((): Promise<never> => Promise.reject(new Error('unexpected refresh')));
  const response = Response.json({ feature: 'population.wildlife' });
  for (const version of [
    () => Promise.resolve(Response.json({ build: 'current' })),
    () => Promise.resolve(new Response(null, { status: 503 })),
    () => Promise.reject(new Error('offline')),
    () => Promise.resolve(Response.json({ build: null })),
  ]) expect(await currentDeploymentResponse(response, { build: 'current', version, refresh })).toBe(response);
  expect(refresh).not.toHaveBeenCalled();
});
