import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { kokparView } from '../src/shards/nalati-grasslands/quest/kokpar';
import { Scope } from '../src/engine/app/scope';
import { SkyRig } from '../src/engine/world/skyRig';
import { practiceRoom } from '../src/engine/core/practiceRoom';
import rows from '../src/shards/nalati-grasslands/data/kokpar.generated.json' with { type: 'json' };
import { buildKokparRound, KOKPAR_GOALS, type KokparMount } from './fixtures/nalati-kokpar-oracle';


it('matches frozen round rules at 10 Hz while carrying poses stay per frame', () => {
  const scope = new Scope('kokpar projection replay'), practiceBefore = practiceRoom.open;
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing test sky');
  const events: string[] = [], expected: string[] = [], player = new THREE.Vector3(rows.home.x, 0, rows.home.z);
  const mount: KokparMount = { mounted: true, gait: 'gallop', horse: { position: player.clone(), yaw: 0 } };
  const floor = (x: number, z: number): number => x * 0.001 + z * 0.002;
  const original = buildKokparRound(sky, floor, { toast: text => { expected.push(text); }, sting: kind => { expected.push(kind); }, onWin: () => { expected.push('won'); } }, new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  const current = kokparView({ ctx: { scope }, sky, player: { position: player, yaw: 0 }, ride: { mount },
    hud: { toast: text => { events.push(text); } }, music: { sting: kind => { events.push(kind === 'chunk' ? 'win' : kind === 'death' ? 'lose' : kind); } },
    persistence: { flags: { set: () => { events.push('won'); } } } }, floor, rows, new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  const requests = vi.spyOn(ReturnProgram.prototype, 'project');
  let pending = 0;
  const project = (dt: number, riding: KokparMount | null, win = false): void => {
    if (win) current.win(); else current.update(dt, player, riding);
    if (win) original.win();
    else {
      pending += dt;
      if (pending >= 0.1) { const elapsed = pending; pending = 0; original.update(elapsed, player, riding); }
      else if (original.carrying && riding?.horse !== null && riding?.horse !== undefined) {
        const h = riding.horse;
        original.object.position.set(h.position.x + Math.cos(h.yaw) * 0.62, h.position.y + 1.02, h.position.z - Math.sin(h.yaw) * 0.62);
        original.object.rotation.set(0, h.yaw + Math.PI / 2, 0.35);
      }
    }
    expect(events).toEqual(expected);
    expect(current.carrying).toBe(original.carrying);
    expect(current.object.position.toArray()).toEqual(original.object.position.toArray());
    expect(current.object.rotation.toArray()).toEqual(original.object.rotation.toArray());
    events.length = 0; expected.length = 0;
  };
  try {
    expect(rows.goals).toEqual(KOKPAR_GOALS);
    practiceRoom.open = true; project(0.1, mount); practiceRoom.open = false;
    project(0.1, mount); project(30, mount); project(0.000001, mount); project(15, mount);
    project(0.1, mount); project(2.5, { ...mount, gait: 'trot' }); project(0.1, { ...mount, gait: 'trot' });
    project(0.1, mount); project(0.1, null); project(0.1, mount); project(0.1, { ...mount, horse: null });
    project(0.1, mount); player.x += 1000; project(0.1, mount); player.set(rows.home.x, 0, rows.home.z);
    for (const goal of rows.goals) {
      project(0.1, mount); mount.horse?.position.set(goal.x, 3, goal.z); project(0.1, mount);
      project(4, mount); mount.horse?.position.copy(player);
    }
    project(0, mount, true); project(4, mount);
    const before = requests.mock.calls.length;
    for (let i = 0; i < 60; i++) project(1 / 60, mount);
    expect(requests.mock.calls.length - before).toBeLessThanOrEqual(10);
    // Exact pickup radius and fractional frames, repeat through 10,000 decisions.
    let rng = 613;
    for (let i = 0; i < 10000; i++) {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      const n = rng / 4294967296;
      player.set(rows.home.x + (i % 37 === 0 ? 3.6 : n * 3), n, rows.home.z);
      const h = mount.horse; if (h !== null) { h.position.copy(player); h.yaw = n * Math.PI; }
      project([1 / 60, 1 / 30, 1 / 20, 0, 0.100001][i % 5] ?? 0, i % 29 === 0 ? null : { ...mount, gait: n < 0.5 ? 'trot' : 'canter' });
    }
  } finally { practiceRoom.open = practiceBefore; requests.mockRestore(); scope.dispose(); }
});
