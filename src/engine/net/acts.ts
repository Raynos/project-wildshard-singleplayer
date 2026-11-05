import * as v from 'valibot';
import { NetActSchema, type NetAct } from '@wildshard/format/netCommand';

// P1-E5.2c (§4.2): the acts the engine adds to the format's own. Chat is the engine's concern, so it never reaches the shard format.

/** Where a line of chat goes (J110): everyone in the room, which is J110's shard channel, or who stands near. No global channel. */
export const CHAT_CHANNELS = ['room', 'proximity'] as const;
export type ChatChannel = (typeof CHAT_CHANNELS)[number];
/** Say something. Plain text, cleaned and filtered on the server. */
export interface NetChatSay { readonly kind: 'chat'; readonly seq: number; readonly channel: ChatChannel; readonly text: string }
/** Report a line of chat by its id. */
export interface NetChatReport { readonly kind: 'report'; readonly seq: number; readonly line: number }
/** An act the sim takes on its tick. */
export type NetTickAct = NetAct;
/** Any act a client may send. */
export type NetRoomAct = NetTickAct | NetChatSay | NetChatReport;

const u16 = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffff));
/** A decoded act fit for the room. */
export const NetRoomActSchema: v.GenericSchema<NetRoomAct> = v.union([NetActSchema,
  v.strictObject({ kind: v.literal('chat'), seq: u16, channel: v.picklist(CHAT_CHANNELS), text: v.pipe(v.string(), v.minLength(1), v.maxLength(255)) }),
  v.strictObject({ kind: v.literal('report'), seq: u16, line: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffffff)) }),
]);
