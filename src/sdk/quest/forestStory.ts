import type { DeclaredSoundBank } from '@wildshard/engine/audio/declaredBank';
import { readChapterDirector, installQuestSpawnDirector, installChapterLead } from '@wildshard/game/quest/chapterDirector';
import { prepareQuestEntry } from '@wildshard/game/quest/chapter';
import { installQuestShop } from '@wildshard/game/quest/trader';
import { parseContractCatalogue } from '@wildshard/format/contracts';
import { MoverRuntime } from '@wildshard/game/plugin/mover';
import { parseQuestPageInteractions } from '@wildshard/format/questInteractions';
import { perfLap } from '@wildshard/engine/core/perfLap';
import { DomePuffs } from '@wildshard/engine/fx/groundFx';
import { test } from '@wildshard/engine/world/interact/flags';
import type { InteractEvent } from '@wildshard/engine/world/interact/Interactables';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { ItemId } from '@wildshard/game/Inventory';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeQuest } from '@wildshard/game/shardfile/hybridRows';
import * as THREE from 'three';
import type { ForestStoryRows, ForestStoryContent, ForestStory } from './forestStoryRows';
import { forestPage } from '@wildshard/game/shardfile/forestPage';
import { rangedPage } from '@wildshard/game/loadout/rangedPage';
import { DataPanel, readDataPanels } from '@wildshard/game/ui/dataPanels';
import { isItemId } from '@wildshard/game/bag/itemCatalog';
import { isJsonData } from '@wildshard/format/json';
import { QuestViews, bindQuestPageInteractions } from '@wildshard/game/plugin/ui';

const _v = new THREE.Vector3();
/** Client-only story composition over native page owners. Rows supply every
 * content identity; custom world drawing consumes the returned observations. */
