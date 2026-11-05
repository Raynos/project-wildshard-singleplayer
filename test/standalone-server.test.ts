// oxlint-disable-next-line import/no-nodejs-modules -- The server half runs the shipped product bytes and physics module.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { NET_BUTTONS } from '../src/engine/shared/input/netButtons';
import { ANIMAL_CLASS } from '../src/engine/shared/net/netSchemas';
import { ServerClock } from '../src/engine/server/net/serverClock';
import { FIXED_STEP } from '../src/engine/shared/core/fixedStep';
import { loadRapier } from '../src/engine/shared/physics/rapier';
import { ForwardedStorage } from '../src/engine/server/saves/forwardedStorage';
import type { SaveStorage } from '../src/engine/shared/saves/store';
import { outputDescriptor } from '../src/game/shared/shardfile/outputDescriptor';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import type { HeadlessRuntimeInput } from '../src/sdk/headlessRuntime';
import { runStandaloneServer } from '../src/sdk/standalone/serverHost';
import { connectStandalone, type StandaloneShell } from '../src/sdk/standalone/shell';
import { WorkerLoopback } from '../src/sdk/standalone/workerLoopback';
import { builtProduct } from './fixtures/builtProduct';

// P1-E5.2 (E5-REPLICATION §6.3): the standalone target's two halves over real MessagePorts, on the server's own clock. The
// page's half and the worker's are the same code a browser runs; scripts/standalone-smoke.mjs runs them in a real Worker.

