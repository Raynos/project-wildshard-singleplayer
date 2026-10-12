import { Euler, Quaternion, Vector3 } from 'three';
import type { BoxColliderData } from '@wildshard/sdk/physics';
import { SPANS, FALLEN_BRIDGE, UPDRAFT, ROPE_SAG, type Span } from '../data/layout';
import { STRINGS } from '../data/strings';
import { risingIsletRows } from './risingIslets';

/** Native bridge rest transport; hover gates and winch motion remain runtime-owned. */
export interface SkyBridgePhysicsPlacement {
  id: string; name: string; category: 'buildings'; file: string;
  colliders: BoxColliderData[]; active: boolean; mode?: 'board'; surface: 'wood';
}

// Retained authored sag law, including the level rim ends and clamped sine dip.
function ropeSag(length: number, s: number): number {
  const run = length - 2 * ROPE_SAG.ends; if (run <= 0) return 0;
  const t = Math.min(1, Math.max(0, (s - ROPE_SAG.ends) / run));
  return Math.min(ROPE_SAG.max, ROPE_SAG.depth * length) * Math.sin(Math.PI * t);
}

/** A span's run: its horizontal heading (yaw, the bridge's local −Z) and its slope (pitch, raising the far end). */
const spanLength = (span: Span): number => Math.hypot(span.x1 - span.x0, span.y1 - span.y, span.z1 - span.z0);
const spanYaw = (span: Span): number => Math.atan2(-(span.x1 - span.x0), -(span.z1 - span.z0));
const spanPitch = (span: Span): number => Math.atan2(span.y1 - span.y, Math.hypot(span.x1 - span.x0, span.z1 - span.z0));
/** A box in the span's own frame (local −Z down the span from its start, +Y the deck's up): centre, half sizes. */
function spanBox(span: Span, centre: [number, number, number], half: [number, number, number], surface: 'wood'): BoxColliderData {
  const q = new Quaternion().setFromEuler(new Euler(spanPitch(span), spanYaw(span), 0, 'YXZ'));
  const c = new Vector3(...centre).applyQuaternion(q).add(new Vector3(span.x0, span.y, span.z0));
  return { kind: 'box', x: c.x, y: c.y, z: c.z, hx: half[0], hy: half[1], hz: half[2], rot: { x: q.x, y: q.y, z: q.z, w: q.w }, surface };
}
/** The deck under a span (loop 5: any heading, sloped between two decks), its top on the deck line. */
export function deckCollider(span: Span): BoxColliderData {
  const len = spanLength(span);
  return spanBox(span, [0, -0.15, -len / 2], [span.width / 2, 0.15, len / 2], 'wood');
}
/**
 * A rope span's deck and rails along its sag (layout ropeSag), as ~2 m chords, each its own short sloped span, overlapping
 * a little so the joins have no seam (a chord sits at most a few mm above the curve).
 */
export function saggedColliders(span: Span): BoxColliderData[] {
  const len = spanLength(span), n = Math.max(1, Math.ceil(len / 2)), out: BoxColliderData[] = [];
  const at = (s: number): { x: number; y: number; z: number } => {
    const f = s / len; return { x: span.x0 + (span.x1 - span.x0) * f, y: span.y + (span.y1 - span.y) * f - ropeSag(len, s), z: span.z0 + (span.z1 - span.z0) * f };
  };
  for (let i = 0; i < n; i++) {
    const a = at(Math.max(0, (i / n) * len - 0.05)), b = at(Math.min(len, ((i + 1) / n) * len + 0.05));
    const chord: Span = { ...span, x0: a.x, z0: a.z, y: a.y, x1: b.x, z1: b.z, y1: b.y };
    out.push(deckCollider(chord), ...railColliders(chord));
  }
  return out;
}
/** Rope rails along both long sides of a span. */
export function railColliders(span: Span): BoxColliderData[] {
  const len = spanLength(span);
  return [-1, 1].map((side) => spanBox(span, [side * span.width / 2, 0.55, -len / 2], [0.06, 0.55, len / 2], 'wood'));
}

function piece(id: string, name: string, colliders: BoxColliderData[], active: boolean, mode?: 'board'): SkyBridgePhysicsPlacement {
  return { id, name, category: 'buildings', file: 'src/shards/far-reach/world/build.ts', colliders, active,
    ...(mode === undefined ? {} : { mode }), surface: 'wood' };
}

/** Compile seven rope spans, two hover decks, the updraft and the winch bridge from authored rows.
 * No world, geometry, material or recorded collider output is read; live mode gates remain unchanged.
 */
export function skyBridgePhysicsPlacements(): SkyBridgePhysicsPlacement[] {
  const spans = [...SPANS, ...risingIsletRows().entries.map(entry => entry.bridge)].map(span => {
    const hover = span.kind === 'hover';
    return piece(span.id, hover ? STRINGS.hover : STRINGS.rope, hover ? [deckCollider(span)] : saggedColliders(span), !hover, hover ? 'board' : undefined);
  });
  return [...spans, piece('far.updraft', STRINGS.updraft, [deckCollider(UPDRAFT)], false, 'board'),
    piece(FALLEN_BRIDGE.id, STRINGS.fallen, [deckCollider(FALLEN_BRIDGE), ...railColliders(FALLEN_BRIDGE)], false)];
}
