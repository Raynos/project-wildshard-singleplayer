import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Flags } from '../src/engine/world/interact/flags';
import { bindQuestPageInteractions } from '../src/game/plugin/ui';
import { PINE_LANTERN_PAGE } from '../src/shards/pine-hollow/generators/questPageInteractions';
import { PINE_LANTERN_ROWS } from '../src/shards/pine-hollow/generators/interactions';

test('lantern rows boot with entered story owners and commit light flags once', () => {
  const scope = new Scope('lantern-rows'), flags = new Flags('lantern-rows', false);
  flags.restore(['taken:pond-glass', 'taken:ridge-flint', 'talked:ranger']);
  const sounds: string[] = [], toasts: string[] = [];
  const points = { pond: new Vector3(), ridge: new Vector3(), den: new Vector3() };
  try {
    const page = bindQuestPageInteractions(PINE_LANTERN_PAGE, {
      flags, timer: scope, promptIds: ['pond', 'ridge', 'den'],
      interactions: { marks: [], rows: PINE_LANTERN_ROWS },
      toast: text => { toasts.push(text); },
      owners: new Map<string, unknown>([['points', points],
        ['sound', { shot: (id: string) => { sounds.push(id); } }], ['sfx', { interact: () => undefined }],
        ['floor', { setLantern: () => undefined }], ['shelf', { visible: false }]]),
    });
    for (const id of ['pond', 'ridge', 'den']) {
      expect(page.prompt(id).position).toBe(points[id as keyof typeof points]);
      expect(page.run(id)).toBe(true); expect(flags.has(`lit:${id}`)).toBe(true);
      expect(page.run(id)).toBe(false);
    }
    expect(sounds).toEqual(['lanternCreak', 'lanternCreak', 'lanternCreak']);
    expect(toasts).toHaveLength(3);
  } finally { scope.dispose(); }
});
