/** Client-only board presentation. The native ContractBoard owns every offer;
 * this binding keeps the existing page panel, prompt, save and payout owners. */
import * as v from 'valibot';
import { Vector3 } from 'three';
import { isJsonData } from '@wildshard/format/json';
import { parseContractCatalogue } from '@wildshard/format/contracts';
import { parsePanelDefinition } from '@wildshard/format/panelTemplate';
import { jsonSchema, jsonSlot } from '@wildshard/engine/saves/slots';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { InteractSfx } from '@wildshard/engine/audio/interactSfx';
import type { ShardContext } from '../plugin/context';
import { bindRuntimeState } from '../plugin/headless';
import { QuestViews } from '../plugin/ui';
import { enteredHeldLoadout } from '../loadout/held';
import { HeldFinishes } from '../loadout/finishes';
import { DataPanel } from '../ui/dataPanels';
import { ContractBoard } from './contractBoard';
import { saveBoard, contractKill, isFilled, type Board } from './contracts';
import { commitQuestEffects } from './effects';
import type { bindStoryAchievements } from './story';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256)), finite = v.pipe(v.number(), v.finite());
const text = v.pipe(v.string(), v.maxLength(2048));
const schema = v.strictObject({ contracts: v.unknown(), panel: v.unknown(),
  store: v.strictObject({ slot: id, state: id }),
  at: v.strictObject({ x: finite, z: finite, yaw: finite }),
  label: text, filled: text, height: finite, radius: v.pipe(finite, v.minValue(Number.MIN_VALUE)),
  ammunition: v.exactOptional(v.strictObject({ loadout: id, kind: id })),
  finishes: v.record(id, text),
  notices: v.strictObject({ claimed: text, filled: text, progress: text }),
});
/** Existing page resources returned to the entry's original modal/debug phases. */
export interface ContractBoardPage {
  readonly state: Board;
  readonly panel: () => DataPanel;
  readonly fill: (slot: number) => void;
  /** Install deaths at the caller's existing phase, after its earlier death rows. */
  readonly observe: () => void;
}
function notice(template: string, values: Readonly<Record<string, string | number>>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(values)) rendered = rendered.replaceAll(`{${key}}`, String(value));
  return rendered;
}
/** Framework-only binding: author input enters through QuestEntry.board as JSON;
 * the entry lends its already-installed sound and achievement services. */
export function installContractBoardPage(ctx: ShardContext, quest: string, input: unknown,
  sfx: InteractSfx, feats: Awaited<ReturnType<typeof bindStoryAchievements>>): ContractBoardPage {
  if (ctx.scope.disposed || !isJsonData(input)) throw new Error('Quest board requires live JSON rows');
  const rows = v.parse(schema, input), contracts = parseContractCatalogue(rows.contracts), panelRows = parsePanelDefinition(rows.panel);
  for (const [key, allowed] of [['claimed', ['claimed', 'streak']], ['filled', ['goal']], ['progress', ['goal', 'have', 'need']]] as const)
    for (const token of rows.notices[key].matchAll(/\{([^{}]+)\}/gu)) if (!allowed.some(name => name === token[1])) throw new Error('Unknown board notice field');
  const runtime = ctx.game.runtime, world = runtime?.world, play = runtime?.play;
  if (runtime === undefined || world === undefined || world === null || play === undefined || play === null) throw new Error('Quest board requires entered play owners');
  const loadout = rows.ammunition === undefined ? null : enteredHeldLoadout(ctx.scope, rows.ammunition.loadout);
  if (loadout === null && contracts.rows.some(row => row.reward.bolts > 0)) throw new Error('Quest board requires its declared ammunition owner');
  const finishes = new Map(Object.entries(rows.finishes).map(([key, caption]) => [key, { finish: HeldFinishes.current(ctx.manifest.slug).get(key), text: caption }]));
  for (const key of [...contracts.rows.flatMap(row => row.reward.skin === undefined ? [] : [row.reward.skin]), ...contracts.milestones.map(row => row.skin)])
    if (!finishes.has(key)) throw new Error('Quest board lacks finish feedback');
  const legacy = jsonSlot(rows.store.slot, 'shard');
  const saved = bindRuntimeState(ctx, ctx.product.shardfile, rows.store.state, () => JSON.stringify(legacy.read(ctx.manifest.slug)), ctx.manifest.slug);
  const owner = new ContractBoard({ contracts, saved: String(saved.read()), radius: rows.radius,
    prompt: { x: rows.at.x, y: terrainHeight(rows.at.x, rows.at.z) + rows.height, z: rows.at.z } }), board = owner.current;
  const persist = (): void => { try { const raw = saveBoard(board); v.parse(jsonSchema, JSON.parse(raw) as unknown); saved.write(raw); } catch { /* storage unavailable */ } };
  const views = new QuestViews(ctx);
  const panel = views.view('board', scope => new DataPanel(panelRows, { scope, values: () => board, actions: new Map([
    ['claim', (value: unknown): void => {
      if (typeof value !== 'number') throw new Error('Contract action requires its slot');
      const reward = owner.claim(value)?.reward; if (reward === undefined) return;
      commitQuestEffects(ctx, quest, reward.items.map(item => ({ kind: 'item', item: item.id, count: item.n })));
      if (reward.bolts > 0 && rows.ammunition !== undefined) loadout?.addAmmo(rows.ammunition.kind, reward.bolts);
      if (reward.skin !== undefined) { const finish = finishes.get(reward.skin); if (finish === undefined) throw new Error('Missing admitted board finish');
        play.skins.own(reward.skin); play.wearSkin(finish.finish); play.hud.toast(finish.text); }
      persist(); sfx.interact('chest'); play.music.sting('pickup'); feats.event('streak', board.streak);
      play.hud.toast(notice(rows.notices.claimed, { claimed: board.claimed, streak: board.streak }));
    }],
    ['tear', (value: unknown): void => { if (typeof value !== 'number') throw new Error('Contract action requires its slot'); owner.tear(value); persist(); sfx.interact('door'); }],
  ]) }));
  const prompt: Interactable = { position: new Vector3(rows.at.x, terrainHeight(rows.at.x, rows.at.z) + rows.height, rows.at.z),
    get radius() { return panel().isOpen ? 0 : rows.radius; }, get label() { return board.slots.some(isFilled) ? rows.filled : rows.label; },
    onInteract: () => { panel().open(); sfx.interact('door', prompt.position, { gain: 0.5 }); } };
  runtime.interactables.push(prompt);
  ctx.scope.onDispose(() => { const index = runtime.interactables.indexOf(prompt); if (index !== -1) runtime.interactables.splice(index, 1); views.disposeLegacy(() => { panel().root.remove(); }); });
  let observing = false;
  return { state: board, panel, fill: slot => { const row = board.slots[slot]; if (row !== undefined) { row.have = row.need; persist(); } }, observe: () => {
    if (observing || ctx.scope.disposed) throw new Error('Quest board deaths already installed or disposed'); observing = true;
    ctx.on('actor.died', ({ actor }) => { const body = play.animals.animals.find(animal => animal.combatActor() === actor); if (body === undefined) return;
      const moved = owner.killed(contractKill(contracts, body)); if (moved.length === 0) return; persist();
      for (const slot of moved) { const row = board.slots[slot]; if (row !== undefined) play.hud.toast(notice(isFilled(row) ? rows.notices.filled : rows.notices.progress,
        { goal: row.goal, have: row.have, need: row.need })); }
    });
  } };
}
