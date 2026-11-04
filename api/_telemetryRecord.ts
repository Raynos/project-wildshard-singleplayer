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
    // DL20: a packed level download's parts, failed parts and loose fallback files
    if (name === 'download.parts') for (const key of ['parts', 'failed', 'fallback']) data[key] = Math.min(100_000, number(source[key]));
    if (name === 'boss.attempt') {
      if (!['started', 'won', 'died', 'left'].includes(text(source['outcome']))) return null;
      data['boss'] = text(source['boss']); data['outcome'] = text(source['outcome']);
    }
    events.push({ name, data });
  }
  return { ...base, kind: 'analytics', events };
}
