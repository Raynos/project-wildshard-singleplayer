// SHARD-PLATFORM SF9c, the playback half: the exported grey blob, boar and Pine ranger load through the client's skin
// player (admission, GLTFLoader, bindRig, AnimMachine) with their SF10a family material bindings, and every clip played
// frame by frame (the engine's real-time update, not a seek) matches today's procedural pose closure.
// oxlint-disable-next-line import/no-nodejs-modules -- Reads the committed exported skins, bindings and textures.
import { readFileSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Platform independent fixture paths.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Content-addressed files are checked against their sha256 names.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The repository root is Vitest's working directory.
import { cwd, env } from 'node:process';
import { describe, expect, it } from 'vitest';
import { DataTexture, MeshStandardMaterial, Vector3, type Texture } from 'three';
import { Scope } from '../src/engine/app/scope';
import { ToonLook } from '../src/engine/render/families/toon';
import { familyMaterial } from '../src/engine/render/families/registry';
import { parseKtx2 } from '../src/game/shardfile/assets';
import { loadSkin, parseSkinBindings, parseSkinRows } from '../src/game/shardfile/skinPlayback';
import { skinFixtureSource } from './fixtures/sim-level/skins/build';

const dir = join(cwd(), 'public/assets/baked/skin-fixture');
const rows = parseSkinRows(JSON.parse(readFileSync(join(dir, 'skins.json'), 'utf8')));
const bindings = parseSkinBindings(JSON.parse(readFileSync(join(dir, 'bindings.json'), 'utf8')), rows);
const file = (hash: string): Uint8Array => { const bytes = Uint8Array.from(readFileSync(join(dir, hash))); expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash); return bytes; };

