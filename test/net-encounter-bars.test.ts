// oxlint-disable-next-line import/no-nodejs-modules -- Rapier is a shipped binary.
import { readFileSync } from 'node:fs';
import { PerspectiveCamera, Vector3 } from 'three';
import { beforeAll, expect, test } from 'vitest';
import type { BossPresentation } from '../src/engine/shared/ai/BossBrain';
import type { NetCommand } from '@wildshard/format/netCommand';
import { NetClient } from '../src/engine/client/net/client';
import { PhaseEncounter, silentBossPresentation, type PhaseEncounterSpec } from '../src/engine/server/ai/phases';
import { NetRoom, type NetTickInput } from '../src/engine/server/net/room';
import { SimNetWorld } from '../src/engine/server/net/simWorld';
import { createSimHost } from '../src/engine/server/sim';
import { loadRapier, type Rapier } from '../src/engine/shared/physics/rapier';
import { directLoopback } from '../src/engine/test/netLoopback';
import { BossRowBar, EliteRowBar, netEncounterFeed, type BossBarCard, type EncounterRow } from '../src/game/client/boss/barFeed';
import { SIM_CREATURE_RECIPE } from '../src/game/test/creatureRecipe';
import { SIM_LEVEL } from './fixtures/sim-level/level';

// E6 COMBAT: a bar reads one feed. A fight drawn off a server's rows shows what the brain itself shows a page, in that order.
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

const BODY = SIM_CREATURE_RECIPE.id;
const LEVEL = { ...SIM_LEVEL, entities: [{ ...SIM_CREATURE_RECIPE, at: { x: 12, y: 0, z: 12 } }] };
const phase = (at: number, caption: string): PhaseEncounterSpec['phases'][number] => ({ at, name: caption, caption, speed: 0, stopDistance: 1.2, turnRate: 6 });
const SPEC: PhaseEncounterSpec = { id: 'room.boss', entity: BODY, kind: 'boss', panel: null, name: 'Boar', title: 'of the room', retry: 'Again',
  arena: { at: [12, 0, 12], radius: 6 }, intro: 0.1, introShort: 0.1, respawn: { at: [-4, 0, -4], yaw: 1 }, phases: [phase(1, 'one'), phase(0.5, 'two')] };
const CARD: BossBarCard = { id: SPEC.id, name: SPEC.name, title: SPEC.title, retryTitle: SPEC.retry, phases: SPEC.phases };

/** The bar moments a presentation is told, a repeated value once. */
function tape(): { readonly bar: BossPresentation; readonly heard: string[] } {
  const heard: string[] = [], silent = silentBossPresentation();
  const hear = (line: string): void => { if (heard.at(-1) !== line) heard.push(line); };
  const bar: BossPresentation = { ...silent, get barShown() { return silent.barShown; }, update: () => undefined, setSkip: () => undefined, hideReward: () => undefined,
    hideBar: () => { if (silent.barShown) hear('hideBar'); silent.hideBar(); }, hideNameCard: () => { hear('hideNameCard'); }, showBar: (name, cuts) => { silent.showBar(name, cuts); hear(`showBar ${name} ${cuts.join(',')}`); },
    showNameCard: (name, title, short) => { hear(`card ${name} ${title} ${String(short)}`); }, showRetry: (title, attempts) => { hear(`retry ${title} ${String(attempts)}`); },
    setHp: hp => { hear(`hp ${hp.toFixed(2)}`); }, setShield: on => { hear(`shield ${String(on)}`); }, setPhase: (index, caption) => { hear(`phase ${String(index)} ${caption}`); } };
  return { bar, heard };
}

