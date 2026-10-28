import { expect, expectTypeOf, test } from 'vitest';
import { clientChannelLimits } from '../src/sdk/clientChannels';
import { CLIENT_CHANNEL_LIMITS, type ClientChannelProgram as NativeChannel } from '../src/format/clientChannels';
import type { ClientChannelProgram } from '../src/sdk/rows';
import type { parseNpcDialogueRow } from '../src/sdk/questGraph';
import type { NpcDialogueRow } from '../src/format/npcs';
import { channelQuestAuthorObservation } from './fixtures/channel-quest-author-observation';
import original from './fixtures/channel-quest-author-original.json' with { type: 'json' };

test('channel limits and public channel/dialogue types retain their exact native definitions', () => {
  expect(clientChannelLimits()).toBe(CLIENT_CHANNEL_LIMITS);
  expectTypeOf<ClientChannelProgram>().toEqualTypeOf<NativeChannel>();
  expectTypeOf<ReturnType<typeof parseNpcDialogueRow>>().toEqualTypeOf<NpcDialogueRow>();
});

test('every original focus, dialogue, interaction, catalogue and animation-program byte remains unchanged', () => {
  expect(channelQuestAuthorObservation()).toEqual(original);
});
