import type { IncomingMessage, ServerResponse } from 'node:http';
/** Own at most one bounded native PNG body for each declared variant. */
export function pngReceiver(targets: ReadonlyMap<string,string|null>, maximum?: number): {
  readonly handle: (request: IncomingMessage, response: ServerResponse) => boolean;
  readonly dispose: () => void;
};