test('a fight off the server\'s rows shows what the brain shows a page, in order', () => {
  const page = tape(), wire = tape();
  const host = createSimHost(LEVEL, { rapier }), [lead] = host.players.values(); if (lead === undefined) throw new Error('No lead');
  const bot = host.addPlayer('bot:1', { x: 15, y: 0, z: 12 });
  const fight = new PhaseEncounter(host, SPEC, { saved: { defeated: false, rewardTaken: false, kills: 0 }, persist: () => undefined, reward: () => undefined, presentation: page.bar });
  const world = new SimNetWorld(host), net = new NetRoom({ world, step: (inputs: readonly NetTickInput[]) => {
    const commands = new Map<string, NetCommand>();
    for (const row of inputs) if (row.command !== null) commands.set(row.player, row.command);
    host.step(commands);
  } });
  const link = directLoopback(), client = new NetClient(link.client), feed = netEncounterFeed(client), view = new BossRowBar(wire.bar, CARD);
  net.join(link.server, world.playerOf(lead.id)); client.hello(); link.pump(); net.open(); link.pump();
  const run = (ticks: number): void => { for (let at = 0; at < ticks; at++) { client.flush(); link.pump(); net.tick(); link.pump(); client.present(); view.draw(feed.rows(), 1 / 60); } };
  try {
    const body = host.entities.get(BODY); if (body === undefined) throw new Error('No body');
    run(20); expect(fight.boss.state).toBe('fight');
    body.hp = body.maxHp * 0.4; run(120); expect(fight.boss.phase).toBe(1);
    fight.boss.onPlayerDeath(); run(5); expect(fight.boss.state).toBe('armed'); bot.position.set(15, 0, 12); run(40); expect(fight.boss.state).toBe('fight');
    body.alive = false; run(120); expect(fight.boss.state).toBe('victory');
    const moments = (lines: readonly string[]): string[] => lines.filter(line => !line.startsWith('hp') && !line.startsWith('shield'));
    expect(moments(wire.heard)).toEqual(moments(page.heard));
    const lastHp = (lines: readonly string[]): string | undefined => [...lines].reverse().find(line => line.startsWith('hp'));
    expect(lastHp(wire.heard)).toBe(lastHp(page.heard));
    expect(page.heard).toContain('phase 1 two'); expect(page.heard).toContain('retry Again 2'); expect(page.heard.at(-1)).toBe('hideBar');
  } finally { net.dispose(); host.dispose(); }
});

const row = (id: string, state: string, body: number, hp = 1, phaseAt = 0): EncounterRow => ({ id, kind: 'elite', state, hp, phase: phaseAt, shield: false, body });
test('the elite bar follows the nearest lair off its rows, and fades after a fall', () => {
  const shown: string[] = [], heads = new Map([[1, 10], [2, 4]]);
  const bar = { show: (name: string) => { shown.push(`show ${name}`); }, hide: () => { shown.push('hide'); }, caption: (text: string) => { shown.push(`caption ${text}`); }, update: () => undefined,
    set: (hp: number, mode: 'head' | 'pinned', head: Vector3 | null) => { shown.push(`set ${hp.toFixed(1)} ${mode} ${head === null ? 'none' : head.x.toFixed(0)}`); } };
  const view = new EliteRowBar(bar, [{ id: 'far', name: 'Far', epithet: 'of far', phase2: 'ENRAGED' }, { id: 'near', name: 'Near', epithet: 'of near', phase2: 'ENRAGED' }], { player: { position: new Vector3() }, camera: new PerspectiveCamera(),
    head: (body, to) => { const x = heads.get(body); if (x === undefined) return false; to.set(x, 0, 0); return true; } });
  view.draw([row('far', 'aware', 1)], 0.1);
  view.draw([row('far', 'aware', 1), row('near', 'engaged', 2, 0.8)], 0.1);
  view.draw([row('far', 'aware', 1), row('near', 'engaged', 2, 0.4, 1)], 0.1);
  view.draw([row('far', 'idle', 1), row('near', 'dead', 0, 0)], 0.1);
  view.draw([row('far', 'idle', 1), row('near', 'dead', 0, 0)], 2);
  expect(shown).toEqual(['show Far', 'set 1.0 head 10', 'show Near', 'set 0.8 pinned 4', 'caption ENRAGED', 'set 0.4 pinned 4', 'set 0.0 pinned none', 'hide']);
});