export async function installForestStory(ctx: ShardContext, rows: ForestStoryRows): Promise<ForestStory> {
  if (!isJsonData(rows)) throw new Error('Forest story requires JSON rows');
  const source = ctx.product.shardfile, floor = forestPage(ctx.scope, rows.page), equipment = rangedPage(ctx.scope, rows.ranged);
  const runtime = ctx.game.runtime, enteredWorld = runtime?.world, play = runtime?.play;
  if (runtime === undefined || enteredWorld === undefined || enteredWorld === null || play === undefined || play === null) throw new Error('Story requires entered play services');
  const h = { ...enteredWorld, ...play, ctx, cabins: floor.cabins, trees: enteredWorld.forest.trees,
    interactables: runtime.interactables, chunkId: ctx.manifest.slug, compendium: equipment.compendium?.state ?? null };
  const panels = await readDataPanels(h.ctx.product);
  const boardPanel = panels[rows.panels.board], countPanel = panels[rows.panels.count];
  if (boardPanel === undefined || countPanel === undefined) throw new Error('Story requires its named quest panels');
  const native = h.ctx.product.section<ForestStoryContent>(rows.content);

  const traderStall: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file(rows.files.stall)));
  const contracts = parseContractCatalogue(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file(rows.files.contracts))));
  const lanternRows = parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file(rows.files.signals))));
  const doorRows = parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file(rows.files.door))));
  const { game, sky, player, hud, inventory } = h;
  const entry = await prepareQuestEntry(ctx, { story: 'quests/story.json', services: rows.files.services, placement: { registryReach: 20 } });
  const { story, flags, floorAt } = entry;
  const featFacts = await entry.achievements(), facts = featFacts.facts;
  const { state: quest, cables } = bindRuntimeQuest(ctx, source, story.quest.id, { flags, facts });

  const sfx = equipment.ambience.sfx;
  const shot = (name: Parameters<DeclaredSoundBank['shot']>[0], at?: THREE.Vector3): void => { sfx.shot(name, at ? { at } : {}); };

  const { table } = native, lanternRules = source.questHost?.interactions;
  if (lanternRules === undefined) throw new Error('Story requires its admitted quest host');
  const kit = await entry.interact({ table, registryReach: 20 },
    { id: 'quest.kit', after: ['engine.compendium.installCompendium'], before: ['hud.combat', 'main.frame'] });
  const kitSfx = kit.sfx;

  const ui = new QuestViews(ctx);
  const chip = ui.view('count', (scope) => new DataPanel(countPanel, { scope }));
  const shelf = rows.collections.find(row => row.shelf !== undefined);
  const shelfObject = shelf?.shelf === undefined ? null : (await h.cabins.resources.place(shelf.shelf)).object;
  const count = (row: ForestStoryRows['collections'][number]): number => flags.count(row.prefix);
  if (shelfObject !== null && shelf !== undefined) shelfObject.visible = count(shelf) === shelf.names.length;
  const calls = new Map<string, (e: InteractEvent) => void>(rows.collections.flatMap(row => [
    [row.event, (e: InteractEvent): void => {
      if (row.item !== undefined) { if (!isItemId(row.item)) throw new Error('Unknown story item'); inventory.add(row.item); }
      chip().show({ label: row.label, n: count(row), of: row.names.length });
      if (row.take !== undefined) { const index = Number(e.def.id.split('-').at(-1) ?? '1') - 1; hud.toast(row.take + (row.names[index] ?? row.fallback)); }
    }],
    [row.completeEvent, (): void => { if (count(row) === row.names.length) { hud.toast(row.complete); if (row.shelf !== undefined && shelfObject !== null) shelfObject.visible = true; } }],
  ]));
  calls.set(rows.pickupEvent, () => { h.music.sting('pickup'); });
  kit.onEvent = kitSfx.bindEvents(native.events, { toast: text => { hud.toast(text); }, calls });
  entry.bench();

  const points = Object.fromEntries(rows.signals.map(row => [row.id, new THREE.Vector3(row.x, floorAt(row.x, row.z) + row.height, row.z)]));
  const lanternPage = bindQuestPageInteractions(lanternRows, { flags, interactions: lanternRules, timer: ui,
    promptIds: rows.signals.map(row => row.id), interactables: h.interactables, toast: text => { hud.toast(text); },
    owners: new Map<string, unknown>([['points', points], ['sound', { shot }], ['sfx', kitSfx]]) });
  const lanternPrompts = Object.fromEntries(rows.signals.map(row => [row.id, lanternPage.prompt(row.id)]));
  const syncWheel = (): void => { h.cabins.life.wheelSpeed = flags.has(rows.wheel.flag) ? rows.wheel.speed : 0; };
  syncWheel();
  ctx.scope.onDispose(flags.onChange(f => { if (f === rows.wheel.flag) syncWheel(); }));
  const millDoor = ((): { prompt: Interactable; use: () => void } | null => {
    const mill = h.cabins.buildings.find((b) => b.id === rows.door.building);
    const piece = mill ? h.cabins.life.doorPieces().find((d) => d.id === `cabin-${mill.index + 1}-door`) : undefined;
    if (!piece) return null;
    h.registry.add({ id: `${piece.id}-bar`, name: 'Mill door bar', category: 'buildings', file: 'src/sdk/quest/forestStory.ts', surface: 'wood',
      follows: piece.pivot, colliders: piece.colliders, active: () => !flags.has(rows.door.flag) });
    const hinge = piece.pivot.getWorldPosition(new THREE.Vector3());
    let best: Interactable | null = null, bestD = 1.5; // the prompt stands ~0.7 m from its hinge; the next door is metres off
    for (const it of h.cabins.life.interactables) {
      const d = Math.hypot(it.position.x - hinge.x, it.position.z - hinge.z);
      if (d < bestD && /^(Open|Close) door$/.test(it.label)) { best = it; bestD = d; }
    }
    return best === null ? null : { prompt: best, use: piece.use };
  })();
  if (millDoor) bindQuestPageInteractions(doorRows, { flags, toast: text => { hud.toast(text); },
    owners: new Map<string, unknown>([['door', millDoor], ['sfx', kitSfx]]) });
  const thralls = await installQuestSpawnDirector(ctx, native);
  thralls.useSfx(sfx);
  const boardPage = entry.board({ contracts, panel: boardPanel, store: rows.store, ...rows.board });
  const board = boardPage.state, boardUi = boardPage.panel;

  entry.trader({ rows: traderStall });
  const talks = await entry.talks({ ...rows.talks, steps: native.steps });
  const { people, dialogue } = talks;
  const trade = installQuestShop(ctx, traderStall);
  ui.panelHold({ hud, weapons: h.weapons, menu: h.menu, nolock: h.nolock, touchUi: h.touchUi,
    panels: [boardUi, trade], closeMenu: true, resetOnLeave: true });
  entry.deaths({ effects: native.pageDeaths, order: 0 });
  boardPage.observe();

  const cableId = rows.cable.id;
  let zip: { trolley: THREE.Mesh; prompt: ReturnType<typeof cables.bindView> };
  let canoe: { group: THREE.Mesh };
  let motion: MoverRuntime;
  {
    const cable = await entry.cable({ mode: cableId, carriage: rows.cable.trolley, scene: { kind: 'object', id: rows.cable.scene },
      prompt: { x: rows.cable.prompt[0], y: rows.cable.prompt[1], z: rows.cable.prompt[2] }, radius: rows.cable.radius, label: rows.cable.label, camera: true });
    zip = { trolley: cable.trolley, prompt: cable.prompt };
    const world = ctx.game.runtime?.world; if (world === undefined || world === null) throw new Error('Canoe requires its active world');
    canoe = { group: floor.resources.mesh(rows.mover.mesh) };
    motion = await MoverRuntime.enter(ctx, world, ctx.product.shardfile.movers, rows.mover.binding, { canoe }, { flags, prompts: h.interactables });
  }

  let hollow: { floorY: number; mid: THREE.Vector3; mouths: THREE.Vector3[] } | null = null;
  void h.cabins.resources.place(rows.secret.scene).then(() => {
    const site = rows.secret;
    hollow = { floorY: site.floorY, mid: new THREE.Vector3().fromArray(site.mid), mouths: site.mouths.map(point => new THREE.Vector3().fromArray(point)) };
    return hollow;
  });

  const presentation = entry.chapter({ program: native.lead.program });
  const places = presentation.discover(rows.map.pois.map(p => ({ id: p.id, label: p.name, x: p.x, z: p.z, r: p.r, quiet: true })));
  const questChip = presentation.chip, objective = presentation.objective;
  const clock = await readChapterDirector(ctx, rows.files.director);
  ui.retainRoot(objective.root, () => { objective.hide(false); });
  ui.retainRoot(clock.caption.root, () => { clock.caption.show(false); });
  function runDawn(): void { clock.request('dawn.request'); }


  const stag = installChapterLead(ctx, native);
  // the guide's and the spawns' declared puffs: shimmer domes swelling where each cue fired
  const leadPuffs = new DomePuffs(game.scene, new THREE.Color(...stag.puffs.color), stag.puffs.count), spawnPuffs = new DomePuffs(game.scene, new THREE.Color(...thralls.puffs.color), thralls.puffs.count);
  ctx.scope.onDispose(() => { leadPuffs.dispose(); spawnPuffs.dispose(); });

  presentation.publishMap({ declutter: true, unknownLabel: '?', markerLabels: 'full' });
  const placeNames = new Set(rows.map.pois.map((p) => p.name.toUpperCase()));
  h.fullMap.setZones(rows.map.zones.filter((zn) => !placeNames.has(zn.label)));
  h.fullMap.setFeatures({ trees: h.trees, roofs: h.cabins.roofs });

  entry.observe();
  const journalFull = (): boolean => {
    const st = h.compendium; if (!st) return false;
    return st.def.entries.every((e) => { const s = st.stats(e.id).state; return s === 'seen' || s === 'taken'; });
  };

  let slowT = 0;
  // each signal's lantern is lit while any of its declared flags is set
  const lanternLit = new Map<string, boolean>();
  const lightLanterns = (): void => { for (const row of rows.signals) { const on = row.lantern.when.some(flag => flags.has(flag));
    if (lanternLit.get(row.id) !== on) { lanternLit.set(row.id, on); floor.setLantern(row.lantern.id, on); } } };
  lightLanterns();
  ctx.system({ id: 'quest', phase: 'update', after: ['quest.kit'], before: ['hud.combat', 'main.frame'], run: (dt, t) => {
    const pp = player.position;
    talks.update(dt, t, pp);
    {
      cables.update(cableId, dt);
      for (const on of cables.takeTransitions(cableId)) {
        h.weapons.visible = !on; h.weapons.setEnabled(!on);
        if (on) { shot('zipline', new THREE.Vector3(...rows.cable.top)); kitSfx.interact('lever', new THREE.Vector3(...rows.cable.launch)); }
        else { kitSfx.interact('plate', new THREE.Vector3(...rows.cable.landing)); hud.toast(rows.cable.arrival); }
      }
    }
    for (const event of motion.takeRideTransitions(rows.mover.id)) {
      h.weapons.visible = !event.riding; h.weapons.setEnabled(!event.riding);
      const rest = h.cabins.resources.object(rows.mover.rest);
      if (event.riding) rest.visible = false;
      if (event.arrived === -1) rest.visible = true;
      if (event.riding) {
        const at = motion.data.find(row => row.id === rows.mover.id)?.at; if (at === undefined) throw new Error('Missing canoe rest pose');
        kitSfx.interact('door', new THREE.Vector3(at.x, at.y, at.z), { gain: 0.6 });
      }
      if (event.hint !== undefined) hud.toast(event.hint);
    }
    clock.update(dt);
    if (!perfLap.active) { // E350 F-J1: the PERF LAP's teleports call no stag and no thralls
      stag.update(dt, t);
      thralls.update(dt, pp);
      leadPuffs.update(dt, t); spawnPuffs.update(dt, t);
      for (const puff of stag.takePuffs()) leadPuffs.burst(_v.set(puff.x, puff.y + stag.puffs.height, puff.z), ...stag.puffs[puff.kind]);
      for (const puff of thralls.takePuffs()) spawnPuffs.burst(_v.set(puff.x, puff.y + thralls.puffs.height, puff.z), ...thralls.puffs.burst);
    }
    questChip.update(t, player); lightLanterns();
    if (t - slowT > 0.5) {
      slowT = t;
      const cam = game.camera.position;
      for (const p of people) p.lod(cam);
      zip.trolley.visible = cables.state(cableId).riding || cam.distanceToSquared(zip.trolley.position) < 160 * 160;
      if (!perfLap.active) places.update(pp.x, pp.z); // E350 F-J1: a lap's spot is not discovered
      if (!perfLap.active && hollow && !flags.has(rows.secret.flag) && hollow.mid.distanceToSquared(_v.set(pp.x, hollow.floorY, pp.z)) < 2.2 * 2.2 && Math.abs(pp.y - hollow.floorY) < 0.8) {
        flags.set(rows.secret.flag); hud.toast(rows.secret.text);
      }
      if (journalFull()) featFacts.event('journal', 1);
    }
  } });

  const standAt = (jump: ForestStoryRows['jumps'][string]): void => {
    player.spawn(jump.x, jump.z, Math.atan2(-(jump.look.x - jump.x), -(jump.look.z - jump.z)));
    if (jump.height !== undefined) player.position.y = heightAt(jump.height.x, jump.height.z) + jump.height.up;
    if (jump.phase !== undefined && sky.dayNight !== null) void sky.dayNight.set(jump.phase);
  };
  const goto = (bt: string): void => {
    const b = rows.jumps[bt]; if (b === undefined) return;
    flags.reset(); for (const f of b.flags) flags.set(f);
    syncWheel();
    standAt(b);
  };
  const debug = {
    flags, quest, board, kit, stag, thralls, people, content: native.content,
    jump: goto, goto,
    dawn: runDawn, night: (): void => { clock.run('debug.night'); },
    zip, cables, canoe, movers: motion, lanterns: lanternPrompts, hollow: () => hollow,
    openBoard: (): void => { boardUi().open(); }, openTrade: (): void => { trade().open(); },
    callThralls: (): void => { thralls.force(); },
    give: (id: ItemId, n = 1): void => { inventory.add(id, n); },
    fill: boardPage.fill,
    test: (c: { all?: string[] }): boolean => test(flags, c),
  };
  ctx.debug.expose(rows.debug.id, debug);
  ctx.debug.expose(`harness.quest.${ctx.manifest.slug}`, () => flags.all.slice().sort());
  if (!ui.exposeBrowser(rows.debug.browser, debug)) ctx.scope.expose(window, rows.debug.browser, debug);
  ctx.scope.onDispose(() => {
    objective.root.remove(); clock.caption.root.remove();
    ui.disposeLegacy(() => { dialogue().dispose(); trade().root.remove(); chip().root.remove(); });
  });
  return { flags, stag, thralls, motion };
}