class PageStorage implements SaveStorage {
  readonly items = new Map<string, string>();
  refuse = false;
  get length(): number { return this.items.size; }
  key(index: number): string | null { return [...this.items.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.items.get(key) ?? null; }
  setItem(key: string, value: string): void { if (this.refuse) throw new Error('quota'); this.items.set(key, value); }
  removeItem(key: string): void { this.items.delete(key); }
}

async function sunscarInput(): Promise<HeadlessRuntimeInput> {
  const directory = builtProduct('sunscar-dunes'), product = await loadHeadlessProduct(directory), descriptor = outputDescriptor(product.shardfile);
  if (descriptor === undefined) throw new Error('Missing Sunscar output');
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash, Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  return { shard: product.shardfile, assets, rapier: await loadRapier(readFileSync('public/assets/physics/rapier.wasm')), product };
}
function start(storage: SaveStorage, input: HeadlessRuntimeInput): { shell: StandaloneShell; stop: () => void } {
  const control = new MessageChannel(), game = new MessageChannel();
  const server = runStandaloneServer({ control: control.port1, game: game.port1, load: () => Promise.resolve(input) });
  const shell = connectStandalone({ slug: 'sunscar-dunes', base: '/shards/sunscar-dunes/', build: 'test', savePrefix: 'wildshard.', storage }, control.port2, game.port2, () => { server.dispose(); });
  return { shell, stop: () => { shell.dispose(); } };
}
const until = async (ready: () => boolean): Promise<void> => { await vi.waitFor(() => { expect(ready()).toBe(true); }, { timeout: 10_000, interval: 5 }); };

test('the server ticks on its own clock, frames arrive at 30 Hz, and rows match the server within a step', async () => {
  const storage = new PageStorage(), { shell, stop } = start(storage, await sunscarInput()), { client } = shell;
  expect(await shell.booted).toEqual({ tick: 0, restored: false });
  shell.ready();
  await until(() => client.latest !== null);
  const first = client.latest?.tick ?? 0, frames: number[] = [];
  client.onFrame(frame => { frames.push(frame.tick); client.flush(); });
  await until(() => frames.length >= 45);
  // Frames are every second tick, in order, with none missing on a port
  expect(frames.every((tick, index) => tick === first + 2 * (index + 1))).toBe(true);
  const probe = await shell.probe();
  await until(() => client.frame(probe.tick) !== null);
  const frame = client.frame(probe.tick), step = ANIMAL_CLASS.row[0]?.step ?? 0;
  if (frame === null) throw new Error('Probed frame missing');
  expect(probe.rows).toHaveLength(13);
  const { px, py, pz } = client.owner(frame);
  for (const row of probe.rows) {
    const handle = [...client.entities.values()].find(entity => entity.id === row.id)?.handle ?? -1, fields = client.fields(frame, handle);
    if (Math.hypot(row.x - Number(px), row.y - Number(py), row.z - Number(pz)) > 59) continue; // past the near band a row is on its tier (P1-E5.2c)
    for (const axis of ['x', 'y', 'z'] as const) expect(Math.abs(Number(fields?.[axis]) - row[axis])).toBeLessThanOrEqual(step);
  }
  stop();
});

test('a save made in the server survives a reload, and is durable only once the page has it', async () => {
  const storage = new PageStorage(), input = await sunscarInput(), first = start(storage, input);
  await first.shell.booted; first.shell.ready();
  await until(() => first.shell.client.latest !== null);
  first.shell.client.command({ viewTick: 0, steer: { keyX: 0, keyY: 1, stickX: 0, stickY: 0 }, yaw: 1, pitch: 0, buttons: NET_BUTTONS.sprint });
  first.shell.client.flush();
  await until(() => (first.shell.client.latest?.tick ?? 0) > 120);
  const saved = await first.shell.save();
  expect(saved.ok).toBe(true);
  const document = storage.getItem('wildshard.standalone-sunscar-dunes');
  expect(document?.length).toBeGreaterThan(100_000);
  storage.refuse = true;
  expect((await first.shell.save()).ok).toBe(false); // the worker's copy took it; the page's refused, and the save says so
  storage.refuse = false;
  first.stop();

  const second = start(storage, input);
  expect(await second.shell.booted).toEqual({ tick: saved.tick, restored: true });
  second.shell.ready();
  await until(() => (second.shell.client.latest?.tick ?? 0) > saved.tick + 20);
  second.stop();
});

test('the worker pauses with a hidden tab: paused time is never simulated', async () => {
  const { shell, stop } = start(new PageStorage(), await sunscarInput());
  await shell.booted; shell.ready();
  await until(() => shell.client.latest !== null);
  shell.pause();
  await new Promise(resolve => { setTimeout(resolve, 50); });
  const held = shell.client.latest?.tick ?? 0;
  await new Promise(resolve => { setTimeout(resolve, 200); });
  expect(shell.client.latest?.tick).toBe(held);
  shell.resume();
  await until(() => (shell.client.latest?.tick ?? 0) > held);
  expect((shell.client.latest?.tick ?? 0) - held).toBeLessThan(30); // no burst for the 200 ms it slept
  stop();
});

test('a server of another build refuses hello with reload, and the page is told', async () => {
  const control = new MessageChannel(), game = new MessageChannel(), input = await sunscarInput();
  const server = runStandaloneServer({ control: control.port1, game: game.port1, load: () => Promise.resolve(input) });
  let refused = 0;
  const shell = connectStandalone({ slug: 'sunscar-dunes', base: '/shards/sunscar-dunes/', build: 'stale', serverBuild: 'newer', savePrefix: 'wildshard.', storage: new PageStorage(),
    refused: () => { refused++; } }, control.port2, game.port2, () => { server.dispose(); });
  await shell.booted;
  await until(() => shell.client.closed !== null);
  expect(shell.client.closed).toBe('reload');
  expect(refused).toBe(1);
  shell.dispose();
  expect(refused).toBe(1);
});

test('a server that cannot boot says so on the control port', async () => {
  const control = new MessageChannel(), game = new MessageChannel();
  const server = runStandaloneServer({ control: control.port1, game: game.port1, load: () => Promise.reject(new Error('no shard')) });
  const shell = connectStandalone({ slug: 'sunscar-dunes', base: '/none/', build: '', savePrefix: 'wildshard.', storage: new PageStorage() }, control.port2, game.port2, () => { server.dispose(); });
  await expect(shell.booted).rejects.toThrow('no shard');
  shell.dispose();
});

test('the clock keeps 60 Hz on its accumulator, caps its catch-up and drops a stall', () => {
  let now = 0, due: (() => void) | null = null, steps = 0;
  const clock = new ServerClock({ now: () => now, wait: (_ms, run) => { due = run; return () => { due = null; }; }, step: () => { steps++; } });
  const fire = (ms: number): void => { now += ms; const run = due; if (run === null) throw new Error('Clock is not waiting'); run(); };
  clock.start();
  for (let index = 0; index < 60; index++) fire(1000 / 60);
  expect(steps).toBeGreaterThanOrEqual(59); expect(steps).toBeLessThanOrEqual(60);
  steps = 0; fire(2000);
  expect(steps).toBe(3);
  steps = 0; fire(FIXED_STEP * 1000 + 1);
  expect(steps).toBeLessThanOrEqual(2); // the two seconds did not replay as a burst: at most the remainder and this step
  clock.pause(); expect(clock.running).toBe(false);
  now += 5000; clock.start(); steps = 0; fire(FIXED_STEP * 1000 + 1);
  expect(steps).toBe(1); // paused time is not owed
  clock.pause();
});

test('forwarded storage answers at once and is durable only on ack', async () => {
  const writes: { seq: number; key: string; value: string | null }[] = [], storage = new ForwardedStorage({ a: '1' }, write => { writes.push({ ...write }); });
  expect(storage.getItem('a')).toBe('1'); expect(storage.length).toBe(1); expect(storage.key(0)).toBe('a');
  storage.setItem('b', '2'); storage.removeItem('a');
  expect(storage.getItem('b')).toBe('2'); expect(storage.getItem('a')).toBeNull();
  expect(writes).toEqual([{ seq: 1, key: 'b', value: '2' }, { seq: 2, key: 'a', value: null }]);
  let settled: boolean | null = null;
  const settling = (async () => { settled = await storage.settled(); })();
  storage.acked(1, true);
  await Promise.resolve();
  expect(settled).toBeNull();
  storage.acked(2, false);
  await settling;
  expect(settled).toBe(false);
  expect(await storage.settled()).toBe(true);
});

test('the worker loopback transfers its bytes rather than copying them, and carries a refusal', async () => {
  const channel = new MessageChannel(), near = new WorkerLoopback(channel.port1), far = new WorkerLoopback(channel.port2);
  const received: number[] = [];
  let closed = '';
  far.onMessage((name, bytes) => { received.push(bytes.byteLength); expect(name).toBe('unreliable'); });
  far.onClose(reason => { closed = reason; });
  const bytes = new Uint8Array(64).buffer;
  near.send('unreliable', bytes);
  expect(bytes.byteLength).toBe(0); // detached: ownership went with the message
  await until(() => received.length === 1);
  expect(near.stats.sentBytes).toBe(64); expect(far.stats.recvBytes).toBe(64);
  near.close('reload');
  await until(() => closed === 'reload');
});
