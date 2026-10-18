import { expect, test, vi } from 'vitest';
import { SkinnedMesh, Scene, Vector3 } from 'three';
import { Puffs } from '../src/shards/pine-hollow/runtime/combat/fxKit';
import { StagLead } from '../src/shards/pine-hollow/quest/stagLead';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { StagWalk as OriginalWalk } from '../src/shards/pine-hollow-legacy/quest/stagWalk';
import program from '../src/shards/pine-hollow/behaviour/life.generated.json' with { type: 'json' };
import { parseQuestLeadRows } from '../src/shards/pine-hollow/generators/sections';
import leadJson from '../src/shards/pine-hollow/data/questLead.json' with { type: 'json' };

const LEAD = parseQuestLeadRows(leadJson);

function fixture() {
  const effects: string[] = [], scene = new Scene();
  const actor: ReturnType<ConstructorParameters<typeof StagLead>[1]['spawn']> = {
    position: new Vector3(), yaw: 0, herd: 0, mesh: new SkinnedMesh(), alive: true, hidden: false, lookTarget: new Vector3(), lookWeight: 0,
    setDrawLod: () => { effects.push('lod'); }, update: () => { effects.push('update'); },
    sampleTerrain: () => { effects.push('terrain'); }, setMotion: (_yaw, speed) => { effects.push(speed > 0 ? 'trot' : 'stop'); },
    place: (x, z, yaw) => { effects.push('place'); actor.position.set(x, 0, z); actor.yaw = yaw; },
  };
  const animals: ConstructorParameters<typeof StagLead>[1] = { animals: [],
    spawn: (_kind, x, z, yaw) => { effects.push('spawn'); actor.position.set(x, 0, z); actor.yaw = yaw; animals.animals.push(actor); scene.add(actor.mesh); return actor; },
    onSound: () => { effects.push('call'); },
  };
  vi.spyOn(Puffs.prototype, 'burst').mockImplementation((_at, from) => { effects.push(from === 2.6 ? 'appear-puff' : 'fade-puff'); });
  const lead = new StagLead(scene, animals, { ...LEAD, program });
  lead.onAppear = first => { effects.push(first ? 'first' : 'appear'); };
  lead.onDone = () => { effects.push('done'); };
  return { lead, actor, animals, effects };
}

test('page appearance, actor integration, decisions and fade effects retain their phase order', () => {
  const { lead, actor, animals, effects } = fixture(), player = new Vector3(30, 0, -30);
  lead.update(0.1, 1, true, player);
  expect(lead.active).toBe(true); expect(animals.animals).toEqual([]);
  expect(effects.indexOf('first')).toBeLessThan(effects.indexOf('update'));
  expect(effects.indexOf('update')).toBeLessThan(effects.indexOf('stop'));
  effects.length = 0; player.copy(actor.position);
  lead.update(0.1, 1.1, true, player);
  expect(effects).not.toContain('trot');
  effects.length = 0; lead.update(1.4, 2.5, true, player);
  expect(effects.indexOf('update')).toBeLessThan(effects.indexOf('trot'));
  expect(effects.indexOf('trot')).toBeLessThan(effects.indexOf('fade-puff'));
  expect(effects.indexOf('fade-puff')).toBeLessThan(effects.indexOf('call'));
  expect(actor.mesh.visible).toBe(false);
  effects.length = 0; lead.update(1.2, 3.7, true, player);
  expect(effects.indexOf('update')).toBeLessThan(effects.indexOf('place'));
  expect(effects.indexOf('place')).toBeLessThan(effects.indexOf('appear'));
  effects.length = 0; lead.update(0.1, 3.8, false, player);
  expect(lead.active).toBe(false); expect(actor.alive).toBe(false); expect(actor.hidden).toBe(true);
  expect(effects).not.toContain('update'); expect(effects).not.toContain('done');
});

test('the shared walk completes all bends once and resumes its existing saved fields', () => {
  const { lead, effects } = fixture();
  let t = 0;
  for (const [x, z] of LEAD.path) {
    const player = new Vector3(x, 0, z);
    lead.update(0.1, t += 0.1, true, player);
    lead.update(1.4, t += 1.4, true, player);
    if (lead.active) lead.update(1.2, t += 1.2, true, player);
  }
  expect(lead.active).toBe(false);
  expect(effects.filter(effect => effect === 'spawn')).toHaveLength(1);
  expect(effects.filter(effect => effect === 'call')).toHaveLength(LEAD.path.length);
  expect(effects.filter(effect => effect === 'done')).toHaveLength(1);
  const guest = ReturnProgram.page(program);
  expect(guest.project('lead', { i: 2, mode: 3, elapsed: 0.8, begin: 0, dt: 0.4, on: 1, playerX: 0, playerZ: 0, atX: 86, atZ: 16 }))
    .toEqual({ i: 2, mode: 1, elapsed: 0, event: 2 });
});

test('v1 lead projections preserve cancellations and old-save suffixes', () => {
  const guest = ReturnProgram.page(program), modes = ['none', 'stare', 'trot', 'gone'] as const;
  // The sealed predecessor is an independent oracle for the original law.
  for (const mode of modes) for (const i of [0, 2, LEAD.path.length - 1]) {
    const original = new OriginalWalk(); original.load({ i, mode, t: 0.8 });
    const state = { i, mode: modes.indexOf(mode), elapsed: 0.8 };
    for (let tick = 0; tick < 800; tick++) {
      const bend = LEAD.path[state.i];
      const player = tick % 173 === 0 ? { x: 300, z: 300 } : { x: bend?.[0] ?? 0, z: bend?.[1] ?? 0 };
      const on = tick % 197 !== 196, dt = tick % 7 === 0 ? 0.4 : 1 / 60;
      const event = original.step(dt, on, player);
      const result = guest.project('lead', { ...state, begin: 0, dt, on: Number(on), playerX: player.x, playerZ: player.z, atX: bend?.[0] ?? 0, atZ: bend?.[1] ?? 0 });
      Object.assign(state, result);
      expect({ i: state.i, mode: modes[state.mode], t: state.elapsed }).toEqual(original.save());
      expect(result['event']).toBe(event === null ? 0 : event.kind === 'appear' ? event.first ? 1 : 2 : event.kind === 'fade' ? 3 : event.done ? 5 : 4);
    }
  }
});
