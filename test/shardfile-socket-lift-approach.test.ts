import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { parseSocketLift, socketLiftRules, type SocketLiftEntry } from '../src/game/shardfile/socketLift';
import { PropsSchema } from '../src/game/shardfile/props';
import type { LiftApproachSource } from '../src/game/shardfile/socketLiftApproach';
import type { MoverData } from '../src/game/shardfile/movers';

const rot = { x: 0, y: 0, z: 0, w: 1 };
function fixture(narrow = false) {
  const roadStop: [number, number, number] = narrow ? [2.4, 0, -231.6] : [0, 0, 228.05];
  const topStop: [number, number, number] = [roadStop[0], narrow ? 125 : 25, narrow ? -231.6 : 205];
  const edge = narrow ? 'south' : 'north';
  const entry: SocketLiftEntry = { edge, lift: parseSocketLift({ mover: 'entry.lift', gate: 'entry.gate', roadStop, topStop,
    route: [topStop, [topStop[0], topStop[1], narrow ? -215 : 195]], rideTicks: 1000,
    approach: { colliders: ['entry.landing'], route: narrow ? [[0, 0, -235], [2.4, 0, -235], [2.4, 0, -233.55]] : [[0, 0, 235], [0, 0, 233.85]] },
  }) };
  const data: MoverData = [{ id: 'entry.lift', entity: 1001, module: 'a'.repeat(64), kind: 'platform', at: { x: roadStop[0], y: 0, z: roadStop[2] },
    euler: { x: 0, y: 0, z: 0 }, enabled: true,
    boxes: [{ x: 0, y: -0.25, z: 0, hx: narrow ? 1.55 : 5.41, hy: 0.25, hz: narrow ? 1.55 : 5.41, rot }], input: [],
  }, { id: 'entry.gate', entity: 1002, module: 'a'.repeat(64), kind: 'static', at: { x: 0, y: 1, z: narrow ? -235 : 235 },
    euler: { x: 0, y: 0, z: 0 }, enabled: false,
    boxes: [{ x: 0, y: 0, z: 0, hx: 4, hy: 1, hz: 0.1, rot }], input: [],
  }];
  const props = v.parse(PropsSchema, { version: 1, family: 'pbr', tiles: [], panels: [], models: [], far: null, textures: [], colliders: [
    { id: 'entry.landing', panel: null, initialActive: true, shapes: [{ kind: 'box', x: 0, y: -0.25, z: narrow ? -234.35 : 234.25, hx: 4.5, hy: 0.25, hz: narrow ? 1.15 : 0.75 }] },
  ] });
  const source: LiftApproachSource = { props, targets: { panels: [] } };
  const errors = () => socketLiftRules([entry], data, source);
  return { entry, data, source, props, errors };
}
describe('static socket lift approach geometry', () => {
  it.each([false, true])('admits a full-width static mouth followed by a narrower deck (offset cage=%s)', narrow => {
    const r = fixture(narrow); expect(r.errors()).toEqual([]);
    const lift = { ...r.entry.lift }; delete lift.approach;
    const direct = { ...r.entry, lift: parseSocketLift(lift) };
    expect(socketLiftRules([direct], r.data)).not.toEqual([]);
  });
  it('requires collider declarations instead of crediting implicit/platform ground', () => {
    const r = fixture(); expect(socketLiftRules([r.entry], r.data)).toContain('Missing static approach collider declarations');
    r.source.props = null; expect(r.errors()).toContain('Static approach requires permanent active declared colliders');
  });
  it.each(['unknown', 'inactive', 'panel', 'activation'] as const)('refuses nonpermanent %s collision', kind => {
    const r = fixture(), row = r.props.colliders[0]; if (row === undefined || r.entry.lift.approach === undefined) throw new Error('Missing fixture');
    if (kind === 'unknown') r.entry.lift.approach.colliders = ['unknown'];
    if (kind === 'inactive') row.initialActive = false;
    if (kind === 'panel') row.panel = 'entry.panel';
    if (kind === 'activation') r.source.targets.panels = [{ colliders: [row.id] }];
    expect(r.errors()).toContain('Static approach requires permanent active declared colliders');
  });
  it('requires the full eight metre mouth even when a narrower capsule route fits', () => {
    const r = fixture(), box = r.props.colliders[0]?.shapes[0]; if (box?.kind !== 'box') throw new Error('Missing fixture');
    box.hx = 3; expect(r.errors()).toContain('Static approach must cover the eight metre road-height mouth');
  });
  it('checks the continuous corridor, including a small off-centre trench', () => {
    const r = fixture(true), row = r.props.colliders[0]; if (row === undefined) throw new Error('Missing fixture');
    row.shapes = [
      { kind: 'box', x: 0, y: -0.25, z: -234.65, hx: 4.5, hy: 0.25, hz: 0.85 },
      { kind: 'box', x: 0, y: -0.25, z: -233.499, hx: 4.5, hy: 0.25, hz: 0.299 },
    ];
    expect(r.errors()).toContain('Static approach corridor lacks declared road-height ground');
  });
  it('refuses raised ground and a boarding seam above five centimetres', () => {
    const r = fixture(), box = r.props.colliders[0]?.shapes[0]; if (box?.kind !== 'box') throw new Error('Missing fixture');
    box.y += 0.01; expect(r.errors()).not.toEqual([]); box.y -= 0.01;
    const deck = r.data[0]?.boxes[0]; if (deck === undefined) throw new Error('Missing fixture');
    deck.hz = 5.4; expect(r.errors()).toEqual([]);
    deck.hz = 5.399; expect(r.errors()).toContain('Static approach boarding seam exceeds five centimetres');
  });
  it('requires a real capsule footprint on the moving deck', () => {
    const r = fixture(true), deck = r.data[0]?.boxes[0]; if (deck === undefined) throw new Error('Missing fixture');
    deck.hx = 0.3; expect(r.errors()).toContain('Socket lift deck must support the real capsule at its road stop');
  });
  it('refuses a moving gate and a misplaced or overlong approach', () => {
    const r = fixture(), gate = r.data[1]; if (gate === undefined || r.entry.lift.approach === undefined) throw new Error('Missing fixture');
    gate.kind = 'platform'; expect(r.errors()).toContain('Static approach requires a stationary road gate'); gate.kind = 'static';
    r.entry.lift.approach.route[0] = [0, 0, 234]; expect(r.errors()).toContain('Static approach must start at the socket inner midpoint');
    r.entry.lift.approach.route = [[0, 0, 235], [20, 0, 235], [0, 0, 233.85]];
    expect(r.errors()).toContain('Static approach route exceeds thirty-two metres');
  });
  it.each([
    { colliders: ['entry.landing', 'entry.landing'], route: [[0, 0, 235], [0, 0, 234]] },
    { colliders: [], route: [[0, 0, 235], [0, 0, 234]] },
    { colliders: ['entry.landing'], route: [[0, 0, 235], [0, 0.1, 234]] },
    { colliders: ['entry.landing'], route: [[0, 0, 235], [241, 0, 234]] },
    { colliders: ['entry.landing'], route: [[0, 0, 235]] },
  ])('refuses malformed bounded approach %j', approach => {
    expect(() => parseSocketLift({ ...fixture().entry.lift, approach })).toThrow();
  });
});
