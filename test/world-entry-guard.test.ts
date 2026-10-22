import { expect, test } from 'vitest';
import { Group } from 'three';
import { Scope } from '../src/engine/app/scope';
import type { Piece } from '../src/engine/world/registry';
import { readColliderRows } from '../src/engine/models/colliders';
import { WorldEntry } from '../src/game/shardfile/worldEntry';
import { parseWorldEntry } from '../src/format/worldEntry';
import { GrappleTool, grappleGuard } from '../src/game/grapple/tool';
import type { GrappleSim } from '../src/game/grapple/sim';
import type { ShardContext } from '../src/game/plugin/context';
import { parseGrappleProfile, type GrappleRows } from '../src/format/grapple';
import { ItemCatalogue } from '../src/game/plugin/nativeItems';
import { nineWorldEntry } from '../src/shards/nine-dragon-stack/generators/worldEntry';
import { nineWorldInstallRows } from '../src/shards/nine-dragon-stack/generators/physicsPlacements';
import items from '../src/shards/nine-dragon-stack/data/items.json' with { type: 'json' };
import profile from '../src/shards/nine-dragon-stack/data/grappleProfile.json' with { type: 'json' };
import { legacyDouble } from './fake/FakeGame';

const piece = { kind: 'piece', id: 'gate', name: 'Gate', file: 'gate.json', category: 'buildings', surface: 'stone',
  colliders: [], floors: [], floorPolicy: 'first', solidFloor: false, object: null };
const guarded = { ...piece, active: 'grapple-closed' };
const rows = { blocks: { pieces: [{ ...piece, id: 'first' }, guarded] } };

test.each(['capped', 'open'] as const)('declared %s guard keeps original colliders and the last registration', async variant => {
  const scope = new Scope('entered'), pieces: Piece[] = [], root = new Group();
  const install = nineWorldInstallRows(), original = (variant === 'capped' ? install.standalone : install.cell).find(row => row.id === 'nds-grapple-guard');
  if (original === undefined) throw new Error('Missing original guard');
  try {
    await WorldEntry.admit(nineWorldEntry(), { scope, root, tier: 'phone', variant, piece: entry => { pieces.push(entry); } }).run('pieces');
    const guard = pieces.at(-1);
    if (guard === undefined) throw new Error('Missing registered guard');
    expect(pieces.filter(entry => entry.id === original.id)).toHaveLength(1);
    expect(guard.id).toBe(original.id); expect(guard.name).toBe(original.name); expect(guard.file).toBe(original.file);
    expect(guard.colliders).toEqual(readColliderRows(original.colliders, { kinds: ['box', 'treads'], surfaces: ['stone'], requireSurface: true }));
    expect(guard.object).toBeUndefined(); expect(guard.floor).toBeUndefined();
    expect(guard.follows).toBeInstanceOf(Group); expect(guard.follows?.matrix.elements).toEqual(new Group().matrix.elements);
    expect(guard.active?.()).toBe(true);
    const tool = new GrappleTool(legacyDouble<ShardContext>({ scope }), {
      equipment: new ItemCatalogue(items).equipment('tool.fei-zhua'), profile: parseGrappleProfile(profile),
      presentation: legacyDouble<GrappleRows>({}), hooks: [],
    });
    let open = true;
    tool.sim = legacyDouble<GrappleSim>({ guardOpen: () => open });
    grappleGuard(scope).bind(tool);
    expect(guard.active?.()).toBe(false);
    open = false; expect(guard.active?.()).toBe(true);
  } finally { scope.dispose(); }
});

test('active policy and missing owner refuse before any earlier piece registers', () => {
  let effects = 0;
  const ports = { root: new Group(), tier: 'phone' as const, piece: () => { effects++; } };
  expect(() => WorldEntry.admit(rows, ports)).toThrow('entered scope');
  expect(() => parseWorldEntry({ blocks: { pieces: [{ ...piece, active: 'callback' }] } })).toThrow();
  expect(effects).toBe(0);
  const scope = new Scope('ended'); scope.dispose();
  expect(() => WorldEntry.admit(rows, { ...ports, scope })).toThrow('owner ended');
  expect(effects).toBe(0);
});

test('retirement between rows refuses later registration and closes the original guard', async () => {
  const parent = new Scope('resident'), scope = parent.child('entered'), guard = grappleGuard(scope);
  const pieces: Piece[] = [];
  parent.onDispose(() => undefined);
  const retirement = parent.disposeSteps();
  const entry = WorldEntry.admit(rows, { root: new Group(), tier: 'phone', scope, piece: row => {
    pieces.push(row); retirement.next();
  } });
  await expect(entry.run('pieces')).rejects.toThrow('owner ended');
  expect(scope.disposed).toBe(false); expect(scope.disposing).toBe(true);
  expect(pieces.map(row => row.id)).toEqual(['first']); expect(guard.open()).toBe(false);
  for (const _step of retirement) { /* Finish the original owner cleanup. */ }
});

test('skipped guard variants do not require or create an entered owner', async () => {
  const pieces: Piece[] = [];
  await WorldEntry.admit({ blocks: { pieces: [{ ...guarded, when: { variant: 'other' } }] } }, {
    root: new Group(), tier: 'phone', variant: 'current', piece: row => { pieces.push(row); },
  }).run('pieces');
  expect(pieces).toHaveLength(0);
});
