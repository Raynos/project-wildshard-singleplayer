import { afterEach, expect, test, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the released skin bytes in a bounded Node collection fixture.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { Bone, MeshLambertMaterial } from 'three';
import { Scope } from '@wildshard/engine/app/scope';
import { realGc } from '@wildshard/engine/test/realGc';
import { FilesSchema } from '@wildshard/format/shardSections';
import { parseRows } from '@wildshard/format/rows';
import { SKIN_LOOK_RECIPE, SKIN_CLIPS_RECIPE } from '@wildshard/format/skins';
import * as skinAssets from '@wildshard/format/skinAssets';
import { loadClientSkins, SkinDriver, type ClientSkin } from '../src/game/shardfile/clientSkins';

afterEach(() => { vi.restoreAllMocks(); });

function poses(skin: ClientSkin): number[][] {
  const bones = Object.fromEntries(skin.bones.map(row => {
    const bone = new Bone(); bone.name = row.name; bone.position.fromArray(row.pos); return [row.name, bone];
  }));
  for (const row of skin.bones) {
    const bone = bones[row.name], parent = row.parent === null ? undefined : bones[row.parent];
    if (bone !== undefined && parent !== undefined) parent.add(bone);
  }
  const driver = new SkinDriver(skin, bones), frames: number[][] = [];
  for (const speed of [0, 2, 0]) {
    driver.step({ dt: 1 / 30, t: 1, alive: true, flinch: 0, attack: -1, speed, strafe: 0, scale: 1, phase: .2, state: 'graze' });
    frames.push(Object.values(bones).flatMap(bone => bone.position.toArray().concat(bone.quaternion.toArray(), bone.scale.toArray())));
  }
  return frames;
}

const name = 'a live client skin releases consumed numeric pose tables while its material and animation remain usable';
test(name, async () => {
  await realGc('test/client-skin-lifetime.test.ts', name, async collect => {
    const scope = new Scope('skin.lifetime'), refs: WeakRef<object>[] = [];
    let expectedMaterial: unknown;
    const read = skinAssets.parseSkinFile;
    const capture = vi.spyOn(skinAssets, 'parseSkinFile').mockImplementation(bytes => {
      const file = read(bytes);
      expectedMaterial = file.binding.material;
      for (const layers of Object.values(file.binding.poseLayers ?? {})) {
        for (const layer of layers ?? []) for (const track of layer.tracks) refs.push(new WeakRef(track.values));
      }
      return file;
    });
    const rows = parseRows(JSON.parse(readFileSync('src/shards/_template/data/rows.json', 'utf8')));
    const metadata = v.parse(v.array(v.object({ files: FilesSchema })), JSON.parse(readFileSync('src/shards/_template/data/skins.json', 'utf8')));
    const files = metadata.flatMap(row => row.files), assets = new Map(files.map(file => [file.hash,
      Uint8Array.from(readFileSync(`src/shards/_template/assets/${file.hash}`))]));
    const skins = await loadClientSkins({ rows: { ...rows, looks: [{ id: 'template.look.boar', species: 'boar', recipe: SKIN_LOOK_RECIPE,
      material: null, parameters: { skin: 'bfa4dfc9c18979f904557ee8deab0058b8a399be10266f5fb1578b403f482fd4' },
      animation: { recipe: SKIN_CLIPS_RECIPE, parameters: { attackSpan: 1 } } }] }, files }, assets,
      entry => { expect(entry).toEqual(expectedMaterial); return new MeshLambertMaterial({ color: 0x345678 }); }, scope);
    capture.mockClear(); // Mock call/result logs must not own the parsed binding.
    const skin = [...skins.values()][0];
    if (skin === undefined) throw new Error('Missing released boar skin');
    expect(refs.length).toBeGreaterThan(0);
    const positions = Array.from(skin.geometry.getAttribute('position').array), before = poses(skin);
    try {
      for (const ref of refs) await collect(ref);
      const first = skin.material(), second = skin.material();
      try {
        expect(first).not.toBe(second);
        expect(first.color.getHex()).toBe(0x345678);
        expect(second.color.getHex()).toBe(0x345678);
      } finally { first.dispose(); second.dispose(); }
      expect(Array.from(skin.geometry.getAttribute('position').array)).toEqual(positions);
      expect(skin.clips.size).toBeGreaterThan(0);
      expect(poses(skin)).toEqual(before);
      expect(before.flat().every(Number.isFinite)).toBe(true);
    } finally { scope.dispose(); }
  });
});
