/**
 * The quest spine (A1, D5) on top of the adventure's flags + interactables: the quest state (quest.ts + driftwood.ts),
 * the quest chip under the minimap with the nearest marker's distance and bearing (the full quest is on the map tab), Wendell the castaway at his
 * campfire below the hut with his dialogue ("[E] Talk to Wendell" → the DialogueBox), and the kill hooks that feed
 * the quest (the drowned sailor drops the hold key where he falls; the Drowned Captain's death opens the finale).
 *
 *   const spine = installSpine(adventure, world);   // Adventure.ts calls this
 *   spine.quest.objective()  spine.markers()        // the map reads the live markers (A5)
 */
import * as THREE from 'three';
import { app } from '@wildshard/engine/app/runtime';
import { ownSceneTree, sceneObjectOwner } from '@wildshard/engine/app/sceneOwnership';
import { boxInFrame } from '@wildshard/engine/physics/box';
import type { QuestState } from '@wildshard/engine/quest/core';
import { NpcTalk, type LiveMarker } from '@wildshard/engine/quest/view';
import { DialogueBox, type ObjectiveLine } from '@wildshard/engine/quest/view/ui';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeQuest, type RuntimeFacts } from '@wildshard/game/shardfile/hybridRows';
import source from '../shard.config';
import { DRIFTWOOD_MARKERS } from '../data/quests';
import { presentQuest } from '@wildshard/game/quest/presentation';
import { CASTAWAY, DRIFTWOOD_QUEST } from './questLine';
import type { Castaway } from '../npc/Castaway';
import { castawayRig } from './people';
import type { Adventure, AdventureWorld, AdvAnimal } from './adventure';


export interface Spine {
  quest: QuestState;
  castaway: Castaway;
  dialogue: DialogueBox;
  objective: ObjectiveLine;
  /** the current step's markers in world coordinates */
  markers: () => LiveMarker[];
}

const TALK_R = 3.2;

/** SF57: a subtree one home entry built belongs to that entry's scope: it leaves the scene and frees what it alone holds
 *  when the entry ends (a re-entered borrowed home runs its installs again; the page scene must not keep every copy). */
export function ownEnteredTree(object: THREE.Object3D, scope: Parameters<typeof ownSceneTree>[1]): void {
  // A grid region's view already owns a registered piece's object (its own entry-lived scope): that owner stands.
  const mine = sceneObjectOwner(object);
  if (mine !== null && mine !== (object.parent === null ? null : sceneObjectOwner(object.parent))) return;
  ownSceneTree(object, scope, app.assets);
}

export function installSpine<A extends AdvAnimal>(adv: Adventure, w: AdventureWorld<A>, ctx: ShardContext, facts: RuntimeFacts): Spine {
  const { flags, kit, place } = adv;
  const quest = bindRuntimeQuest(ctx, source, DRIFTWOOD_QUEST.id, { flags, facts, place: marker => DRIFTWOOD_MARKERS[marker.id] }).state;
  // the chip (the shared quest core, core.ts) — built before the dialogue box, as it always was (their DOM order)
  // after the quest (E132): "Still to find" + the nearest sea glass / place / treasure left (Complete.ts); hidden once all are found
  const leftovers = (): LiveMarker[] | null => (quest.isComplete && adv.complete ? adv.complete.leftMarkers() : null);
  const presentation = presentQuest({ scope: w.scope ?? app.levelScope ?? app.engineScope, player: w.player,
    toast: (text) => { w.hud.toast(text); }, sting: () => { w.music.sting('chunk'); },
    ...(w.fullMap === undefined ? {} : { fullMap: w.fullMap }) }, quest, {
    place, introTitle: 'Driftwood Isle', worldPins: false, mapMarkers: false, minimapMarks: false,
    chip: () => { const l = leftovers(); return l === null ? quest.chip() : { label: l.length > 0 ? 'Still to find' : '', count: '' }; },
    markers: () => leftovers() ?? presentation.markers(),
    stepToast: (step, prev) => prev === null && step.id === 'shards' ? `New quest · ${DRIFTWOOD_QUEST.title}` : `Objective · ${quest.objective()}`,
  });
  const { chip, markers } = presentation;
  const objective = chip.line;
  const dialogue = new DialogueBox(w.scope?.child('dialogue'));
  w.scope?.onDispose(() => { quest.dispose(); objective.root.remove(); });

  // ── Wendell at his campfire in front of the hut steps (hut local frame: the door faces −z) ──
  const feet = place({ poi: 'hut', anchor: 'hut.npc', x: 2.4, z: -8.2, yaw: Math.PI + 0.35 });
  const fire = place({ poi: 'hut', x: 0.7, z: -9.8 });
  const npc = castawayRig(w.sky, feet, fire), castaway = npc.model;
  w.scope?.onDispose(() => { npc.dispose(); });
  // SF57: Wendell, his piece and its body belong to this entry, not the page (a re-entered borrowed home builds him again)
  const entry = w.scope;
  w.game.scene.add(castaway.group);
  const wendell = (): void => { (w.registry ?? app.registry).add({ id: 'npc-castaway', name: 'Wendell', category: 'people', file: 'src/shards/driftwood-isle/quest/Spine.ts', colliders: [boxInFrame(castaway.collider, castaway.group, 'wood', false)], follows: castaway.group, followRotation: false }); };
  if (entry === undefined) wendell();
  else { ownEnteredTree(castaway.group, entry); entry.run(wendell); }
  castaway.group.updateMatrixWorld(true);
  const talkAt = castaway.headWorld(new THREE.Vector3());
  let waved = false, stowed = false;
  const talk = new NpcTalk({ dialogue, flags, npc: CASTAWAY, at: talkAt, radius: TALK_R, label: 'Talk to Wendell', speaker: castaway, onOpen: () => { w.audio.weaponSwap(); } });
  w.prompts.push(talk.prompt);

  // ── the quest's beats: a toast + the chunk sting on every step, a fanfare at the end ──

  // ── kills: the sailor drops the hold key; the captain ends the fight ──
  // Ordered scoped death listener: the hold key lands before respawn and reward listeners.
  const killed = (a: A): void => {
    if (a.kind === 'sailor') {
      kit.moveTo('hold-key', a.position.x, a.position.z);
      flags.set('dead:sailor');
      w.hud.toast('The drowned sailor collapses — his hold key clatters to the planks');
    } else if (a.kind === 'captain') flags.set('dead:captain');
  };
  w.onDeath?.(killed, 10);

  // the full quest — chapter title, objective, sub-steps — on the menu's MAP tab (the HUD chip only carries the short form, E51)

  // ── per frame: the quest chip, the nearest marker, the dialogue ──
  w.game.onUpdate((dt, t) => {
    const pp = w.player.position;
    dialogue.update(dt);
    talk.update(pp);
    npc.update(dt, t, pp);
    // the sword goes down while you talk to Wendell and comes back up when the talk ends (E129)
    if (talk.talking !== stowed) { stowed = talk.talking; w.stowWeapon?.(stowed); }
    if (!waved && !flags.has('talked:castaway') && pp.distanceToSquared(castaway.position) < 16 * 16) { waved = true; castaway.wave(); }
    presentation.update(dt, t);
  }, 'shard.driftwood-isle.installSpine');
  return { quest, castaway, dialogue, objective, markers };
}
