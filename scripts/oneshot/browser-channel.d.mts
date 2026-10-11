import type { Socket } from 'node:net';

/** Open an owned POSIX FIFO without creating any network endpoint. */
export function browserPipe(path: string, create?: boolean): Socket;
/** Send a bounded atomic request and await an event-driven reply. */
export function browserRequest(channel: string, message: object, timeoutMs?: number): Promise<unknown>;
/** Write only to the requesting seat’s verified reply FIFO. */
export function browserReply(reply: string, response: object): Promise<void>;
