/** Optional, error-only Sentry channel. The existing /api/errors report remains the primary local inbox. */
import type { captureException, init, withScope } from '@sentry/browser';

declare const __BUILD_ID__: string;

export interface BrowserErrorTags {
  readonly system: string;
  readonly build: string;
  readonly shard: string;
  readonly bootStage: string;
  readonly fatal: boolean;
}

// A DSN is a public browser endpoint, not an auth token. Local/dev builds stay quiet unless opted in.
const productionDsn = 'https://ccaf25bcd6baa389433fb9efe0117c9b@o4512161165410304.ingest.us.sentry.io/4512161184088064';
const dsn = String(import.meta.env['VITE_SENTRY_DSN'] ?? (import.meta.env.PROD ? productionDsn : '')).trim();
interface BrowserSdk { init: typeof init; withScope: typeof withScope; captureException: typeof captureException }
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
