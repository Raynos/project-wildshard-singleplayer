// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { NpcTalk } from '../src/engine/quest/view';
import { DialogueBox } from '../src/engine/quest/view/ui';
import { Flags } from '../src/engine/world/interact/flags';
import { createReadingRoster } from '../src/game/plugin/quests';
import { CAMP_NPCS } from '../src/shards/nalati-grasslands/data/questStory';

test('the W3 camp roster can borrow its actual page talks and clock without a native save owner', () => {
  const scope = new Scope('camp-reading-roster'), dialogue = new DialogueBox(scope), flags = new Flags('camp-reading-roster', false);
  const at = new Vector3(0, 1, 0), feet = new Vector3(), speakers: { talking: boolean }[] = [], opened: string[] = [], completed: string[] = [];
  const ids = Object.keys(CAMP_NPCS), spots = ids.map(kind => ({ kind, at, prompt: { x: at.x, y: at.y, z: at.z, radius: 3 } }));
  try {
    const roster = createReadingRoster({ speakers: CAMP_NPCS }, spots, (npc, head, radius) => {
      const speaker = { talking: false }; speakers.push(speaker);
      const talk = new NpcTalk({ dialogue, flags, npc, at: new Vector3(head.x, head.y, head.z), radius, label: npc.name, speaker,
        onOpen: () => { opened.push(npc.id); } });
      return {
        get active() { return talk.talking; }, use: () => { talk.talk(); },
        dismiss: () => { dialogue.close(false); talk.update(feet); },
        step: (_dt: number, point: Readonly<{ x: number; y: number; z: number }>) => { talk.update(new Vector3(point.x, point.y, point.z)); },
      };
    }, id => { completed.push(id); });
    roster.press('elder'); expect(roster.active).toBe(true); expect(dialogue.isOpen).toBe(true);
    const first = opened[0]; expect(first).toBe(CAMP_NPCS.elder.id);
    roster.press('cook'); expect(opened).toEqual([first]); // USE advances the current elder, not the cook
    expect(() => roster.snapshot()).toThrow('native continuation');
    roster.advanceReading(0.1, new Vector3(20, 0, 0));
    expect(roster.active).toBe(false); expect(dialogue.isOpen).toBe(false);
    expect(speakers.every(speaker => !speaker.talking)).toBe(true); expect(completed).toEqual([]);
    roster.press('elder'); roster.dismiss();
    expect(dialogue.isOpen).toBe(false); expect(speakers.every(speaker => !speaker.talking)).toBe(true); expect(completed).toEqual([]);
  } finally { dialogue.dispose(); scope.dispose(); }
});
