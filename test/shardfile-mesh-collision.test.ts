import { hashImmutableBytes as hash } from '../src/sdk/immutable';
import { describe, expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { meshCollision } from '../src/sdk/meshCollision';
import { parseShardfile, shardfileRules } from '../src/game/shardfile/schema';
import { meshCollisionRules, validateMeshCollisionAssets } from '../src/game/shardfile/meshCollision';
import { assetCost } from '../src/game/shardfile/assets';
import { validateShardfileAssets } from '../src/game/shardfile/validate';
import { encodeMeshCollision, meshCollisionCost } from '../src/engine/core/meshCollision';

const mesh = { vertices: Float32Array.of(0, 0, 0, 10, 0, 0, 0, 0, 10), indices: Uint32Array.of(0, 2, 1) };
function fixture() {
  const source = emptyShardfile({ slug: 'mesh-world', name: 'Mesh world', author: 'Fixture', revision: 1, seed: 1 });
  const bytes = encodeMeshCollision(mesh), file = hash(bytes), assets = new Map([[file, bytes]]);
  const cost = assetCost('binary', bytes);
  source.files.push({ hash: file, kind: 'binary', compressed: bytes.length, ...cost, dependencies: [], critical: true });
  source.critical.push(file); source.budgets.sim = { resident: cost.decoded, compressed: bytes.length };
  source.meshCollision = { version: 1, tiles: [{ x: 4, z: 4, file }], panels: [] };
  return { source, assets, bytes, file };
}
describe('compiled mesh collision admission', () => {
  it('keeps old author products empty-compatible and admits the additive metadata through the SDK', () => {
    const { source, assets } = fixture();
    expect(emptyShardfile(source.identity).meshCollision).toBeNull();
    expect(meshCollision(source.meshCollision)).toEqual(source.meshCollision);
    expect(parseShardfile(source).meshCollision).toEqual(source.meshCollision);
    expect(shardfileRules(source)).toEqual([]); expect(() => validateMeshCollisionAssets(source, assets)).not.toThrow();
  });
  it.each(['duplicate-address', 'duplicate-file', 'address', 'version', 'callback', 'panel-identity'] as const)('refuses malformed metadata: %s', kind => {
    const { source, file } = fixture();
    const tile = { x: 4, z: 4, file };
    if (kind === 'duplicate-address') expect(() => meshCollision({ version: 1, tiles: [tile, { ...tile, file: 'a'.repeat(64) }], panels: [] })).toThrow();
    if (kind === 'duplicate-file') expect(() => meshCollision({ version: 1, tiles: [tile, { ...tile, x: 5 }], panels: [] })).toThrow();
    if (kind === 'address') expect(() => meshCollision({ version: 1, tiles: [{ ...tile, x: 8 }], panels: [] })).toThrow();
    if (kind === 'version') expect(() => meshCollision({ ...source.meshCollision, version: 2 })).toThrow();
    if (kind === 'callback') expect(() => meshCollision({ ...source.meshCollision, install: () => undefined })).toThrow('JSON data only');
    if (kind === 'panel-identity') expect(() => meshCollision({ version: 1, tiles: [], panels: [{ id: 'bad id', panel: 'door', file, initialActive: true }] })).toThrow();
  });
  it('requires independent declared binary critical roots and excludes heightfields', () => {
    const { source, file } = fixture();
    expect(meshCollisionRules({ ...source, critical: [] })).toContain('mesh collision chunks are independent critical binary roots');
    expect(meshCollisionRules({ ...source, files: source.files.map(row => ({ ...row, kind: 'glb' })) })).toContain('mesh collision chunks are independent critical binary roots');
    expect(meshCollisionRules({ ...source, files: source.files.map(row => ({ ...row, dependencies: [file] })) })).toContain('mesh collision chunks are independent critical binary roots');
    expect(meshCollisionRules({ ...source, terrain: {} })).toContain('mesh collision and terrain are mutually exclusive');
    source.critical = []; expect(() => parseShardfile(source)).toThrow();
  });
  it('checks actual WMC1 positions against the declared tile and never accepts a wrong binary format', () => {
    const { source, assets, file } = fixture();
    source.meshCollision = { version: 1, tiles: [{ x: 0, z: 0, file }], panels: [] };
    expect(() => validateMeshCollisionAssets(source, assets)).toThrow('outside declared tile');
    source.meshCollision.tiles[0] = { x: 4, z: 4, file };
    expect(() => validateMeshCollisionAssets(source, new Map())).toThrow('Missing mesh');
    expect(() => validateMeshCollisionAssets(source, new Map([[file, new Uint8Array(24)]]))).toThrow('Mesh collision');
  });
  it('preflights panel render identities and the combined collider namespace', () => {
    const { source, file } = fixture();
    source.meshCollision = { version: 1, tiles: [], panels: [{ id: 'door.collider', panel: 'door', file, initialActive: false }] };
    expect(meshCollisionRules(source)).toContain('mesh collision panels reference declared prop panels');
    const props = { panels: [{ id: 'door' }], colliders: [{ id: 'door.collider' }] };
    expect(meshCollisionRules({ ...source, props })).toContain('unique combined mesh and prop collider identities');
    expect(meshCollisionRules({ ...source, props: { panels: props.panels, colliders: [] } })).toEqual([]);
  });
  it('uses existing published-state target rules for a named mesh panel collider', () => {
    const { source, file } = fixture(), render = 'a'.repeat(64), module = 'b'.repeat(64);
    source.meshCollision = { version: 1, tiles: [], panels: [{ id: 'door.collider', panel: 'door', file, initialActive: true }] };
    source.files.push({ hash: render, kind: 'glb', compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false },
      { hash: module, kind: 'wasm', compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true });
    source.library.push(render); source.critical.push(module); source.sim.scripts.push(module);
    source.sim.bindings.push({ module, entity: 1, actorId: 'actor.player', kind: 'server' });
    source.state.shared.push({ id: 101, name: 'door.open', type: 'bool', privacy: 'public', default: false });
    source.props = { version: 1, family: 'pbr', panels: [{ id: 'door', file: render, visible: true }], models: [], tiles: [], far: null, textures: [], colliders: [] };
    source.targets.panels.push({ panel: 'door', scope: 'shared', fieldId: 101, equals: 1, visibleWhenMatched: false, colliders: ['door.collider'], activeWhenMatched: false });
    expect(() => parseShardfile(source)).not.toThrow();
    const binding = source.targets.panels[0]; if (binding === undefined) throw new Error('Missing mesh target fixture');
    binding.colliders.push('missing');
    expect(shardfileRules(source)).toContain('declared target panel/collider references');
    expect(() => parseShardfile(source)).toThrow('shardfile semantic rules');
  });
  it('derives the provisional cost from bytes and rejects understated declarations before staged runtime refusal', () => {
    const { source, assets, bytes } = fixture();
    expect(assetCost('binary', bytes)).toEqual(meshCollisionCost(mesh));
    source.files = source.files.map(row => ({ ...row, decoded: row.decoded - 1 }));
    expect(() => validateShardfileAssets(source, assets, hash)).toThrow('asset cost declaration understated');
    source.files = source.files.map(row => ({ ...row, decoded: row.decoded + 1 }));
    expect(() => validateShardfileAssets(source, assets, hash)).toThrow('requires continuous road-height ground');
  });
});
