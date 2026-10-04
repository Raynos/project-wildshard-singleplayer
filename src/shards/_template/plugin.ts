import { ShardPlugin, installLoot, installCompendium, type ShardContext } from '@wildshard/game';
import { IRON_SWORD, Sword, SWORD_IRON, BOAR, BOAR_LOOK, STARTER_EFFECTS, installStarterEffects, installSilentScore, installForestAmbience } from '@wildshard/kit';
import { Vector3 } from 'three';
import type { QuestState, Interactable } from '@wildshard/engine';
import { STRINGS } from './strings';
import { buildWorld } from './world/build';
import { GREY_BLOB, GREY_BLOB_LOOK } from './species/greyBlob';
import { TemplateWhip } from './weapons/TemplateWhip';
import { TemplateLantern } from './weapons/TemplateLantern';
import { WHIP_ROW, LANTERN_ROW } from './weapons/rows';
import { installQuest } from './quest/install';
import { installDebug } from './debug';
import { installEncounters } from './combat/encounters';
import { BLOB } from './layout';
import { ownPrimitives } from './world/resources';
import { installClimate } from './world/climate';
import { GREY_CARD } from './thumbs/card';
import { installTemplateCues } from './audio/cues';

declare module '@wildshard/engine' {
  interface TierKnobMap { 'template.propCount': number }
  interface ActionMap { 'template.lantern.toggle': true }
  interface EquipmentSlotMap { 'template-whip': true }
}

