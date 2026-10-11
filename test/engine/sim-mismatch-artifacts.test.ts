// oxlint-disable-next-line import/no-nodejs-modules -- Verify the failure artifact from the real native snapshot.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Read only the owned directory named by the failure.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and delete the failure-only CI artifact directory.
import { tmpdir } from 'node:os';
import { beforeAll, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { Vector3 } from 'three';
import { createSimHost } from '../../src/engine/sim';
import { snapshotSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier } from '../../src/engine/physics/rapier';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { canonicalSimDigest } from '../fake/simState';
import { simMismatchError } from '../fake/simMismatch';
import { captureNumberPathProbe } from '../../scripts/number-path-probe.mjs';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
function artifacts(error: Error): string {
  const at = error.message.indexOf('canonical snapshots and field diff: ');
  if (at === -1) throw error;
  return error.message.slice(at + 'canonical snapshots and field diff: '.length);
}
function read(directory: string, name: string): unknown { return JSON.parse(readFileSync(join(directory, name), 'utf8')); }

it('keeps the mismatch failure and writes both canonical snapshots with a nested native-adapter field diff', () => {
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier }); let count = 1;
  host.onStep('diagnostic.adapter', () => undefined, { snapshot: () => JSON.stringify({ control: { count } }), restore: () => undefined });
  try {
    const expected = snapshotSimHost(host); count = 2; const actual = snapshotSimHost(host);
    const error = simMismatchError('SDK worker continuation diverged', expected, actual,
      { expected: canonicalSimDigest(expected), actual: canonicalSimDigest(actual) }), directory = artifacts(error);
    try {
      expect(() => { throw error; }).toThrow('SDK worker continuation diverged');
      expect(read(directory, 'expected.canonical.json')).toMatchObject({ digest: canonicalSimDigest(expected), state: { adapters: [{ id: 'diagnostic.adapter', state: '{"control":{"count":1}}' }] } });
      expect(read(directory, 'actual.canonical.json')).toMatchObject({ digest: canonicalSimDigest(actual), state: { adapters: [{ id: 'diagnostic.adapter', state: '{"control":{"count":2}}' }] } });
      expect(read(directory, 'diff.json')).toMatchObject({ differences: [{ path: 'state["adapters"][0]["state"].$json["control"]["count"]', expected: 1, actual: 2 }] });
    } finally { rmSync(directory, { recursive: true }); }
  } finally { host.dispose(); }
});

it('names the actual native collision record and retains exact physics bits rather than rounding a moved motor', () => {
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier });
  try {
    const expected = snapshotSimHost(host);
    host.player.motor.resetAt(new Vector3(host.player.position.x + 1, host.player.position.y, host.player.position.z));
    const actual = snapshotSimHost(host), directory = artifacts(simMismatchError('SDK worker continuation diverged', expected, actual));
    try {
      expect(canonicalSimDigest(actual)).not.toBe(canonicalSimDigest(expected));
      const report = v.parse(v.object({ differences: v.array(v.object({ path: v.string(), record: v.optional(v.string()), expected: v.unknown(), actual: v.unknown() })) }), read(directory, 'diff.json'));
      const physical = report.differences.find(row => row.record !== undefined);
      if (physical === undefined) throw new Error('Missing native collision difference');
      expect(physical.path).toMatch(/^physics\.float64Bits\[\d+\]$/u);
      expect(physical.record).toMatch(/^(?:rigid body|collider) /u);
      const value = v.object({ value: v.number(), bits: v.string() }), a = v.parse(value, physical.expected), b = v.parse(value, physical.actual);
      expect(a.bits).toMatch(/^[0-9a-f]{16}$/u); expect(b.bits).toMatch(/^[0-9a-f]{16}$/u);
      expect(a.value).not.toBe(b.value); expect(a.bits).not.toBe(b.bits);
    } finally { rmSync(directory, { recursive: true }); }
  } finally { host.dispose(); }
});

it('uploads a bounded field/physics excerpt with exact Node number-path evidence while still refusing mismatch', () => {
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier });
  const output = mkdtempSync(join(tmpdir(), 'replay-ci-fixture-'));
  let count = 1;
  host.onStep('diagnostic.many', () => undefined, {
    snapshot: () => JSON.stringify(Array.from({ length: 100 }, (_, index) => ({ index, count, text: String(count).repeat(2000) }))),
    restore: () => undefined,
  });
  try {
    const numberPaths = captureNumberPathProbe();
    vi.stubEnv('WS_REPLAY_DIAGNOSTICS_DIR', output);
    const expected = snapshotSimHost(host); count = 2;
    host.player.motor.resetAt(new Vector3(host.player.position.x + 1, host.player.position.y, host.player.position.z));
    const actual = snapshotSimHost(host), error = simMismatchError('Linux restore diverged', expected, actual), directory = artifacts(error);
    try {
      expect(() => { throw error; }).toThrow('Linux restore diverged');
      expect(error.message).toContain('diagnostic.many');
      const names = readdirSync(output); expect(names).toHaveLength(1);
      const text = readFileSync(join(output, names[0] ?? ''), 'utf8');
      expect(new TextEncoder().encode(text).byteLength).toBeLessThanOrEqual(128 * 1024);
      const report = v.parse(v.object({ differenceCount: v.number(), truncated: v.boolean(),
        differences: v.array(v.object({ path: v.string(), record: v.optional(v.string()), expected: v.string(), actual: v.string() })),
        numberPaths: v.unknown() }), JSON.parse(text));
      expect(report.truncated).toBe(true); expect(report.differenceCount).toBeGreaterThan(100);
      expect(report.differences.length).toBeLessThanOrEqual(32);
      expect(report.differences.every(row => row.expected.length <= 512 && row.actual.length <= 512)).toBe(true);
      expect(report.differences.some(row => row.record !== undefined && /^(?:rigid body|collider) /u.test(row.record))).toBe(true);
      // oxlint-disable-next-line unicorn/prefer-structured-clone -- Assert the JSON artifact transport, including signed-zero normalization.
      expect(report.numberPaths).toEqual(JSON.parse(JSON.stringify(numberPaths)));
      expect(numberPaths.json.every(row => row.sameValue || row.bits === '8000000000000000')).toBe(true);
      expect(numberPaths.math.every(row => /^[0-9a-f]{16}$/u.test(row.bits))).toBe(true);
    } finally { rmSync(directory, { recursive: true }); }
  } finally { vi.unstubAllEnvs(); rmSync(output, { recursive: true }); host.dispose(); }
});
