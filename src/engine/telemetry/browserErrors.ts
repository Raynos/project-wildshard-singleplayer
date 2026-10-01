import { Scope } from '../app/scope';
/** Optional, error-only Sentry channel. The existing /api/errors report remains the primary local inbox. */
import type { captureException, getClient, init, withScope } from '@sentry/browser';

declare const __BUILD_ID__: string;

export interface BrowserErrorTags {
  readonly system: string;
  readonly build: string;
  readonly shard: string;
  readonly bootStage: string;
  readonly fatal: boolean;
  /** Small, explicit diagnostics supplied by the caller; never browser storage or request headers. */
  readonly diagnostic?: Record<string, unknown>;
}

// A DSN is a public browser endpoint, not an auth token. Local/dev builds stay quiet unless opted in.
const productionDsn = 'https://ccaf25bcd6baa389433fb9efe0117c9b@o4512161165410304.ingest.us.sentry.io/4512161184088064';
const dsn = String(import.meta.env['VITE_SENTRY_DSN'] ?? (import.meta.env.PROD ? productionDsn : '')).trim();
interface BrowserSdk { init: typeof init; withScope: typeof withScope; captureException: typeof captureException; getClient: typeof getClient }
let sdk: Promise<BrowserSdk | null> | null = null;

function loadSdk(): Promise<BrowserSdk | null> {
  sdk ??= import('@sentry/browser').then((sentry) => {
    sentry.init({
      dsn,
      release: __BUILD_ID__,
      // ErrorModal already owns window errors and rejections. Keep the SDK out of the boot's
      // hot path and do not install click/fetch breadcrumbs, tracing, profiling or replay.
      defaultIntegrations: false,
      integrations: [],
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      maxBreadcrumbs: 0,
      normalizeDepth: 6, // context -> checkpoint array -> checkpoint -> facts
      beforeSend(event) {
        if (event.request) event.request.url = `${location.origin}${location.pathname}`;
        return event;
      },
    });
    return sentry;
  }).catch(() => null);
  return sdk;
}

async function send(error: unknown, tags: BrowserErrorTags): Promise<void> {
  const sentry = await loadSdk();
  if (sentry === null) return;
  try {
    sentry.withScope((scope) => {
      scope.setTags({
        system: tags.system,
        build: tags.build,
        shard: tags.shard,
        boot_stage: tags.bootStage,
      });
      scope.setLevel(tags.fatal ? 'fatal' : 'error');
      if (tags.diagnostic) scope.setContext('boot_diagnostic', tags.diagnostic);
      sentry.captureException(asError(error));
    });
  } catch { /* telemetry must never disrupt the game or its existing error modal */ }
}

function asError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    const described = new Error(error.message);
    if ('stack' in error && typeof error.stack === 'string') described.stack = error.stack;
    return described;
  }
  return new Error(String(error));
}

/** Fire and forget: an absent DSN adds no request or SDK initialization to a player's boot. */
export function captureBrowserError(error: unknown, tags: BrowserErrorTags): void {
  if (!dsn) return;
  void send(error, tags);
}

/** Durable diagnostics require a transport acknowledgement, not just captureException's event ID. */
export async function deliverBrowserError(error: Error, tags: BrowserErrorTags): Promise<boolean> {
  if (!dsn) return true;
  const sentry = await loadSdk();
  const client = sentry?.getClient();
  if (!sentry || !client) { sdk = null; return false; }
  return new Promise((resolve) => {
    const delivery = new Scope('error.delivery');
    let eventId = '';
    let unsubscribe = (): void => undefined;
    delivery.timeout(5000, () => { delivery.dispose(); unsubscribe(); resolve(false); });
    const finish = (ok: boolean): void => { delivery.dispose(); unsubscribe(); resolve(ok); };
    unsubscribe = client.on('afterSendEvent', (event, response) => {
      if (event.event_id === eventId) finish(response.statusCode !== undefined && response.statusCode >= 200 && response.statusCode < 300);
    });
    try {
      sentry.withScope((scope) => {
        scope.setTags({ system: tags.system, build: tags.build, shard: tags.shard, boot_stage: tags.bootStage });
        scope.setLevel('error');
        if (tags.diagnostic) scope.setContext('boot_diagnostic', tags.diagnostic);
        eventId = sentry.captureException(error);
      });
    } catch { finish(false); }
  });
}
