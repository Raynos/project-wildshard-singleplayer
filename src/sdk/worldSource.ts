import * as v from 'valibot';
import { isJsonData } from '@wildshard/game/shardfile/json';

const id = v.pipe(v.string(), v.maxLength(128), v.regex(/^[a-z][a-z0-9.-]*$/u));
const reserved = new Set(['__proto__', 'prototype', 'constructor']);
const name = v.pipe(v.string(), v.minLength(1), v.maxLength(128), v.check((value) => value.trim() === value && Array.from(value).every((character) => {
  const point = character.codePointAt(0) ?? 0;
  return point >= 32 && point !== 127;
}) && !reserved.has(value), 'bounded literal glTF name'));
const glb = v.pipe(v.string(), v.maxLength(512), v.check((value) => value.endsWith('.glb') && value.split('/').every((part) => /^[A-Za-z0-9_-][A-Za-z0-9_. -]*$/u.test(part) && part.trim() === part && !part.endsWith('.')), 'project-relative GLB path without traversal, URL or backslash'));
const colliders = v.union([v.literal('mesh'), v.pipe(v.string(), v.maxLength(134), v.check((value) => value.startsWith('nodes:') && v.safeParse(name, value.slice(6)).success, 'nodes:<nonempty literal node-name prefix>'))]);
const interactive = v.strictObject({ node: name, id, colliderId: id });

function plainWorldData(input: unknown): boolean {
  if (!isJsonData(input)) return false;
  if (typeof input !== 'object' || input === null) return true;
  // Record validators omit these keys; refuse them before parsing rather than losing an authored mapping.
  for (const key of ['materials', 'objects']) {
    const record: unknown = Reflect.get(input, key);
    if (typeof record === 'object' && record !== null && Object.keys(record).some((entry) => reserved.has(entry))) return false;
  }
  return true;
}

/** Build-only authored geometry input in metres and glTF Y-up axes; it is never a compiled shardfile section. */
export const WorldSourceSchema = v.pipe(v.unknown(), v.check(plainWorldData, 'world source is plain JSON with safe mapping keys'), v.strictObject({
  glb,
  materials: v.pipe(v.record(name, id), v.check((rows) => Object.keys(rows).length > 0 && Object.keys(rows).length <= 256, 'one to 256 explicit material mappings')),
  colliders,
  objects: v.optional(v.pipe(v.record(name, id), v.check((rows) => Object.keys(rows).length <= 1024, 'at most 1024 stable object names')), {}),
  interactive: v.optional(v.pipe(v.array(interactive), v.maxLength(64)), []),
}), v.check((source) => {
  const nodes = [...Object.keys(source.objects), ...source.interactive.map((row) => row.node)];
  const ids = [...Object.values(source.objects), ...source.interactive.map((row) => row.id)];
  return new Set(nodes).size === nodes.length && new Set(ids).size === ids.length && new Set(source.interactive.map((row) => row.colliderId)).size === source.interactive.length;
}, 'unique node names, stable object/panel IDs and interactive collider IDs'));

/** Normalized author-world declaration; objects and interactive default to empty collections. */
export type WorldSource = v.InferOutput<typeof WorldSourceSchema>;

/** Validate a build-only world declaration without opening files or executing getters or serializers. */
export function parseWorldSource(input: unknown): WorldSource { return v.parse(WorldSourceSchema, input); }