export class TemplatePlugin extends ShardPlugin {
  readonly player = new Vector3(); readonly lantern = new TemplateLantern(); whip: TemplateWhip | null = null; quest: QuestState | null = null;
  door: Interactable | null = null; doorAt = new Vector3(); propCount = 0;
  override world(ctx: ShardContext): void {
    ctx.strings(STRINGS); ctx.tiers.knobs({ id: 'template', defaults: { 'template.propCount': 10 } });
    this.propCount = ctx.manifest.tiers?.[ctx.app.render?.tier ?? 'phone']?.['template.propCount'] ?? 10;
    const built = buildWorld(ctx, this.propCount); this.door = built.door; this.doorAt.copy(built.doorAt);
    ctx.game.runtime?.interactables.push(built.door);
    ctx.playground({ id: 'template.jump', title: STRINGS.jump, blurb: STRINGS.jumpBlurb, icon: '', load: async () => (await import('./playground/JumpCourse')).JumpCourse });
  }
  override kit(ctx: ShardContext): void {
    ctx.rows.weapon([IRON_SWORD, WHIP_ROW]); ctx.rows.tool(LANTERN_ROW); ctx.rows.effect(STARTER_EFFECTS);
    ctx.rows.species([{ ...BOAR, variants: [...BOAR.variants, { id: 'greyback', label: STRINGS.elite, weight: 0, rarity: 'rare', scale: [1.2, 1.2], hp: 140 }] }, GREY_BLOB]);
    ctx.rows.speciesLook([BOAR_LOOK, GREY_BLOB_LOOK]); ctx.rows.encounter([{ id: 'template.elite', displayName: STRINGS.elite }, { id: 'template.boss', displayName: STRINGS.boss }]);
    ctx.rows.spawnTable({ id: 'template.spawns', table: { mode: 'each', rows: [{ item: { kind: 'greyBlob', variant: 'grey' }, weight: 1 }] } });
    ctx.rows.lootTable({ id: 'template.quest.reward' });
    ctx.rows.feat({ id: 'template.firstQuest', name: STRINGS.quest, goal: STRINGS.beat, count: 1, event: 'template.quest', title: STRINGS.quest, icon: 'glyph' });
    ctx.rows.compendium({ id: 'template.compendium', chunkId: ctx.manifest.slug,
      skin: { className: 'template', title: STRINGS.notes, tabs: [{ id: 'creatures', label: STRINGS.blob }], stamp: () => STRINGS.beat, stats: () => [] },
      entries: [{ id: 'greyBlob', kind: 'species', tab: 'creatures', name: STRINGS.blob, notes: STRINGS.note, plate: { sketch: GREY_CARD }, match: { kind: 'greyBlob' } }] });
    const rt = ctx.game.runtime;
    if (rt) rt.buildEquipment = (targets, nolock, viewmodel) => {
      if (rt.world === null) throw new Error('Template equipment needs the world stage');
      const iron = new Sword(rt.world, targets, { row: IRON_SWORD, profile: SWORD_IRON, allowUnlocked: nolock, ...viewmodel });
      this.whip = new TemplateWhip(ctx.app, targets, (target) => rt.play?.animals.animals.find((a) => a.position === target.position)?.combatActor() ?? null);
      this.whip.onSwing = (heavy) => { if (heavy) rt.play?.cues.charge(WHIP_ROW, 'heavy'); else rt.play?.cues.fire(WHIP_ROW); };
      return Promise.resolve({ primary: this.whip, secondary: iron, rifle: null, install: (equipment) => { equipment.unlock('sword-iron'); equipment.add(this.lantern, { locked: false }); } });
    };
  }
  override play(ctx: ShardContext): void {
    const equipmentHost = ctx.app.equipmentHost, whip = this.whip;
    if (equipmentHost !== null && whip !== null) {
      const lantern = this.lantern;
      equipmentHost.viewmodel.add(whip.model, lantern.model);
      ctx.scope.onDispose(() => { whip.model.removeFromParent(); lantern.model.removeFromParent(); });
    }
    const rt = ctx.game.runtime, position = rt?.world?.player.position ?? this.player;
    installClimate(ctx);
    if (rt?.play) { installSilentScore(rt.play.music, ctx.scope); installForestAmbience(rt.play.audio, ctx.scope); installTemplateCues(rt.play.audio, rt.play.cues, ctx.scope); }
    const loot = rt?.play && rt.world ? installLoot({ ctx, manifest: ctx.manifest, owned: rt.play.owned, scene: rt.world.game.scene,
      player: rt.world.player, camera: rt.world.game.camera, animals: () => rt.play?.animals.animals ?? [], menu: rt.play.menu,
      presentation: { gear: (purse) => ({ coins: purse.coins }), finds: null, marks: null, charted: () => false, chime: () => { rt.play?.cues.cue('cue.swap'); } } }) : null;
    if (rt?.play && rt.world) {
      const compendium = installCompendium({ chunkId: ctx.manifest.slug, game: rt.world.game, camera: rt.world.game.camera,
        hud: rt.play.hud, menu: rt.play.menu, animals: rt.play.animals, cabins: null, interactables: rt.interactables,
        weapons: rt.play.weapons, touchUi: rt.play.touchUi, nolock: rt.play.nolock });
      if (compendium) ctx.scope.onDispose(() => { compendium.journal.scope.dispose(); });
    }
    this.quest = installQuest(ctx, position, loot?.purse ? (share) => { loot.purse?.add(share); } : undefined).quest;
    if (rt) rt.hooks.questFlags = () => this.quest?.isComplete ? ['template.complete'] : [];
    ctx.inputContext({ id: 'template.whip', actions: ['attack', 'heavy', 'lock'], keysFrom: 'weapon.melee', touch: { mode: 'melee', lockable: true, relabel: {} } });
    ctx.inputContext({ id: 'template.lantern', priority: 20, enabled: () => ctx.app.state === 'play', actions: ['template.lantern.toggle'], keys: { 'template.lantern.toggle': ['KeyL'] },
      touch: { relabel: {}, verbs: { 'verb.1': { action: 'template.lantern.toggle', label: STRINGS.toggle, icon: '', show: () => ctx.app.state === 'play' } } } });
    ctx.app.input.push('template.lantern', ctx.scope);
    ctx.system({ id: 'template.lantern', phase: 'update', run: (dt) => { if (ctx.app.input.consume('template.lantern.toggle')) this.lantern.toggle(); if (!rt) this.lantern.update(dt); } });
    const meter = document.createElement('meter'); meter.min = 0; meter.max = 1; meter.value = this.lantern.oil; meter.setAttribute('aria-label', STRINGS.oil);
    ctx.hud.widget('band.3', meter, 0); ctx.hud.relabel('jump', STRINGS.toggle, '');
    const pin = document.createElement('span'); pin.textContent = STRINGS.hut; ctx.hud.pin(this.doorAt, pin);
    ctx.system({ id: 'template.oil', phase: 'late', run: () => { meter.value = this.lantern.oil; } });
    ctx.bag.tab({ id: 'notes', title: STRINGS.notes, icon: 'book', order: 50 });
    ctx.bag.fragment('notes', { id: 'template.notes', render: (host) => { const p = document.createElement('p'); p.textContent = STRINGS.note; host.append(p); } });
    installDebug(ctx, this.lantern); installEncounters(ctx, position);
    const spawner = ctx.app.encounters.spawn('template.spawns', ctx.scope, { create: (entry, at) => rt?.play?.animals.spawn(entry.kind, at.x, at.z, at.yaw, entry.variant) ?? null,
      retire: (actor) => { if (actor) rt?.play?.animals.retire(actor); } });
    spawner.spawn({ tags: [] }, { ...BLOB, yaw: 0 }, () => ctx.app.rng.stream('spawn').next());
    if (rt?.world && rt.play) installStarterEffects(ctx, { player: rt.world.player, health: ctx.app.player, effects: ctx.app.effects });
    ctx.debug.expose('template', this);
    ownPrimitives(this.lantern.model, ctx.scope); if (this.whip) ownPrimitives(this.whip.model, ctx.scope);
  }
}
// oxlint-disable-next-line import/no-default-export -- Manifest plugin constructor contract.
export default TemplatePlugin;
