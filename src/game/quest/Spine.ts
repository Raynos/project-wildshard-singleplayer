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
import { QuestState, type QuestMarker } from './quest';
import { CASTAWAY, DRIFTWOOD_QUEST } from './driftwood';
import { DialogueBox, type ObjectiveLine } from './QuestUI';
import { Castaway } from '../../entities/npc/Castaway';
import { NpcTalk, QuestChip, type LiveMarker } from './core';
import type { Adventure, AdventureWorld, AdvAnimal } from './Adventure';

export type { LiveMarker } from './core';

export interface Spine {
  quest: QuestState;
  castaway: Castaway;
  dialogue: DialogueBox;
  objective: ObjectiveLine;
  /** the current step's markers in world coordinates */
  markers: () => LiveMarker[];
}

const TALK_R = 3.2;

export function installSpine<A extends AdvAnimal>(adv: Adventure, w: AdventureWorld<A>): Spine {
  const { flags, kit, place } = adv;
  const quest = new QuestState(DRIFTWOOD_QUEST, flags);
  const markers = (): LiveMarker[] => quest.markers().map((m: QuestMarker) => { const p = place(m.at); return { id: m.id, label: m.label, short: m.short ?? m.label, x: p.x, z: p.z }; });
  // the chip (the shared quest core, core.ts) — built before the dialogue box, as it always was (their DOM order)
  const chip = new QuestChip({ chip: () => quest.chip(), markers });
  const objective = chip.line;
  const dialogue = new DialogueBox();

  // ── Wendell at his campfire in front of the hut steps (hut local frame: the door faces −z) ──
  const feet = place({ poi: 'hut', anchor: 'hut.npc', x: 2.4, z: -8.2, yaw: Math.PI + 0.35 });
  const fire = place({ poi: 'hut', x: 0.7, z: -9.8 });
  const castaway = new Castaway(w.sky, feet, fire).build();
  w.game.scene.add(castaway.group);
  w.player.colliders.push(castaway.collider);
  castaway.group.updateMatrixWorld(true);
  const talkAt = castaway.headWorld(new THREE.Vector3());
  let waved = false, stowed = false;
  const talk = new NpcTalk({ dialogue, flags, npc: CASTAWAY, at: talkAt, radius: TALK_R, label: 'Talk to Wendell', speaker: castaway, onOpen: () => { w.audio.weaponSwap(); } });
  w.prompts.push(talk.prompt);

  // ── the quest's beats: a toast + the chunk sting on every step, a fanfare at the end ──
  quest.onStep = (step, prev) => {
    if (prev === null && step?.id === 'shards') w.hud.toast(`New quest · ${DRIFTWOOD_QUEST.title}`);
    else if (step) w.hud.toast(`Objective · ${quest.objective()}`);
    w.music.sting('chunk');
  };
  quest.onComplete = () => { w.hud.toast(`Quest complete · ${DRIFTWOOD_QUEST.title}`); };

  // ── kills: the sailor drops the hold key; the captain ends the fight ──
  // chained on the first frame, not now: main.ts assigns its own onKill (kill feed, achievements, skins) after this
  let chained = false;
  const chainKill = (): void => {
    chained = true;
    const prevKill = w.animals.onKill;
    w.animals.onKill = (a) => {
      prevKill?.(a);
      if (a.kind === 'sailor') {
        kit.moveTo('hold-key', a.position.x, a.position.z);
        flags.set('dead:sailor');
        w.hud.toast('The drowned sailor collapses — his hold key clatters to the planks');
      } else if (a.kind === 'captain') flags.set('dead:captain');
    };
  };

  // the full quest — chapter title, objective, sub-steps — on the menu's MAP tab (the HUD chip only carries the short form, E51)
  const chapter = (): string => (quest.isStarted ? DRIFTWOOD_QUEST.title : 'Driftwood Isle');
  w.fullMap?.setQuest?.(() => ({ title: chapter(), objective: quest.objective(), hint: quest.isComplete ? '' : quest.hint() }));

  // ── per frame: the quest chip, the nearest marker, the dialogue ──
  w.game.onUpdate((dt, t) => {
    if (!chained) chainKill();
    const pp = w.player.position;
    dialogue.update(dt);
    talk.update(pp);
    castaway.update(dt, t, pp);
    // the sword goes down while you talk to Wendell and comes back up when the talk ends (E129)
    if (talk.talking !== stowed) { stowed = talk.talking; w.stowWeapon?.(stowed); }
    if (!waved && !flags.has('talked:castaway') && pp.distanceToSquared(castaway.position) < 16 * 16) { waved = true; castaway.wave(); }
    chip.update(t, w.player);
  });
  return { quest, castaway, dialogue, objective, markers };
}
