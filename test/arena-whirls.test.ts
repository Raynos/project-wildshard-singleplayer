// CI12 Storm Titan: the whirlwinds' laws and gate, split out of ArenaWhirlsView (ArenaWhirls, renderer-free), step exactly
// as the view's inline update did: every ease, shown flag, position and hit equal over a fight's arming, live flips and
// decision ticks; the view over them shows the same funnels and returns the same hits.
import { expect, test } from 'vitest';
import { BoxGeometry, InstancedMesh, MeshBasicMaterial, Object3D } from 'three';
import { Scope } from '../src/engine/app/scope';
import { terrainHeight as heightAt } from '../src/engine/world/terrainHeight';
import { parse } from 'valibot';
import { ArenaWhirlsSchema, type ArenaWhirlsRows } from '../src/format/encounterRows';
import { TITAN_WHIRLS } from '../src/shards/nalati-grasslands/generators/stormTitanFight';
import { titanPrograms } from './fixtures/titanInlineWitness';
import { lendNalatiPasture, lendNalatiTitan } from './fixtures/nalati-return-modules';
import { ProjectedState, ReturnProgram } from '../src/game/population/returnProgram';
import { ArenaWhirls } from '../src/game/boss/arenaWhirls';
import { ArenaWhirlsView } from '../src/game/boss/arenaFire';

const rows: ArenaWhirlsRows = parse(ArenaWhirlsSchema, TITAN_WHIRLS);

/** ArenaWhirlsView's laws, gate and update before the split (arenaFire.ts, before CI12), without its funnels */
class Inline {
  private readonly whirls: { readonly law: ProjectedState; visible: boolean }[];
  private readonly gate: ProjectedState;
  readonly drawn = rows.laws.map(() => ({ k: 0, shown: 0, x: 0, y: 0, z: 0 }));
  constructor(program: ReturnProgram, gateProgram: ReturnProgram) {
    const gate = rows.gate;
    this.gate = new ProjectedState({ ...gate.law, signals: { step: gate.law.signal, arm: gate.arm }, signal: 'step', outputs: Object.keys(gate.law.retain) }, gateProgram);
    this.whirls = rows.laws.map(row => ({ law: new ProjectedState(row, program), visible: false }));
  }
  arm(mask: number): void { this.gate.event('arm', { [rows.gate.inputs.mask]: mask | 0 }); }
  update(dt: number, t: number, live: boolean, thinkDt: number, frame: { wx: number; wz: number; px: number; pz: number }): { x: number; y: number; z: number }[] {
    const shared = this.whirls[0]?.law, hits: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < this.whirls.length; i++) {
      const w = this.whirls[i], drawn = this.drawn[i], slot = rows.gate.slots[i]; if (w === undefined || drawn === undefined || slot === undefined) continue;
      const inputs = rows.gate.inputs; this.gate.project({ [inputs.delta]: dt, [inputs.live]: Number(live), [inputs.ease]: rows.ease, [inputs.index]: i });
      w.visible = this.gate.value(slot.shown) === 1; drawn.k = this.gate.value(slot.weight); drawn.shown = Number(w.visible);
      if (!w.visible) continue;
      let hurt = false;
      if (thinkDt > 0) {
        const result = w.law.project({ dt: thinkDt, t, index: i, wx: frame.wx, wz: frame.wz, cd: shared?.value('cd') ?? 0, hit: Number(i === 0), px: frame.px, pz: frame.pz, open: Number(live) });
        if (result['broke'] === 1) shared?.set({ cd: result['cd'] ?? 0 });
        hurt = result['hurt'] === 1;
      }
      const x = w.law.value('x'), z = w.law.value('z'), y = heightAt(x, z);
      drawn.x = x; drawn.y = y; drawn.z = z;
      if (hurt) hits.push({ x, y, z });
    }
    return hits;
  }
}

test('the whirl laws step as the inline view did, and the view over them shows the same funnels', () => {
  const scope = new Scope('arena-whirls-test'); lendNalatiPasture(scope); lendNalatiTitan(scope);
  const page = (program: typeof titanPrograms.wind): ReturnProgram => ReturnProgram.page(program, scope);
  const old = new Inline(page(titanPrograms.wind), page(titanPrograms.attack));
  const kernel = new ArenaWhirls(rows, page(titanPrograms.wind), page(titanPrograms.attack), scope);
  const funnels = rows.laws.map(() => new Object3D()), debris = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), rows.laws.length * rows.debris.count);
  const view = new ArenaWhirlsView(rows, page(titanPrograms.wind), funnels, debris, page(titanPrograms.attack), scope);
  let shownFrames = 0, hitFrames = 0, t = 0;
  try {
    for (let f = 0; f < 600; f++) {
      if (f % 120 === 0) { const mask = [0b111, 0b001, 0b110, 0b101, 0][f / 120] ?? 0; old.arm(mask); kernel.arm(mask); view.arm(mask); }
      const dt = f % 37 === 0 ? 0.1 : 1 / 30; t += dt;
      const live = f % 200 < 170, thinkDt = f % 3 === 0 ? 0.1 : 0;
      // the wind turns; half the time the player stands where the first whirlwind last stood (else off in the arena)
      const at = old.drawn[0], near = f % 20 < 10 && at !== undefined && at.shown === 1;
      const frame = { wx: Math.cos(t * 0.3), wz: Math.sin(t * 0.3), px: near ? at.x + 0.5 : Math.cos(t * 0.7) * 18, pz: near ? at.z : Math.sin(t * 0.7) * 18 };
      const want = old.update(dt, t, live, thinkDt, frame), got = kernel.update(dt, t, live, thinkDt, frame), shown = view.update(dt, t, live, thinkDt, frame);
      expect(kernel.drawn).toEqual(old.drawn); expect(view.drawn).toEqual(old.drawn);
      expect(got.map(h => [h.x, h.y, h.z])).toEqual(want.map(h => [h.x, h.y, h.z]));
      expect(shown.map(h => [h.x, h.y, h.z])).toEqual(want.map(h => [h.x, h.y, h.z]));
      expect(funnels.map(funnel => Number(funnel.visible))).toEqual(old.drawn.map(row => row.shown));
      if (old.drawn.some(row => row.shown === 1)) shownFrames++;
      if (want.length > 0) hitFrames++;
    }
    // the run exercised what it compares: whirls shown and moving, and the player touched
    expect(shownFrames).toBeGreaterThan(200); expect(hitFrames).toBeGreaterThan(0);
    view.reset(); kernel.reset();
    expect(funnels.every(funnel => !funnel.visible)).toBe(true); expect(debris.count).toBe(0); expect(kernel.drawn.every(row => row.shown === 0)).toBe(true);
  } finally { scope.dispose(); }
});
