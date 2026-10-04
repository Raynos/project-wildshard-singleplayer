// SHARD-PLATFORM SF9c, the playback half: the exported grey blob, boar and Pine ranger load through the client's skin
// player (admission, GLTFLoader, bindRig, AnimMachine) with their SF10a family material bindings, and every clip played
// frame by frame (the engine's real-time update, not a seek) matches today's procedural pose closure.
// oxlint-disable-next-line import/no-nodejs-modules -- Reads the committed exported skins, bindings and textures.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Platform independent fixture paths.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Content-addressed files are checked against their sha256 names.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The repository root is Vitest's working directory.
import { cwd } from 'node:process';
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
    let worst = 0, compared = 0, seam = 0;
    for (const name of row.rig.clips) {
      const original = await skinFixtureSource(kind);
      try {
        skin.play(name);
        const clip = skin.rig.clips.get(name); if (clip === undefined) throw new Error('missing clip');
        const frames = Math.round(clip.duration * 60), position = original.mesh.geometry.getAttribute('position');
        for (let frame = 0; frame <= frames; frame++) {
          if (frame > 0) skin.update(1 / 60);
          original.pose(name, frame / 60, frame === 0 ? 0 : 1 / 60); original.mesh.updateMatrixWorld(true); skin.root.updateMatrixWorld(true);
          // a looping clip wraps to its first frame at its end: today's closure runs on (its breath and sway are not periodic
          // in the sampled window), so that one frame is the loop seam, measured separately
          const wrapped = frame === frames && binding.loops.includes(name);
          for (let i = 0; i < position.count; i += 3) {
            const expected = original.mesh.getVertexPosition(i, new Vector3()).applyMatrix4(original.mesh.matrixWorld);
            const error = skin.mesh.getVertexPosition(i, new Vector3()).applyMatrix4(skin.mesh.matrixWorld).distanceTo(expected);
            if (wrapped) seam = Math.max(seam, error); else { worst = Math.max(worst, error); compared++; }
          }
        }
        // past the end: a looping clip wraps, a one-shot holds its last frame
        skin.update(clip.duration * 0.5);
        const time = skin.machine.action(name).time;
        if (binding.loops.includes(name)) expect(time).toBeLessThan(clip.duration * 0.75); else expect(time).toBeCloseTo(clip.duration, 5);
      } finally { original.dispose(); }
    }
    expect(compared).toBeGreaterThan(30000); expect(worst).toBeLessThan(1e-4);
    // the loop seams measured at SF9c: grey blob 3.9 cm, boar 8.2 mm, ranger 4.2 cm (breath and slow sway)
    expect(seam).toBeLessThan({ 'grey-blob': 0.045, boar: 0.01, 'pine-ranger': 0.05 }[kind]);
    scope.dispose(); material.dispose();
  }, 120000);

  it('refuses a skin whose bytes cost more than its row declares, or a binding for another skin', async () => {
    const row = rows[0], binding = bindings[0], other = bindings[1];
    if (row === undefined || binding === undefined || other === undefined) throw new Error('fixture rows');
    const material = new MeshStandardMaterial();
    await expect(loadSkin(file(row.file), { ...row, cost: { ...row.cost, gpu: row.cost.gpu - 1 } }, binding, material)).rejects.toThrow(/cost/u);
    await expect(loadSkin(file(row.file), row, other, material)).rejects.toThrow(/binding/u);
    await expect(loadSkin(file(row.file), { ...row, rig: { ...row.rig, joints: [[...(row.rig.joints[0] ?? [])].reverse()] } }, binding, material)).rejects.toThrow(/joint order/u);
    expect(() => parseSkinBindings([{ ...binding, loops: ['run'] }], rows)).toThrow(/unknown clip/u);
    material.dispose();
  });
});
