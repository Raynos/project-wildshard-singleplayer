import { describe, expect, it } from 'vitest';
import { QuestLine, Events, Scope } from '#engine';
import { Flags } from '#engine/world/interact/flags';
import { WARDENS_HOLLOW } from '#shards/pine-hollow/quest/wardensHollow';
import { BEATS, beatFlags, type Beat } from '#shards/pine-hollow/quest/beats';

const STEPS: Readonly<Record<Beat, string | null>> = { ranger: null, pond: 'pond', ridge: 'ridge', zip: 'zip', den: 'den', stag: 'stag', king: 'king', dawn: 'dawn', done: null, hamlet: null };
describe('engine quest core with Pine authored beats', () => {
  it('resumes every harness beat with exactly the authored flags and current step', () => {
    for (const name of Object.keys(BEATS) as Beat[]) {
      const flags = new Flags('pine-hollow', false);
      for (const flag of beatFlags(name)) flags.set(flag);
      const line = new QuestLine([WARDENS_HOLLOW], flags), quest = line.chapters[0];
      expect(quest?.current?.id ?? null).toBe(STEPS[name]);
      expect(flags.all).toEqual(beatFlags(name)); line.dispose();
    }
  });
  it('raises completion once, reports steps on the level event bus and releases flag listeners', () => {
    const flags = new Flags('pine-hollow', false), events = new Events(), scope = new Scope('quest');
    const line = new QuestLine([WARDENS_HOLLOW], flags, events, scope), changes: (string | null)[] = [];
    events.on('quest.step', ({ level, quest, step }) => {
      expect(level).toBe('pine-hollow'); expect(quest).toBe('wardens-hollow'); changes.push(step);
    }, scope);
    for (const flag of beatFlags('done')) flags.set(flag);
    events.flush('update'); expect(line.chapters[0]?.isComplete).toBe(true);
    expect(changes).toEqual(['pond', 'ridge', 'zip', 'den', 'stag', 'king', 'dawn', null]);
    scope.dispose(); flags.reset(); flags.set('talked:ranger'); events.flush('update');
    expect(changes).toHaveLength(8);
  });
});
