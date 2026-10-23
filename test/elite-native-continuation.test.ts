import { expect, test, vi } from 'vitest';
import { NativeEliteContinuation, type EliteContinuationMember } from '../src/engine/ai/eliteContinuation';
import { NativeEliteProjection } from '../src/engine/ai/eliteRoster';
import { NativeEliteKernels } from '../src/engine/ai/eliteKernels';
import { PackBrain, type PackPorts } from '../src/engine/ai/pack';
import { nativeGroupBrain } from '../src/format/groupBrains';
import brainRows from '../src/shards/nalati-grasslands/data/brains.json' with { type: 'json' };
import { HerdBrain, type HerdPorts } from '../src/engine/ai/herd';
import type { AnimalSim } from '../src/engine/entities/AnimalSim';
import type { EliteContinuationRows } from '../src/format/eliteContinuation';
import { eliteBindings } from '../src/game/shardfile/eliteEncounters';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { nativeKernelOwners } from './fixtures/nativeEliteKernelOwners';
import { nativeEliteCore } from './fixtures/nativeEliteCore';
import { legacyDouble } from './fake/FakeGame';
import admission from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with { type: 'json' };

function fixture(withPack = false) {
  const f = nativeKernelOwners(), other = nativeKernelOwners(), bindings = eliteBindings(), core = nativeEliteCore(f.host);
  const kernels = new NativeEliteKernels(f.rows, { ...f.loans, brains: bindings.brains, lifecycle: core });
  const members: EliteContinuationMember[] = [], rows: EliteContinuationRows['rows'] = [];
  const actors = [f.actor, other.actor];
  const add = (member: EliteContinuationMember, id: string): void => {
    members.push(member);
    core.add({ def: { id, rule: 'always', lair: { x: 0, z: 0, r: 1 }, awareR: 10, engageR: 3, leashR: 20, respawnMin: 1 },
      get animal() { return member.animal; }, spawn: () => undefined, despawn: () => undefined, tick: () => undefined,
      enterPhase2: () => undefined, reset: () => undefined, trophy: () => undefined });
  };
  f.rows.forEach((row, i) => {
    const actor = actors[i]; if (actor === undefined) throw new Error('Missing fixture actor');
    Object.defineProperty(actor, 'entityId', { value: `body:${String(i)}` }); actor.variant = row.id; Object.defineProperty(actor, 'maxHp', { value: 100 }); f.host.entities.set(actor.entityId, actor);
    const state = { animal: actor, phase2: false, pack: null, adopted: true, detached: false };
    const controller = kernels.create(row.id, state); add(Object.assign(state, { controller }), row.id);
    rows.push({ def: { id: row.id }, snapshot: `unit${String(i)}`, member: { kind: actor.kind, variant: actor.variant } });
  });
  const actor = f.actor;
  const guard = new HerdBrain([actor], { walkSpeed: 1, trotSpeed: 2, gallopSpeed: 3, chargeSpeed: 3, sightRadius: 10, grazingSightRadius: 5,
    coneAngle: 1, hearing: [1, 2, 3, 4], alertThreshold: .5, flightMinDistance: 1, flightMaxDistance: 10,
    stallionVariant: actor.variant, foalPrefix: 'young', snortCue: 'snort', neighCue: 'neigh', squealCue: 'squeal' }, legacyDouble<HerdPorts<AnimalSim>>({}));
  const groups: { packs: PackBrain<AnimalSim>[]; herds: HerdBrain<AnimalSim>[] } = { packs: [], herds: [guard] };
  if (withPack) {
    const spec = nativeGroupBrain({ ...brainRows.pack, id: 'quarry.group', home: [0, 0], members: [other.actor.entityId] });
    if (spec.kind !== 'pack') throw new Error('Missing group profile');
    const pack = new PackBrain([other.actor], 0, 0, spec, legacyDouble<PackPorts<AnimalSim>>({}));
    const first = members[0], row = rows[0]; if (first === undefined || row === undefined) throw new Error('Missing member');
    groups.packs.push(pack); first.pack = pack; row.pack = { variants: [other.actor.variant], kind: other.actor.kind, idPrefix: 'body:' };
  }
  const projection = new NativeEliteProjection({ signal: 'argymaqTick', states: { display: 1 }, bondedState: 'bonded' }, ReturnProgram.native(f.host, admission), f.scope);
  const member = { animal: actor, phase2: false, pack: null, adopted: true, detached: false, controller: projection };
  add(member, 'quarry.borrowed');
  rows.push({ def: { id: 'quarry.borrowed' }, snapshot: 'borrowed', member: { kind: actor.kind, variant: actor.variant }, continuation: { borrowed: { group: 0, role: 'guard' }, detachable: true } });
  const input = { version: 1, wire: { detached: 'released' }, rows }, loans = { host: f.host, core, members, bindings, kernels, groups };
  const owner = new NativeEliteContinuation(input, loans);
  return { ...f, other, core, members, bindings, input, loans, owner, groups, guard, projection, borrowed: member,
    close: () => { f.scope.dispose(); other.scope.dispose(); } };
}