describe('exported skins play in the client', () => {
  for (const kind of ['grey-blob', 'boar', 'pine-ranger'] as const) it(`${kind}: bound material, every clip frame by frame equals today's pose`, async () => {
    const row = rows.find((r) => r.id === kind), binding = bindings.find((b) => b.skin === kind);
    if (row === undefined || binding === undefined) throw new Error(`missing ${kind}`);
    const scope = new Scope(`skin-${kind}`), refs: string[] = [];
    const textures = (ref: string): Texture => { const cost = parseKtx2(file(ref)); expect(cost.gpu).toBeGreaterThan(0); refs.push(ref); return new DataTexture(new Uint8Array(4), 1, 1); };
    const material = familyMaterial(binding.material, { toon: new ToonLook(), textures, scope });
    const skin = await loadSkin(file(row.file), row, binding, material, scope);
    expect(skin.mesh.material).toBe(material); expect(material).toBeInstanceOf(MeshStandardMaterial);
    expect(skin.mesh.castShadow).toBe(true); expect([...skin.rig.sockets.keys()]).toEqual(row.rig.sockets);
    expect(refs.length).toBe(kind === 'pine-ranger' ? 2 : 0);
    let worst = 0, compared = 0, wraps = 0; const measurements: { clip: string; maximumVertexError: number; compared: number; wrapFrames: number }[] = [];
    for (const name of row.rig.clips) {
      const original = await skinFixtureSource(kind);
      try {
        skin.play(name);
        const clip = skin.rig.clips.get(name); if (clip === undefined) throw new Error('missing clip');
        const loops = binding.loops.includes(name), position = original.mesh.geometry.getAttribute('position');
        const layerWraps = (binding.poseLayers?.[name] ?? []).flatMap((layer) => [2 * layer.period, 3 * layer.period]);
        const duration = loops ? Math.max(clip.duration * 3, ...layerWraps) + 1 / 60 : clip.duration;
        const hz = loops ? 120 : 60, frames = Math.ceil(duration * hz);
        let clipWorst = 0, clipCompared = 0, clipWraps = 0;
        for (let frame = 0; frame <= frames; frame++) {
          if (frame > 0) skin.update(1 / hz);
          const time = frame / hz;
          original.pose(name, time, frame === 0 ? 0 : 1 / hz); original.mesh.updateMatrixWorld(true); skin.root.updateMatrixWorld(true);
          // Include both sides of every layer's second/third wrap, and every base frame through its third loop.
          const nearWrap = layerWraps.some((wrap) => Math.abs(time - wrap) <= 1 / 60);
          if (time > clip.duration * 3 && !nearWrap) continue;
          if (nearWrap) { wraps++; clipWraps++; }
          for (let i = 0; i < position.count; i += 3) {
            const expected = original.mesh.getVertexPosition(i, new Vector3()).applyMatrix4(original.mesh.matrixWorld);
            const error = skin.mesh.getVertexPosition(i, new Vector3()).applyMatrix4(skin.mesh.matrixWorld).distanceTo(expected);
            worst = Math.max(worst, error); clipWorst = Math.max(clipWorst, error); compared++; clipCompared++;
          }
        }
        measurements.push({ clip: name, maximumVertexError: clipWorst, compared: clipCompared, wrapFrames: clipWraps });
        // past the end: a looping clip wraps, a one-shot holds its last frame
        skin.play(name); skin.update(clip.duration * 1.5);
        const time = skin.machine.action(name).time;
        if (binding.loops.includes(name)) expect(time).toBeCloseTo(clip.duration * 0.5, 5); else expect(time).toBeCloseTo(clip.duration, 5);
      } finally { original.dispose(); }
    }
    expect(compared).toBeGreaterThan(30000); expect(worst, JSON.stringify(measurements)).toBeLessThan(0.001); expect(wraps).toBeGreaterThan(0);
    if (env['SF9C_WRITE_RECEIPTS'] === '1') writeFileSync(join(cwd(), 'progress/shard-platform/sf9c', `${kind}-loops.json`), JSON.stringify({ kind, cadence: 'loops120Hz, one-shots60Hz', toleranceMetres: 0.001, compared, maximumVertexError: worst, wrapFrames: wraps, cost: skin.cost, clips: measurements, attackHit: kind === 'grey-blob' ? 'no motion today beyond idle pulse (separate vertex test)' : 'current source sampled' }, null, 2));
    scope.dispose(); material.dispose();
  }, 120000);

  it('grey blob attack and hit have no motion today beyond the same idle pulse', async () => {
    const idle = await skinFixtureSource('grey-blob');
    try { for (const name of ['attack', 'hit'] as const) {
      const original = await skinFixtureSource('grey-blob');
      try { for (let frame = 0; frame <= 120; frame++) {
        const t = frame / 60; idle.pose('idle', t, 1 / 60); original.pose(name, t, 1 / 60);
        idle.mesh.updateMatrixWorld(true); original.mesh.updateMatrixWorld(true);
        for (let i = 0; i < original.mesh.geometry.getAttribute('position').count; i++) expect(original.mesh.getVertexPosition(i, new Vector3()).distanceTo(idle.mesh.getVertexPosition(i, new Vector3()))).toBeLessThan(1e-8);
      } } finally { original.dispose(); }
    } } finally { idle.dispose(); }
  });

  it('refuses malformed, nonperiodic or oversized layer data before allocating playback buffers', () => {
    const row = rows[0], binding = bindings[0], original = binding?.poseLayers?.['idle']?.[0];
    if (row === undefined || binding === undefined || original === undefined) throw new Error('Missing layer fixture');
    const track = original.tracks[0]; if (track === undefined) throw new Error('Missing layer track');
    const check = (layer: typeof original) => parseSkinBindings([{ ...binding, poseLayers: { idle: [layer] } }], [row]);
    expect(() => check({ ...original, tracks: [{ ...track, bone: 'absent' }] })).toThrow(/shape/u);
    expect(() => check({ ...original, times: [0, 0, original.period] })).toThrow(/times/u);
    expect(() => check({ ...original, tracks: [{ ...track, values: [Number.NaN] }] })).toThrow(/Invalid/u);
    const values = [...track.values]; values[values.length - 1] = 1;
    expect(() => check({ ...original, tracks: [{ ...track, values }] })).toThrow(/seam/u);
    expect(() => check({ ...original, phaseSteps: 65 })).toThrow(/Invalid/u);
  });

  it('refuses a skin whose bytes cost more than its row declares, or a binding for another skin', async () => {
    const row = rows[0], binding = bindings[0], other = bindings[1];
    if (row === undefined || binding === undefined || other === undefined) throw new Error('fixture rows');
    const material = new MeshStandardMaterial();
    await expect(loadSkin(file(row.file), { ...row, cost: { ...row.cost, gpu: row.cost.gpu - 1 } }, binding, material)).rejects.toThrow(/cost/u);
    await expect(loadSkin(file(row.file), { ...row, cost: { ...row.cost, decoded: row.cost.decoded - 1 } }, binding, material)).rejects.toThrow(/cost/u);
    await expect(loadSkin(file(row.file), row, other, material)).rejects.toThrow(/binding/u);
    await expect(loadSkin(file(row.file), { ...row, rig: { ...row.rig, joints: [[...(row.rig.joints[0] ?? [])].reverse()] } }, binding, material)).rejects.toThrow(/joint order/u);
    expect(() => parseSkinBindings([{ ...binding, loops: ['run'] }], rows)).toThrow(/unknown clip/u);
    material.dispose();
  });
});
