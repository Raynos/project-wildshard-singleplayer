// SHARD-PLATFORM SF16, the creature seam: a `platform.skin` look row loads its SF9c exported skin through the client
// (admission, rig and cost checks, the binding's family material) and becomes an engine custom-rig look whose clip
// choice follows the creature's state. Every posed vertex equals the SF9c player's at the same clip time (that player is
// proven equal to today's procedural closure in test/skin-playback.test.ts), and unload leaves nothing.
// oxlint-disable-next-line import/no-nodejs-modules -- Reads the committed exported skins and bindings.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Platform independent fixture paths.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Content addresses are sha256.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The repository root is Vitest's working directory.
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import { Bone, DataTexture, Skeleton, SkinnedMesh, Vector3, type Material } from 'three';
import { Scope } from '../src/engine/app/scope';
import { ToonLook } from '../src/engine/render/families/toon';
import { familyMaterial } from '../src/engine/render/families/registry';
import type { ClipName } from '../src/engine/anim/rig';
import { loadSkin, parseSkinBindings, parseSkinRows } from '../src/game/shardfile/skinPlayback';
import { loadClientSkins, SkinDriver, type SkinDriveState } from '../src/game/shardfile/clientSkins';
import { clientSpeciesLooks } from '../src/game/shardfile/clientRecipes';
import { skinLookRules, SKIN_CLIPS_RECIPE, SKIN_LOOK_RECIPE } from '../src/game/shardfile/skins';
import { parseRows } from '../src/game/shardfile/rows';
import type { Shardfile } from '../src/game/shardfile/schema';
import { TEMPLATE_ROWS } from '../src/shards/_template/data/rows';

const dir = join(cwd(), 'public/assets/baked/skin-fixture');
const rows = parseSkinRows(JSON.parse(readFileSync(join(dir, 'skins.json'), 'utf8')));
const bindings = parseSkinBindings(JSON.parse(readFileSync(join(dir, 'bindings.json'), 'utf8')), rows);
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
type FileRow = Shardfile['files'][number];
const fileRow = (hash: string, kind: FileRow['kind'], bytes: Uint8Array, dependencies: string[]): FileRow => ({ hash, kind, compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies, critical: false });

