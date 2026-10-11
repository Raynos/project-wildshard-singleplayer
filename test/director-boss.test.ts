import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Rng } from '../src/engine/core/rng';
import type { BossContinuation, BossDefinition, BossPorts, BossPresentation, BossScript } from '../src/engine/ai/BossBrain';
import { DirectorBossBrain } from '../src/game/plugin/director';
import { BossBrain as ShippingBoss } from './fixtures/director-boss/BossBrain';
import { ROC_DEFINITION } from '../src/shards/far-reach/data/rocFight';
import { MATRIARCH_DEFINITION } from '../src/shards/sunscar-dunes/data/matriarchEncounter';
import skyRows from '../src/shards/far-reach/data/bossStages.json';
import signalRows from '../src/shards/sunscar-dunes/data/bossStages.json';

function fixture(def: BossDefinition, rows: unknown, authored: boolean) {
  const calls: unknown[][] = [], point = new Vector3(1, 2, 3);
  const state = { hp: 1, dead: false, shield: false, inside: true, skip: false, bar: false };
  const saved = { defeated: false, rewardTaken: false, kills: 0 };
  const script: BossScript = {
    inArena: () => { calls.push(['arena']); return state.inside; },
    reset: phase => { calls.push(['reset', phase]); state.hp = def.phases[phase]?.at ?? 1; state.dead = false; },
    seal: on => { calls.push(['seal', on]); },
    intro: (t, short) => { calls.push(['intro', t, short]); return point; },
    begin: phase => { calls.push(['begin', phase]); },
    enterPhase: phase => { calls.push(['phase', phase]); },
    update: (dt, t, fighting) => { calls.push(['update', dt, t, fighting]); },
    get hpFrac() { calls.push(['hp']); return state.hp; },
    get shielded() { calls.push(['shield']); return state.shield; },
    get dead() { calls.push(['dead']); return state.dead; },
    clampHp: hp => { calls.push(['clamp', hp]); state.hp = hp; },
    setInvulnerable: on => { calls.push(['invulnerable', on]); state.shield = on; },
    victory: () => { calls.push(['victory']); }, rewardPoint: () => point,
    respawnPoint: () => { calls.push(['respawn-point']); return { pos: point, yaw: 2 }; },
  };
  const ports: BossPorts = {
    player: { position: point }, lockInput: on => { calls.push(['lock', on]); },
    respawn: (pos, yaw) => { calls.push(['respawn', pos.toArray(), yaw]); },
    skipHeld: () => { calls.push(['skip']); return state.skip; },
    faceToward: (_at, dt) => { calls.push(['face', dt]); },
    spawnReward: () => { calls.push(['reward']); saved.rewardTaken = true; },
    persist: value => { calls.push(['persist', { ...value }]); },
    feed: text => { calls.push(['feed', text]); }, toast: text => { calls.push(['toast', text]); },
    music: (event, intensity) => { calls.push(['music', event, intensity]); },
  };
  const ui: BossPresentation = {
    update: dt => { calls.push(['ui.update', dt]); }, get barShown() { calls.push(['barShown']); return state.bar; },
    hideBar: () => { calls.push(['hideBar']); state.bar = false; },
    hideNameCard: () => { calls.push(['hideName']); }, hideReward: () => { calls.push(['hideReward']); },
    showRetry: (title, attempts) => { calls.push(['retry', title, attempts]); },
    showNameCard: (name, title, short) => { calls.push(['name', name, title, short]); },
    setSkip: fraction => { calls.push(['skip-ui', fraction]); },
    showBar: (name, thresholds) => { calls.push(['bar', name, thresholds]); state.bar = true; },
    setHp: hp => { calls.push(['hp-ui', hp]); }, setShield: on => { calls.push(['shield-ui', on]); },
    setPhase: (phase, caption) => { calls.push(['phase-ui', phase, caption]); },
  };
  const boss = authored ? new DirectorBossBrain(def, script, ports, ui, saved, rows) : new ShippingBoss(def, script, ports, ui, saved);
  return { boss, state, calls };
}
function native(saved: BossContinuation) { const { director: _director, ...rest } = saved; return rest; }

it('preserves both shipping encounters, exact getter/callback order, skip, beats, death retry and reward at mixed frame rates', () => {
  for (const [def, rows] of [[ROC_DEFINITION, skyRows], [MATRIARCH_DEFINITION, signalRows]] as const) {
    for (const seed of [1, 2719, 19001]) {
      const a = fixture(def, rows, true), b = fixture(def, rows, false), rng = new Rng(seed);
      a.boss.arm(); b.boss.arm();
      for (let tick = 0; tick < 10_000; tick++) {
        const dt = [1 / 60, 1 / 30, 1 / 20, 0, 0.3, 1 / 120][tick % 6] ?? 1 / 60;
        const hp = rng.next(), dead = tick % 173 === 0, inside = tick % 31 > 4, skip = tick % 119 > 90;
        Object.assign(a.state, { hp, dead, inside, skip }); Object.assign(b.state, { hp, dead, inside, skip });
        if (tick % 503 === 0) { a.boss.disarm(); b.boss.disarm(); a.boss.arm(); b.boss.arm(); }
        if (tick % 137 === 0) expect(a.boss.onPlayerDeath()).toBe(b.boss.onPlayerDeath());
        if (tick % 997 === 0) { a.boss.devStartAt(2); b.boss.devStartAt(2); }
        a.boss.update(dt, tick / 60); b.boss.update(dt, tick / 60);
        expect(a.calls).toEqual(b.calls); expect(a.state).toEqual(b.state);
        expect(native(a.boss.snapshot())).toEqual(b.boss.snapshot());
        a.calls.length = 0; b.calls.length = 0;
      }
    }
  }
});

it('restores both owners quietly, refuses pre-row and foreign cursors atomically, and keeps an exact native suffix', () => {
  const a = fixture(ROC_DEFINITION, skyRows, true), b = fixture(ROC_DEFINITION, skyRows, true);
  a.boss.arm(); a.boss.update(0.1, 0); a.boss.update(0.2, 0.1);
  const snapshot = a.boss.snapshot(); b.calls.length = 0; b.boss.restore(snapshot);
  expect(b.calls).toEqual([]); Object.assign(b.state, a.state);
  a.calls.length = 0;
  for (let tick = 0; tick < 500; tick++) {
    a.boss.update(1 / 60, tick / 60); b.boss.update(1 / 60, tick / 60);
    expect(a.calls).toEqual(b.calls); expect(a.boss.snapshot()).toEqual(b.boss.snapshot());
    a.calls.length = 0; b.calls.length = 0;
  }
  const before = b.boss.snapshot();
  expect(() => b.boss.restore(native(snapshot))).toThrow(/director continuation/u);
  expect(() => b.boss.restore({ ...snapshot, director: '{}' })).toThrow();
  expect(() => b.boss.restore({ ...snapshot, attempts: 0 })).toThrow(/Invalid boss/u);
  expect(b.boss.snapshot()).toEqual(before); expect(b.calls).toEqual([]);
});

it('lets authored guards refuse a native arena transition instead of merely observing it', () => {
  const rows = structuredClone(skyRows);
  for (const stage of rows.stages) for (const next of stage.next) if (next.target === 'arena') next.when = 'false';
  const a = fixture(ROC_DEFINITION, rows, true); a.boss.arm(); a.calls.length = 0;
  a.boss.update(1 / 60, 0);
  expect(a.boss.state).toBe('armed'); expect(a.calls.some(call => call[0] === 'name')).toBe(false);
});
