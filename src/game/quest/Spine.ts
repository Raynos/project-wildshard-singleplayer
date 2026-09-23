/**
 * The quest spine (A1, D5) on top of the adventure's flags + interactables: the quest state (quest.ts + driftwood.ts),
 * the objective line under the minimap with the nearest marker's distance and bearing, Wendell the castaway at his
 * campfire below the hut with his dialogue ("[E] Talk to Wendell" → the DialogueBox), and the kill hooks that feed
 * the quest (the drowned sailor drops the hold key where he falls; the Drowned Captain's death opens the finale).
 *
 *   const spine = installSpine(adventure, world);   // Adventure.ts calls this
 *   spine.quest.objective()  spine.markers()        // the map reads the live markers (A5)
 */
import * as THREE from 'three';
import { QuestState, lineFor, type QuestMarker } from './quest';
import { CASTAWAY, DRIFTWOOD_QUEST } from './driftwood';
import { DialogueBox, ObjectiveLine } from './QuestUI';
import { Castaway } from '../../entities/npc/Castaway';
import type { Adventure, AdventureWorld, AdvAnimal } from './Adventure';
import type { Interactable } from '../../world/Cabin';

export interface LiveMarker { id: string; label: string; x: number; z: number }

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
  const objective = new ObjectiveLine();
  const dialogue = new DialogueBox();

  // ── Wendell at his campfire in front of the hut steps (hut local frame: the door faces −z) ──
  const feet = place({ poi: 'hut', x: 2.4, z: -8.2, yaw: Math.PI + 0.35 });
  const fire = place({ poi: 'hut', x: 0.7, z: -9.8 });
  const castaway = new Castaway(w.sky, feet, fire).build();
  w.game.scene.add(castaway.group);
  w.player.colliders.push(castaway.collider);
  castaway.group.updateMatrixWorld(true);
  const talkAt = castaway.headWorld(new THREE.Vector3());
  let waved = false;
  const talk = (): void => {
    if (dialogue.isOpen) { dialogue.advance(); return; }
    const entry = lineFor(CASTAWAY, flags);
    if (!entry) return;
    castaway.talking = true;
    dialogue.open(CASTAWAY.name, entry.lines, () => {
      castaway.talking = false;
      for (const f of entry.sets ?? []) flags.set(f);
    });
    w.audio.weaponSwap();
  };
  const prompt: Interactable = {
    position: talkAt,
    get radius() { return dialogue.isOpen ? 0 : TALK_R; },   // hidden while talking: the box has its own NEXT (E / a tap)
    label: 'Talk to Wendell',
    onInteract: talk,
  };
  w.prompts.push(prompt);

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

  const markers = (): LiveMarker[] => quest.markers().map((m: QuestMarker) => { const p = place(m.at); return { id: m.id, label: m.label, x: p.x, z: p.z }; });

  // ── per frame: the objective line, the nearest marker, the dialogue ──
  let navT = 0;
  w.game.onUpdate((dt, t) => {
    if (!chained) chainKill();
    const pp = w.player.position;
    dialogue.update(dt);
    if (dialogue.isOpen && pp.distanceTo(talkAt) > TALK_R + 2.5) { dialogue.close(false); castaway.talking = false; }
    castaway.update(dt, t, pp);
    if (!waved && !flags.has('talked:castaway') && pp.distanceToSquared(castaway.position) < 16 * 16) { waved = true; castaway.wave(); }
    objective.update(t);
    if (t - navT > 0.1) {
      navT = t;
      objective.set(quest.isStarted ? DRIFTWOOD_QUEST.title : 'Driftwood Isle', quest.objective(), quest.isComplete ? '' : quest.hint());
      let best: LiveMarker | null = null, bd = Infinity;
      for (const m of markers()) { const d = Math.hypot(m.x - pp.x, m.z - pp.z); if (d < bd) { bd = d; best = m; } }
      if (best && bd > 6) {
        // bearing relative to the view: forward = (−sin yaw, −cos yaw), right = (cos yaw, −sin yaw) (Player / main.ts)
        const dx = best.x - pp.x, dz = best.z - pp.z, sy = Math.sin(w.player.yaw), cy = Math.cos(w.player.yaw);
        objective.setNav(best.label, bd, Math.atan2(dx * cy - dz * sy, -dx * sy - dz * cy));
      } else objective.setNav(null, 0, 0);
    }
  });
  return { quest, castaway, dialogue, objective, markers };
}