test('whole native continuation suffix refusal performs no controller, Core or binding mutation', () => {
  const f = fixture();
  try {
    f.bindings.pinned.add(f.actor);
    const saved = f.owner.snapshot(), before = JSON.stringify(saved), writes = vi.spyOn(f.core, 'restoreClocks');
    const last = saved['borrowed']; if (last === null || typeof last !== 'object' || Array.isArray(last)) throw new Error('Missing saved member');
    expect(() => f.owner.restore({ ...saved, borrowed: { ...last, keeper: { laneT: 0 } } })).toThrow();
    expect(writes).not.toHaveBeenCalled(); expect(f.bindings.pinned.has(f.actor)).toBe(true); expect(JSON.stringify(f.owner.snapshot())).toBe(before);
    f.owner.restore(saved); expect(writes).toHaveBeenCalledTimes(1); expect(JSON.stringify(f.owner.snapshot())).toBe(before);
  } finally { f.close(); }
});

test('borrowed native continuation retains raw state strings, signed zero and legacy elapsed', () => {
  const f = fixture();
  try {
    const state = { laneT: -0, runT: -3, lastState: 'future-state', laneFrom: [-0, 2, 3], laneTo: [4, 5, -0] };
    f.projection.restore(state);
    const saved = f.owner.snapshot(); f.owner.restore(saved);
    expect(f.projection.snapshot()).toEqual({ ...state, elapsed: 0 });
    expect(Object.is(f.projection.snapshot().laneFrom[0], -0)).toBe(true);
    const prepared = f.owner.prepareRestore(saved); f.guard.stallion = null;
    const before = JSON.stringify(f.core.snapshot()); expect(prepared).toThrow('Changed elite continuation binding'); expect(JSON.stringify(f.core.snapshot())).toBe(before);
    expect(() => f.owner.restore(saved)).toThrow('Incompatible encounter member binding');
    f.borrowed.detached = true; f.core.won('quarry.borrowed');
    const detached = f.owner.snapshot(); expect(detached['released']).toBe(true);
    expect(() => f.owner.restore(detached)).not.toThrow();
  } finally { f.close(); }
});

test('prepared native continuation pins concrete scopes, members, controllers and group arrays', () => {
  for (const replacement of ['controller', 'member', 'groups', 'actor', 'method', 'scope']) {
    const f = fixture();
    try {
      const prepared = f.owner.prepareRestore(f.owner.snapshot()), before = JSON.stringify(f.core.snapshot());
      if (replacement === 'controller') Object.defineProperty(f.members[0], 'controller', { value: f.projection });
      else if (replacement === 'member') f.members.reverse();
      else if (replacement === 'groups') f.groups.herds = [...f.groups.herds];
      else if (replacement === 'actor') f.host.entities.delete(f.actor.entityId);
      else if (replacement === 'method') f.projection.prepareRestore = () => () => undefined;
      else f.scope.dispose();
      expect(prepared).toThrow(); expect(JSON.stringify(f.core.snapshot())).toBe(before);
    } finally { f.close(); }
  }
});

