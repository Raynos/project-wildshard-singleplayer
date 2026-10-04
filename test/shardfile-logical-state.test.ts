import { describe, expect, it } from 'vitest';
import { logicalStateFromLane, restoreLogicalLane } from '../src/game/shardfile/logicalState';
import { DeclaredScriptWorld } from '../src/engine/script/state';

const numeric = { contract: JSON.stringify({ state: {
  shared: [{ id: 101, name: 'door', type: 'bool' }], player: [{ id: 201, name: 'progress', type: 'i32' }],
} }), world: { shared: [1], players: [{ actorId: 'alice', values: [7] }] }, host: { modules: ['never migrate this'] } };
const composed = { contract: JSON.stringify({ roles: [{ id: 'brain', events: 'consume' }, { id: 'numeric', events: 'deliver' }] }),
  roles: [{ id: 'brain', state: JSON.stringify({ contract: 'brain-policy', world: [{ fields: { 1: 2, 2: 3, 3: 4, 4: 5 } }] }) },
    { id: 'numeric', state: JSON.stringify(numeric) }], host: { modules: ['never migrate this either'] } };
describe('logical declared fields across lane implementations', () => {
  it('reads old contract/world saves and the explicit numeric role identically, omitting executable and brain state', () => {
    const old = logicalStateFromLane(4, JSON.stringify(numeric)), current = logicalStateFromLane(4, JSON.stringify(composed));
    expect(current).toEqual(old);
    expect(current).toEqual({ version: 4, shared: [{ id: 101, name: 'door', type: 'bool', value: true }],
      players: [{ actorId: 'alice', fields: [{ id: 201, name: 'progress', type: 'i32', value: 7 }] }] });
    expect(logicalStateFromLane(4, null)).toEqual({ version: 4, shared: [], players: [] });
  });
  it('refuses ambiguous, missing, mismatched and nonnumeric role snapshots', () => {
    const role = composed.roles[1]; if (role === undefined) throw new Error('Missing fixture role');
    expect(() => logicalStateFromLane(4, JSON.stringify({ ...composed, roles: [...composed.roles, role] }))).toThrow('roles');
    expect(() => logicalStateFromLane(4, JSON.stringify({ ...composed, roles: composed.roles.slice(0, 1) }))).toThrow();
    expect(() => logicalStateFromLane(4, JSON.stringify({ ...composed, contract: JSON.stringify({ roles: [{ id: 'brain', events: 'consume' }, { id: 'numeric', events: 'consume' }] }) }))).toThrow('numeric role');
    expect(() => logicalStateFromLane(4, JSON.stringify({ ...composed, roles: composed.roles.map(entry => entry.id === 'numeric' ? { ...entry, state: '{}' } : entry) }))).toThrow();
    expect(() => logicalStateFromLane(4, JSON.stringify({ ...numeric, world: { shared: [0.5], players: [] } }))).toThrow('field value');
  });
  it('overlays only stable declared values into a freshly constructed numeric world', () => {
    const world = new DeclaredScriptWorld({ fields: {}, events: [], archetypes: [], maxEntities: 1 },
      [{ id: 1, name: 'alice', position: [0, 0, 0], fields: {}, frozen: false, interactive: true }], {
        shared: [{ id: 101, name: 'door', type: 'bool', privacy: 'public', default: 0, min: 0, max: 1 }],
        player: [{ id: 201, name: 'progress', type: 'i32', privacy: 'owner', default: 0, min: 0, max: 10 }],
      }, new Map([[1, 'alice']]));
    restoreLogicalLane({ world }, logicalStateFromLane(4, JSON.stringify(composed)));
    expect(world.view('alice')).toEqual({ shared: { door: 1 }, player: { progress: 7 } });
    expect(world.entity(1)?.position).toEqual([0, 0, 0]);
    expect(() => restoreLogicalLane(undefined, logicalStateFromLane(4, JSON.stringify(composed)))).toThrow('Missing');
  });
});
