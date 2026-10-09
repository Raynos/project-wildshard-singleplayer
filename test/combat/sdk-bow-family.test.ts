import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { withOwner } from '../../src/engine/app/ownership';
import { BowDraw } from '../../src/engine/combat/bowDraw';
import { Bow } from '../../src/engine/combat/view/Bow';
import { fnv1a32 } from '../../src/engine/core/rng';
import { Bow as GameBow } from '../../src/game/weapons/Bow';
import { Bow as StarterBow } from '../../src/sdk/runtime/weapons/starterBow';
import { Bow as TrustedBow } from '../../src/sdk/runtime/weapons/Bow';
import { BOW } from '../../src/shards/nalati-grasslands/weapons/equipment';
import { NALATI_BOW } from '../../src/shards/nalati-grasslands/weapons/loadout';
import { fakeWorld } from '../fake/world';
import { weaponTraceJson, weaponTraceSnapshot } from '../fake/weaponTrace';

beforeEach(() => { vi.stubGlobal('document', new EventTarget()); vi.stubGlobal('window', new EventTarget()); });
afterEach(() => { Reflect.deleteProperty(globalThis, 'document'); Reflect.deleteProperty(globalThis, 'window'); });

function drawTrace(Base: typeof BowDraw) {
  const draw = new Base(), events: [number, string][] = [];
  let hash = 0;
  for (let tick = 0; tick < 10_000; tick++) {
    const phase = tick % 900, held = phase < 650 || (phase > 720 && phase < 750);
    const event = draw.step(1 / 60, held, tick % 1800 >= 1700, tick % 3600 < 1800 ? 1 : 1.2);
    if (tick % 2100 === 2000) draw.reset();
    if (event !== null) events.push([tick, event]);
    hash = fnv1a32(`${hash}:${weaponTraceJson([draw.drawT, draw.holdT, draw.renockT, draw.tiredT, draw.p, draw.full, draw.sway, draw.drawing, event])}`);
  }
  return { ticks: 10_000, hash, events };
}
function bowTrace(platform: boolean | 'starter', portrait: boolean) {
  const scope = new Scope('bow-parity'), f = fakeWorld(), rng = app.rng.snapshot();
  Reflect.set(f.player, 'swimming', false); Reflect.set(f.player, 'dashCd', 0);
  f.game.camera.aspect = portrait ? 402 / 874 : 16 / 9;
  const world = { game: f.game.asGame(), player: f.player, sky: f.sky, forest: f.forest };
  const bow = withOwner(scope, () => platform === true
    ? new Bow(world, undefined, { row: BOW, profile: NALATI_BOW, inputContext: 'weapon.bow', initialStyle: 'recurve' })
    : platform === 'starter' ? new StarterBow(world, undefined, { row: BOW, profile: NALATI_BOW })
    : new GameBow(world, undefined, { row: BOW, profile: NALATI_BOW }));
  const edges: string[] = [], launches: number[][] = [];
  bow.install({ scope }); bow.wind = null;
  bow.onDrawStart = () => { edges.push('draw'); }; bow.onFullDraw = () => { edges.push('full'); };
  bow.onLetDown = () => { edges.push('letdown'); }; bow.onLoose = () => { edges.push('loose'); };
  const launch = vi.spyOn(bow.arrows, 'launch').mockImplementation((position, velocity) => { launches.push([...position, ...velocity]); });
  const frames: unknown[] = [];
  try {
    for (let tick = 0; tick < 600; tick++) {
      bow.altHeld = tick % 180 < 70; bow.adsHeld = tick >= 180 && tick < 400;
      f.player.yaw = 0.002 * tick; f.player.pitch = Math.sin(tick / 40) * 0.1;
      if (tick === 240) bow.setMount({ speed: 8, yaw: 0.7 });
      if (tick === 450) bow.setMount(null);
      bow.update(1 / 60, tick / 60);
      bow.model.updateMatrixWorld(true);
      frames.push([bow.state.bolts, bow.charge, bow.fullDraw, bow.aimed, f.game.camera.fov,
        bow.model.matrix.toArray(), ...bow.model.children.map((child) => [...child.position, ...child.quaternion, child.visible])]);
    }
    return { hash: fnv1a32(weaponTraceJson(frames)), frames: frames.length, edges, launches, ammo: bow.state.bolts, context: bow.row.ui.inputContext, style: bow.style };
  } finally { launch.mockRestore(); scope.dispose(); app.rng.restore(rng); }
}

describe('trusted SDK bow graduation', () => {
  it('publishes the one engine constructor', () => {
    expect(TrustedBow).toBe(Bow); expect(GameBow.prototype).toBeInstanceOf(Bow);
  });
  it('matches every draw value and event across ten thousand independent legacy/platform ticks', () => {
    // Independent kit trace captured in 008420564 before delegation; snapshot encoding alone is quantized for cross-platform math.
    expect(drawTrace(BowDraw)).toMatchSnapshot();
  });
  it.each([false, true])('preserves live view transforms, input defaults, mounted draw and launch edges (portrait=%s)', (portrait) => {
    const original = bowTrace(false, portrait);
    expect(bowTrace(true, portrait)).toEqual(original);
    expect(bowTrace('starter', portrait)).toEqual(original);
    expect(weaponTraceSnapshot(original)).toMatchSnapshot();
  });
});