test('native continuation rows refuse getters, duplicate aliases and missing native group roles', () => {
  const f = fixture(); let reads = 0;
  try {
    expect(() => new NativeEliteContinuation({ get rows() { reads++; return f.input.rows; } }, f.loans)).toThrow('plain JSON');
    expect(reads).toBe(0);
    expect(() => new NativeEliteContinuation({ ...f.input, wire: { detached: 'entries' } }, f.loans)).toThrow('Invalid elite continuation');
    const rows = f.input.rows.map(row => ({ ...row, snapshot: 'same' }));
    expect(() => new NativeEliteContinuation({ ...f.input, rows }, f.loans)).toThrow('Invalid elite continuation');
    expect(() => new NativeEliteContinuation(f.input, { ...f.loans, groups: { packs: [], herds: [] } })).toThrow('Invalid elite continuation');
  } finally { f.close(); }
});


test('prepared native restore pins real pack membership before the first Core or binding write', () => {
  const f = fixture(true);
  try {
    const before = JSON.stringify(f.owner.snapshot()), prepared = f.owner.prepareRestore(f.owner.snapshot());
    const pack = f.groups.packs[0]; if (pack === undefined) throw new Error('Missing group');
    pack.members.splice(0, 1, f.actor);
    expect(prepared).toThrow('Changed elite continuation binding'); expect(JSON.stringify(f.owner.snapshot())).toBe(before);
    expect(() => f.owner.restore(f.owner.snapshot())).toThrow('Incompatible encounter pack binding');
  } finally { f.close(); }
});

test('native prepared restore copies input and performs no AS, RNG or continuation writes before commit', () => {
  const f = fixture(true);
  try {
    const saved = f.owner.snapshot(), before = JSON.stringify(saved), random = f.host.rng.snapshot();
    const prepared = f.owner.prepareRestore(saved);
    expect(JSON.stringify(f.owner.snapshot())).toBe(before); expect(f.host.rng.snapshot()).toEqual(random);
    const state = saved['unit0']; if (state === null || typeof state !== 'object' || Array.isArray(state)) throw new Error('Missing state');
    state['keeper'] = { bad: true };
    prepared(); expect(JSON.stringify(f.owner.snapshot())).toBe(before); expect(f.host.rng.snapshot()).toEqual(random);
  } finally { f.close(); }
});


test('a guard swapped during controller preparation refuses before Core or bindings commit', () => {
  const f = fixture();
  try {
    const saved = f.owner.snapshot(), before = JSON.stringify(f.core.snapshot()), pinned = f.bindings.pinned;
    pinned.add(f.actor);
    const original = f.projection.prepareRestore.bind(f.projection);
    const prepare = vi.spyOn(f.projection, 'prepareRestore').mockImplementation(value => {
      const commit = original(value); f.guard.stallion = f.other.actor; return commit;
    });
    try {
      const owner = new NativeEliteContinuation(f.input, f.loans);
      expect(() => owner.prepareRestore(saved)).toThrow('Changed elite continuation binding');
      expect(JSON.stringify(f.core.snapshot())).toBe(before); expect(pinned.has(f.actor)).toBe(true);
    } finally { prepare.mockRestore(); }
  } finally { f.close(); }
});

test('pack metadata changed during suffix admission refuses before Core or binding mutation', () => {
  const f = fixture(true);
  try {
    const saved = f.owner.snapshot(), before = JSON.stringify(f.core.snapshot());
    const original = f.projection.prepareRestore.bind(f.projection);
    const prepare = vi.spyOn(f.projection, 'prepareRestore').mockImplementation(value => {
      const commit = original(value); Object.defineProperty(f.other.actor, 'kind', { value: 'other-kind' }); return commit;
    });
    try {
      const owner = new NativeEliteContinuation(f.input, f.loans);
      expect(() => owner.prepareRestore(saved)).toThrow('Changed elite continuation binding');
      expect(JSON.stringify(f.core.snapshot())).toBe(before);
    } finally { prepare.mockRestore(); }
  } finally { f.close(); }
});
