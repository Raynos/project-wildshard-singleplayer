// MT3: the operator protocol shared with engine's actorMarkers.json.
export const AGENT_HEADER = 'x-wildshard-agent';
const AGENT_QUERY = 'agent';
const AGENT_UA_TOKEN = 'WildshardAgent/1';

const LANE = /^[a-z0-9][a-z0-9._-]{0,63}$/iu;
const name = () => {
  const lane = process.env.WS_LANE_NAME;
  return lane !== undefined && LANE.test(lane) ? lane : '1';
};

/** Keep the device or engine UA before appending the agent marker.
 * @param {string} base */
export function agentUserAgent(base) {
  if (base.split(/\s+/u).includes(AGENT_UA_TOKEN)) return base;
  const lane = name();
  const marker = lane === '1' ? AGENT_UA_TOKEN : `${AGENT_UA_TOKEN} (${lane})`;
  return `${base.trim()} ${marker}`.trim();
}

/** @returns {Readonly<Record<string, string>>} */
export function agentHeaders() {
  return { [AGENT_HEADER]: name() };
}

/** Open a marked URL in a driver that has no UA or header port.
 * @param {string} address */
export function agentUrl(address) {
  const url = new URL(address);
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) return address;
  if (url.searchParams.get(AGENT_QUERY)) return address;
  url.searchParams.set(AGENT_QUERY, name());
  return url.href;
}

/** Only Wildshard's services and the harness' own loopback rigs receive agent headers.
 * @param {string|URL} input */
function gameAddress(input) {
  try {
    const url = new URL(input);
    const host = url.hostname;
    if (host === 'wildshard.io' || host.endsWith('.wildshard.io') || host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      return url;
    }
  } catch { /* The original transport validates the input. */ }
  return null;
}

/** @param {HeadersInit | undefined} source */
function markedHeaders(source) {
  const headers = new Headers(source);
  for (const [key, value] of Object.entries(agentHeaders())) headers.set(key, value);
  headers.set('user-agent', agentUserAgent(headers.get('user-agent') ?? 'node'));
  return headers;
}

/** @param {typeof fetch} read @returns {typeof fetch} */
export function markedFetch(read) {
  return (input, options) => {
    const request = input instanceof Request ? input : null;
    const address = input instanceof Request ? input.url : input;
    if (gameAddress(address) === null) return read(input, options);
    return read(input, { ...options, headers: markedHeaders(options?.headers ?? request?.headers) });
  };
}

/** @param {typeof WebSocket} Socket @returns {typeof WebSocket} */
export function markedSocket(Socket) {
  return new Proxy(Socket, {
    construct(target, args, into) {
      const [address, protocols] = args;
      const url = typeof address === 'string' || address instanceof URL ? gameAddress(address) : null;
      if (url === null) return Reflect.construct(target, args, into);
      const options = typeof protocols === 'object' && protocols !== null && !Array.isArray(protocols)
        ? protocols : { protocols };
      return Reflect.construct(target, [agentUrl(url.href), { ...options, headers: markedHeaders(options.headers) }], into);
    },
  });
}

/** An operator probe reads through the current transport without changing it.
 * @type {typeof fetch} */
export const agentFetch = (input, options) => markedFetch(globalThis.fetch)(input, options);
