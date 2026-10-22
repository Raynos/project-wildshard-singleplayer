import { expect,test,vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { fixtureBytes } from './fixtures/nativeBytes';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { PageWildEnvironment } from '../src/game/population/pageGroups';
import { ObservationColumnsV2,type V2ColumnOwners } from '../src/engine/script/observationColumnsV2';
import { parseObservationColumnsV2,ObservationColumnsV2Schema } from '../src/format/scriptObservationColumnsV2';
import { formatJsonSchema } from '../src/sdk/formatJsonSchema';

async function fixture() {
  const rapier = await loadRapier(Uint8Array.from(fixtureBytes(new URL('../public/assets/physics/rapier.wasm',import.meta.url))));
  const first = SIM_LEVEL.entities[0];if (first === undefined) throw new Error('Missing original body');
  const host = createSimHost({ ...SIM_LEVEL,quests: [],entities: [first,{ ...first,id: 'boar:2' }] },{ rapier });
  const actor = host.entities.get('boar:1'), other = host.entities.get('boar:2');
  if (actor === undefined || other === undefined) throw new Error('Missing native actors');
  actor.position.set(4,2,7);host.player.position.set(20,3,30);
  const environment = new PageWildEnvironment(), query = vi.spyOn(environment,'grassHeightAt').mockImplementation((x,z) => x+z);
  environment.playerCrouched = true;environment.playerFwdX = .6;environment.playerFwdZ = .8;
  environment.wind = { x: .8,z: -.6,strength: .7 };
  const clock = { hour: 22,dayPhase: 'night',night: .8 }, weather = { stormActive: false };
  const owners: V2ColumnOwners = { scope: host.scope,self: { group: 'roster',slot: 0,identity: actor.entityId,actor },
    player: host.player,observed: new Map([[10,actor],[11,other]]),t: 121.25,dt: 1/60,environment,
    clock: { ...clock,dayPhase: 'night' },weather };
  return { host,actor,other,owners,environment,query,weather };
}
function values(rows: ReturnType<ObservationColumnsV2['capture']>): Record<string,number> {
  return Object.fromEntries(rows.map(row => [row.name,row.value]));
}
test('finite column admission emits a closed schema and refuses executable or ambiguous selectors', () => {
  const valid = [{ id: 1,name: 'hidden',source: { kind: 'player',field: 'crouched' } }];
  expect(parseObservationColumnsV2(valid)).toEqual(valid);
  expect(formatJsonSchema(ObservationColumnsV2Schema,'draft-2020-12').items).toMatchObject({ additionalProperties: false });
  for (const input of [[...valid,...valid], [{ ...valid[0],id: 0 }], [{ id: 1,name: 'x',source: { kind: 'path',path: 'owner.value' } }],
    [{ id: 1,name: 'x',source: () => 1 }], [{ id: 1,name: 'state',source: { kind: 'herd-state',group: 'h',slot: 0,states: [{ state: 'watch',value: 1 },{ state: 'watch',value: 2 }] } }]])
    expect(() => parseObservationColumnsV2(input)).toThrow();
});
test('real page environment samples the keeper actor exactly, with detached values and no body/RNG step', async () => {
  const f = await fixture();
  const rows = [
    { id: 1,name: 'crouched',source: { kind: 'player',field: 'crouched' } },
    { id: 2,name: 'forwardX',source: { kind: 'player',field: 'forwardX' } },
    { id: 3,name: 'forwardZ',source: { kind: 'player',field: 'forwardZ' } },
    { id: 4,name: 'grass',source: { kind: 'grass',at: 'self' } },
    { id: 5,name: 'windX',source: { kind: 'wind',field: 'x' } },
    { id: 6,name: 'windZ',source: { kind: 'wind',field: 'z' } },
    { id: 7,name: 'strength',source: { kind: 'wind',field: 'strength' } },
    { id: 8,name: 'phase',source: { kind: 'clock',field: 'dayPhase' } },
    { id: 9,name: 'hour',source: { kind: 'clock',field: 'hour' } },
    { id: 10,name: 't',source: { kind: 'time',field: 't' } },
  ];
  try {
    const reader = new ObservationColumnsV2(rows,f.host.scope), rng = f.host.rng.snapshot(), before = f.actor.snapshot();
    const first = reader.capture(f.owners);
    expect(values(first)).toEqual({ crouched: 1,forwardX: .6,forwardZ: .8,grass: 11,windX: .8,windZ: -.6,strength: .7,phase: 2,hour: 22,t: 121.25 });
    expect(f.query).toHaveBeenCalledExactlyOnceWith(4,7);
    expect(f.actor.snapshot()).toEqual(before);expect(f.host.rng.snapshot()).toEqual(rng);
    f.actor.position.x = 8;f.environment.playerCrouched = false;
    expect(values(reader.capture(f.owners))).toMatchObject({ grass: 15,crouched: 0 });
    expect(values(first)).toMatchObject({ grass: 11,crouched: 1 });
  } finally { f.host.dispose(); }
});
test('absent actors keep zero grass; dead actors keep their slot and a replaced identity refuses', async () => {
  const f = await fixture(), reader = new ObservationColumnsV2([{ id: 1,name: 'grass',source: { kind: 'grass',at: 'self' } }],f.host.scope);
  try {
    expect(values(reader.capture({ ...f.owners,self: { group: 'roster',slot: 0,identity: '',actor: null } }))).toEqual({ grass: 0 });
    expect(f.query).not.toHaveBeenCalled();f.actor.hp = 0;
    expect(values(reader.capture(f.owners))).toEqual({ grass: 11 });
    expect(() => reader.capture({ ...f.owners,self: { ...f.owners.self,actor: f.other } })).toThrow('Stale');
  } finally { f.host.dispose(); }
});
test('unset hit time has an explicit validity bit and attack phase retains its -1 sentinel', async () => {
  const f = await fixture(), reader = new ObservationColumnsV2([
    { id: 1,name: 'valid',source: { kind: 'actor',field: 'lastHitValid' } },
    { id: 2,name: 'seconds',source: { kind: 'actor',field: 'lastHitSeconds' } },
    { id: 3,name: 'attack',source: { kind: 'actor',field: 'attackPhase' } },
  ],f.host.scope);
  try {
    expect(values(reader.capture(f.owners))).toEqual({ valid: 0,seconds: 0,attack: -1 });
    f.actor.lastHitT = 12.5;expect(values(reader.capture(f.owners))).toEqual({ valid: 1,seconds: 12.5,attack: -1 });
    f.actor.lastHitT = Infinity;expect(() => reader.capture(f.owners)).toThrow('hit stamp');
  } finally { f.host.dispose(); }
});
test('herd/taming references compare actual bodies and preflight the entire suffix before queries', async () => {
  const f = await fixture(), reader = new ObservationColumnsV2([
    { id: 1,name: 'grass',source: { kind: 'grass',at: 'self' } },
    { id: 2,name: 'same',source: { kind: 'herd',group: 'herds',slot: 0,field: 'sameActor' } },
    { id: 3,name: 'state',source: { kind: 'herd-state',group: 'herds',slot: 0,states: [{ state: 'beaten',value: 7 }] } },
    { id: 4,name: 'companion',source: { kind: 'taming',field: 'companion' } },
    { id: 5,name: 'bonded',source: { kind: 'taming',field: 'bonded' } },
  ],f.host.scope);
  const herd = { cx: 4,cz: 7,trust: 31,alert: 20,mode: 'flee',stallionState: 'beaten',stallion: f.actor };
  const owner = { ...f.owners,herds: [{ group: 'herds',slot: 0,owner: { ...herd,mode: 'flee',stallionState: 'beaten' } }],taming: { phase: 'bonded',companion: f.actor } };
  try {
    // Both animals share species/variant. Identity, never those labels, controls the comparison.
    const input: V2ColumnOwners = { ...owner,herds: [{ group: 'herds',slot: 0,owner: { ...herd,mode: 'flee',stallionState: 'beaten' } }] };
    expect(values(reader.capture(input))).toEqual({ grass: 11,same: 1,state: 7,companion: 10,bonded: 1 });
    const other: V2ColumnOwners = { ...input,herds: [{ group: 'herds',slot: 0,owner: { ...herd,mode: 'flee',stallionState: 'beaten',stallion: f.other } }] };
    expect(values(reader.capture(other))).toMatchObject({ same: 0 });
    f.query.mockClear();
    expect(() => reader.capture({ ...input,observed: new Map() })).toThrow('identity');expect(f.query).not.toHaveBeenCalled();
  } finally { f.host.dispose(); }
});
test('owner retirement, missing concrete services and later slot effects are observed without caching', async () => {
  const f = await fixture(), reader = new ObservationColumnsV2([
    { id: 1,name: 'grass',source: { kind: 'grass',at: 'self' } },
    { id: 2,name: 'storm',source: { kind: 'weather',field: 'stormActive' } },
  ],f.host.scope);
  try {
    expect(values(reader.capture(f.owners))['storm']).toBe(0);f.weather.stormActive = true;
    expect(values(reader.capture(f.owners))['storm']).toBe(1);
    const foreign = new Scope('other');
    try { expect(() => reader.capture({ ...f.owners,scope: foreign })).toThrow('owner'); } finally { foreign.dispose(); }
    f.query.mockClear();const { weather: _weather,...missing } = f.owners;
    expect(() => reader.capture(missing)).toThrow('weather');expect(f.query).not.toHaveBeenCalled();
    f.host.scope.dispose();expect(() => reader.capture(f.owners)).toThrow('owner');
  } finally { f.host.dispose(); }
});

test('declared metadata is immutable and preflights without sampling live owners', async () => {
  const f = await fixture();
  const states = [{ state: 'beaten',value: 7 }];
  const input = [
    { id: 1,name: 'grass',source: { kind: 'grass',at: 'self' } },
    { id: 2,name: 'state',source: { kind: 'herd-state',group: 'herds',slot: 0,states } },
  ];
  try {
    const reader = new ObservationColumnsV2(input,f.host.scope), columns = reader.declaredColumns;
    expect(columns).toEqual(input);expect(reader.declaredColumns).toBe(columns);
    expect(f.query).not.toHaveBeenCalled();
    expect(Object.isFrozen(columns)).toBe(true);
    for (const column of columns) {
      expect(Object.isFrozen(column)).toBe(true);expect(Object.isFrozen(column.source)).toBe(true);
      expect(() => Object.defineProperty(column,'id',{ value: 99 })).toThrow();
      if (column.source.kind === 'herd-state') {
        expect(Object.isFrozen(column.source.states)).toBe(true);
        for (const code of column.source.states) {
          expect(Object.isFrozen(code)).toBe(true);
          expect(() => Object.defineProperty(code,'value',{ value: 99 })).toThrow();
        }
      }
    }
    states.push({ state: 'watch',value: 8 });
    expect(reader.declaredColumns).toEqual([
      { id: 1,name: 'grass',source: { kind: 'grass',at: 'self' } },
      { id: 2,name: 'state',source: { kind: 'herd-state',group: 'herds',slot: 0,states: [{ state: 'beaten',value: 7 }] } },
    ]);
    expect(values(reader.capture({ ...f.owners,herds: [{ group: 'herds',slot: 0,owner: null }] }))).toEqual({ grass: 11,state: 0 });
    expect(f.query).toHaveBeenCalledExactlyOnceWith(4,7);
  } finally { f.host.dispose(); }
});
