// oxlint-disable-next-line import/no-nodejs-modules -- Use the shipped native host metadata with exact bounded codec payloads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Construct deliberately corrupt packed framing for the native codec refusal fixture.
import { Buffer } from 'node:buffer';
import { deflateSync } from 'fflate';
import { expect, it } from 'vitest';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { snapshotSimHost, serializeSimSnapshot, decodeSimSnapshot, SnapshotBasisMismatchError } from '../src/engine/sim/snapshot';
import { SIM_LEVEL } from './fixtures/sim-level/level';

it('reports a typed present-basis change only after engine, metadata and packed reference validation', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const host = createSimHost(SIM_LEVEL, { rapier });
  try {
    host.step();
    // Distinct long immutable slices force external references, independent of the native BVH encoder's choices.
    const basis = Uint8Array.from({ length: 4096 }, (_, index) => (index * 73 + (index >>> 3)) % 256);
    const saved = { ...snapshotSimHost(host), physics: Array.from(basis) };
    const wire = serializeSimSnapshot(saved, basis), changed = basis.slice(); changed[0] = (changed[0] ?? 0) ^ 1;
    expect(wire).toContain('"basis"'); expect(decodeSimSnapshot(wire, basis)).toEqual(saved);
    try { decodeSimSnapshot(wire, changed); throw new Error('Changed basis was accepted'); }
    catch (error) {
      expect(error).toBeInstanceOf(SnapshotBasisMismatchError);
      if (!(error instanceof SnapshotBasisMismatchError)) throw error;
      expect(error.levelId).toBe(saved.levelId); expect(error.tick).toBe(saved.state.tick);
    }
    const refusal = (input: string, bytes?: Uint8Array) => {
      try { decodeSimSnapshot(input, bytes); throw new Error('Invalid wire was accepted'); }
      catch (error) { expect(error).not.toBeInstanceOf(SnapshotBasisMismatchError); expect(error).not.toHaveProperty('message', 'Invalid wire was accepted'); }
    };
    refusal(wire); // missing basis cannot authorize a logical fallback
    refusal(wire.replace(`"apiVersion":${String(saved.apiVersion)}`, '"apiVersion":99999'), changed);
    refusal(wire.replace('"flags":[]', '"flags":["duplicate","duplicate"]'), changed);
    const badReference = Buffer.from(deflateSync(Uint8Array.of(255))).toString('base64');
    refusal(wire.replace(/"chunks":\[[^\]]+\]/, `"chunks":["${badReference}"]`).replace(/"packedLength":\d+/, '"packedLength":1'), changed);
    refusal(wire.replace(/"chunks":\[[^\]]+\]/, '"chunks":["AAAA"]'), changed);
  } finally { host.dispose(); }
});