describe('exported skins are the shardfile client creature views', () => {
  for (const kind of ['grey-blob', 'boar'] as const) it(`${kind}: the state drives the exported clips, vertex for vertex`, async () => {
    const row = rows.find((r) => r.id === kind), binding = bindings.find((b) => b.skin === kind); if (row === undefined || binding === undefined) throw new Error(`missing ${kind}`);
    const glb = Uint8Array.from(readFileSync(join(dir, row.file))), json = new TextEncoder().encode(JSON.stringify({ row, binding })), skinHash = sha(json);
    const lookId = `template.look.${kind}`, looks = [{ id: lookId, species: kind, recipe: SKIN_LOOK_RECIPE, material: null, parameters: { skin: skinHash }, animation: { recipe: SKIN_CLIPS_RECIPE, parameters: { attackSpan: 1 } } }];
    const shardRows = parseRows({ ...TEMPLATE_ROWS, looks }), files = [fileRow(skinHash, 'json', json, [row.file]), fileRow(row.file, 'glb', glb, [])];
    expect(skinLookRules({ rows: shardRows, files, library: [skinHash] })).toEqual([]);
    expect(skinLookRules({ rows: shardRows, files, library: [] })).toEqual(['skin look file references']);
    const scope = new Scope(`client-skin-${kind}`), compiled: Material[] = [];
    const compile = (entry: unknown): Material => { const m = familyMaterial(entry, { toon: new ToonLook(), textures: () => new DataTexture(new Uint8Array(4), 1, 1), scope }); compiled.push(m); scope.onDispose(() => { m.dispose(); }); return m; };
    const skins = await loadClientSkins({ rows: shardRows, files }, new Map([[skinHash, json], [row.file, glb]]), compile, scope);
    const skin = skins.get(lookId); if (skin === undefined) throw new Error('skin look not loaded');
    const look = clientSpeciesLooks(shardRows, new Map(), new Map(), skins).find((entry) => entry.id === lookId);
    if (look === undefined) throw new Error('missing look');
    expect(look.rig).toBe('custom'); expect(look.rigContract).toEqual({ skeleton: row.rig.skeleton, sockets: row.rig.sockets, clips: row.rig.clips });
    const hull = look.skin?.(shardRows.species[0]?.variants[0] ?? { id: 'x', label: 'x', weight: 1, rarity: 'common', scale: [1, 1], hp: 1 }, [], []);
    if (hull === undefined || hull === null) throw new Error('missing hull');
    expect(hull.geometry).toBe(skin.geometry); expect(hull.bones[0]?.name).toBe('body');
    const first = look.material?.({} as never), second = look.material?.({} as never);
    expect(first).not.toBe(second); // one material per rig: the hit flash writes its emissive
    // an instance rig exactly as the factory makes it: position-only joints from the hull's bone defs, bound at rest
    const mesh = new SkinnedMesh(hull.geometry, compiled[0]), bones: Record<string, Bone> = {}, ordered: Bone[] = [];
    for (const def of hull.bones) {
      const bone = new Bone(); bone.name = def.name; const parent = def.parent === null ? null : hull.bones.find((candidate) => candidate.name === def.parent);
      bone.position.set(def.pos[0] - (parent?.pos[0] ?? 0), def.pos[1] - (parent?.pos[1] ?? 0), def.pos[2] - (parent?.pos[2] ?? 0));
      (parent === null || parent === undefined ? mesh : bones[parent.name])?.add(bone); bones[def.name] = bone; ordered.push(bone);
    }
    mesh.updateMatrixWorld(true); mesh.bind(new Skeleton(ordered));
    const reference = await loadSkin(glb, row, binding, compile(binding.material), scope), driver = new SkinDriver(skin, bones);
    // the export also samples the creature's own root (a stagger's shove); in play the simulation moves the root, so the
    // client drives joints only and the reference's root nodes are held at rest for the comparison
    const joints = new Set(row.rig.joints[0]), roots = [...new Set([...reference.rig.clips.values()].flatMap((clip) => clip.tracks.map((track) => track.name.slice(0, track.name.lastIndexOf('.')))))].filter((name) => !joints.has(name)).flatMap((name) => { const node = reference.root.getObjectByName(name); return node === undefined ? [] : [{ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }]; });
    expect(roots.length).toBeLessThanOrEqual(1);
    const state = (over: Partial<SkinDriveState>): SkinDriveState => ({ dt: 1 / 60, t: 0, alive: true, flinch: 0, attack: -1, speed: 0, strafe: 0, scale: 1, phase: 0, state: 'idle', ...over });
    let worst = 0, compared = 0; const perClip: string[] = [];
    const expectPose = (clip: ClipName, time: number): void => {
      reference.play(clip); reference.update(time); for (const root of roots) { root.node.position.copy(root.p); root.node.quaternion.copy(root.q); root.node.scale.copy(root.s); } mesh.updateMatrixWorld(true); reference.root.updateMatrixWorld(true);
      const count = hull.geometry.getAttribute('position').count; const before = worst; worst = 0;
      for (let i = 0; i < count; i += 2) { worst = Math.max(worst, mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld).distanceTo(reference.mesh.getVertexPosition(i, new Vector3()).applyMatrix4(reference.mesh.matrixWorld))); compared++; }
      perClip.push(`${clip}@${time.toFixed(2)}:${worst.toExponential(2)}`); worst = Math.max(before, worst);
    };
    // idle on the clock, through a loop wrap and the longest layer's second wrap
    const longest = Math.max(0, ...(binding.poseLayers?.idle ?? []).map((layer) => layer.period));
    for (const t of [0.37, 1.9, 2 * longest + 0.21]) { driver.step(state({ t })); expectPose('idle', t); }
    if (row.rig.clips.includes('idle.graze')) { driver.step(state({ t: 3.3, state: 'graze' })); expectPose('idle.graze', 3.3); }
    // walking: the clip at the gait phase (layers on the same clock)
    for (const phase of [0.1, 0.65]) { driver.step(state({ speed: 1.2, phase })); expectPose('walk', phase); }
    // the attack: its phase over the sampled span
    for (const attack of [0, 0.4, 0.95]) { driver.step(state({ attack })); expectPose('attack', attack); }
    // a blow: the flinch rises, the reaction plays from its start and then hands back to idle
    driver.step(state({ flinch: 1 })); expectPose('hit', 0);
    for (let frame = 1; frame <= 20; frame++) driver.step(state({ flinch: Math.exp(-frame / 10) }));
    expectPose('hit', 20 / 60);
    // death: from the moment it dies, holding the last frame
    for (let frame = 0; frame <= 30; frame++) driver.step(state({ alive: false }));
    expectPose('die', 30 / 60);
    for (let frame = 0; frame < 240; frame++) driver.step(state({ alive: false }));
    expectPose('die', 270 / 60);
    expect(compared).toBeGreaterThan(100); expect(worst, perClip.join(' ')).toBeLessThan(1e-4);
    // scope-owned: unload disposes the hull, the reference and every material
    let disposed = false; skin.geometry.addEventListener('dispose', () => { disposed = true; });
    scope.dispose(); expect(disposed).toBe(true);
  });
});

describe('the template declares its creatures as exported skins', () => {
  it('both looks are platform.skin library files that validate', async () => {
    const { default: template } = await import('../src/shards/_template/shard.config');
    expect(template.rows.looks.map((look) => [look.species, look.recipe])).toEqual([['grey-blob', SKIN_LOOK_RECIPE], ['boar', SKIN_LOOK_RECIPE]]);
    expect(skinLookRules(template)).toEqual([]);
  });
});
