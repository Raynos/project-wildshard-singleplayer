import { cleanCrossroads } from './_crossroads.js';
import type { TelemetryRecord } from './telemetry.js';

interface Event { name: string; data: Record<string, string | number> }

/** Shared production/preview payload bound and pure telemetry validation. */
export const MAX_TELEMETRY_BYTES = 16_384;
const DAY = 86_400_000;
const outcomes = new Set(['clean', 'crash', 'context-loss', 'likely-oom']);
const names = new Set(['death.cause', 'quest.step', 'weapon.used', 'shard.time', 'level.time', 'boss.attempt', 'download.parts']);
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 64): string => typeof value === 'string' ? value.slice(0, max) : '';
const number = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
/** A count: a finite nonnegative integer (capped), else null (never a silent 0) */
const count = (value: unknown): number | null => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? Math.min(100_000, value) : null;
export function cleanTelemetryRecord(body: unknown, now = new Date()): TelemetryRecord | null {
  if (!object(body) || !['session', 'analytics', 'crossroads'].includes(text(body['kind']))) return null;
  const base = { build: text(body['build']), install: text(body['install']), receivedAt: now.toISOString() };
  if (!base.build || !base.install) return null;
  if (body['kind'] === 'crossroads') {
    const rig = cleanCrossroads(body['rig'] ?? body);
    return rig ? { ...base, kind: 'crossroads', rig } : null;
  }
  if (body['kind'] === 'session') {
    const heartbeat = body['heartbeat'];
    if (!object(heartbeat) || !outcomes.has(text(body['end'])) || !text(heartbeat['session'])) return null;
    return { ...base, kind: 'session', session: text(heartbeat['session']), end: text(body['end']),
      shard: text(heartbeat['level'] ?? heartbeat['shard']), stage: text(heartbeat['stage']), fps: Math.min(1000, number(heartbeat['fps'])) };
  }
  if (!Array.isArray(body['events']) || body['events'].length > 50) return null;
  const events: Event[] = [];
  for (const event of body['events']) {
    if (!object(event) || !names.has(text(event['name'])) || !object(event['data'])) return null;
    const name = event['name'] === 'level.time' ? 'shard.time' : text(event['name']), source = event['data'], data: Record<string, string | number> = { shard: text(source['level'] ?? source['shard']) };
    if (name === 'death.cause') data['cause'] = text(source['cause']);
    if (name === 'quest.step') { data['quest'] = text(source['quest']); data['step'] = text(source['step']); }
    if (name === 'weapon.used') data['weapon'] = text(source['weapon']);
    if (name === 'shard.time') data['seconds'] = Math.min(DAY / 1000, number(source['seconds']));
    // DL20: a packed level download's parts, failed parts and loose fallback files. A missing or malformed count is an
    // 'unknown' boot, never a 0 (sp-x1's offline control: {parts: 7, failed: 1} read as fallback 0, and a record with no
    // counts as a clean boot); the outcome and the loose fetches made are kept when well-formed
    if (name === 'download.parts') {
      const counts = ['parts', 'failed', 'fallback'] as const;
      if (counts.every(key => count(source[key]) !== null)) for (const key of counts) data[key] = count(source[key]) ?? 0;
      else data['counts'] = 'unknown';
      const fetched = count(source['fetched']); if (fetched !== null) data['fetched'] = fetched;
      if (['complete', 'failed', 'cancelled'].includes(text(source['outcome']))) data['outcome'] = text(source['outcome']);
      // packs-off zeros and a packed cached boot's zeros differ (sp-x1)
      if (['on', 'off'].includes(text(source['packs']))) data['packs'] = text(source['packs']);
    }
    if (name === 'boss.attempt') {
      if (!['started', 'won', 'died', 'left'].includes(text(source['outcome']))) return null;
      data['boss'] = text(source['boss']); data['outcome'] = text(source['outcome']);
    }
    events.push({ name, data });
  }
  return { ...base, kind: 'analytics', events };
}
