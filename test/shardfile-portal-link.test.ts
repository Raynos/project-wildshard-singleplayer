import { expect, it } from 'vitest';
import * as v from 'valibot';
import { parsePortalLink, portalLinkEntries, portalLinkRules } from '../src/game/shardfile/portalLink';
import { PropsSchema } from '../src/game/shardfile/props';

const declaration = () => ({ road: { id: 'portal.north', at: [0, 0, 242], floor: 'deck.north' },
  destination: { id: 'portal.square.arrival', at: [0, 20, 0], floor: 'square' },
  exit: { id: 'portal.square.north', at: [4, 20, 0], floor: 'square' },
  links: [{ from: 'portal.north', to: 'portal.square.arrival' }, { from: 'portal.square.north', to: 'portal.north' }],
  route: [[0, 20, 0], [4, 20, 0]] });
const source = () => ({ meshCollision: null, props: v.parse(PropsSchema, { version: 1, family: 'pbr', tiles: [], panels: [], models: [], far: null, textures: [],
  colliders: ['deck.north', 'square'].map(id => ({ id, panel: null, initialActive: true, shapes: [{ kind: 'box', x: 0, y: -0.5, z: 0, hx: 4, hy: 0.5, hz: 8 }] })) }) });
it('admits exactly two bound links with a bounded walked destination-to-exit route', () => {
  const portal = parsePortalLink(declaration());
  expect(portal.road.yaw).toBe(0);
  expect(portalLinkRules([{ edge: 'north', portal }], source())).toEqual([]);
  expect(portalLinkEntries([{ edge: 'north', kind: 'portalLink', portal }])).toEqual([{ edge: 'north', portal }]);
  expect(() => portalLinkEntries([{ edge: 'north', kind: 'portalLink' }])).toThrow('Missing portal');
});
it('refuses unknown, unbound, extra and duplicate links or routes not ending at the exit', () => {
  const data = declaration();
  for (const links of [[], [...data.links, data.links[0]], [{ from: 'unknown', to: 'portal.square.arrival' }, data.links[1]], [data.links[0], data.links[0]]]) {
    expect(() => parsePortalLink({ ...data, links })).toThrow();
  }
  expect(() => parsePortalLink({ ...data, route: [[0, 20, 0], [5, 20, 0]] })).toThrow('destination to exit');
  expect(() => parsePortalLink({ ...data, road: { ...data.road, at: [0, 1, 242] } })).toThrow('y=0');
  expect(() => parsePortalLink({ ...data, destination: { ...data.destination, at: [0, 251, 0] } })).toThrow();
});
it('refuses arbitrary, inactive or panel floor bindings and duplicate outgoing nodes', () => {
  const portal = parsePortalLink(declaration()), s = source();
  expect(portalLinkRules([{ edge: 'north', portal: { ...portal, road: { ...portal.road, floor: 'platform.grid' } } }], s)).toContain('Portal floor must bind an active permanent static collider');
  expect(portalLinkRules([{ edge: 'north', portal }], { ...s, targets: { panels: [{ colliders: ['square'] }] } })).toContain('Portal floor must bind an active permanent static collider');
  expect(portalLinkRules([{ edge: 'north', portal }], { ...s, movers: [{ id: 'square' }] })).toContain('Portal floor must bind an active permanent static collider');
  const row = s.props.colliders[0]; if (row === undefined) throw new Error('Missing floor'); row.initialActive = false;
  expect(portalLinkRules([{ edge: 'north', portal }], s)).toContain('Portal floor must bind an active permanent static collider');
  expect(portalLinkRules([{ edge: 'north', portal }, { edge: 'north', portal }], source())).toContain('Portal has more than one outgoing link');
  expect(portalLinkRules([{ edge: 'north', portal: { ...portal, road: { ...portal.road, at: [1, 0, 242] } } }], source())).toContain('Road portal must be centred on its road-level entry deck');
});
it('refuses a callback/accessor before invocation', () => {
  let called = false;
  expect(() => parsePortalLink({ ...declaration(), get callback() { called = true; return () => { throw new Error('Never execute author callback'); }; } })).toThrow('JSON data only');
  expect(called).toBe(false);
});
