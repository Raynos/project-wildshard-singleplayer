import { boxDesc } from '@wildshard/sdk/bake/placement';
import { Vector3 } from 'three';
import { apothem } from './layoutMath';
import { RISING_ISLETS } from './risingIslets';
import { ISLET, ISLET_ISLE, type RisingIslet } from './rows/isletDesign';

/** Where the chains meet the islet and the gate isle (the horizontal climb direction `h`, its perpendicular `p`). */
export const ISLET_POST = { h: 2.8, side: 3.2, inset: 0.7 } as const;
type P = [number, number, number];
const xyz = (v: Vector3): P => [v.x, v.y, v.z];
export function isletRigAnchors(entry: RisingIslet): { tops: P[]; local: P[] } {
  const h = new Vector3(entry.dock.x - entry.rest.x, 0, entry.dock.z - entry.rest.z).normalize(), p = new Vector3(-h.z, 0, h.x);
  const rim = new Vector3(entry.dock.x, entry.gate.y, entry.dock.z).addScaledVector(h, apothem(ISLET_ISLE) + ISLET.gap + ISLET_POST.inset);
  const tops = [-1, 1].map((k) => rim.clone().addScaledVector(p, k * ISLET_POST.side).setY(entry.gate.y + ISLET_POST.h - 0.3));
  // the islet's four rings: a near and a far pair, one each side; each side's pair meets that side's post
  const local = [-1, 1].flatMap((k) => [-1, 1].map((f) => new Vector3().addScaledVector(p, k * (ISLET_POST.side + 0.2)).addScaledVector(h, f * 2.4).setY(0.15)));
  return { tops: tops.map(xyz), local: local.map(xyz) };
}

/**
 * Playtest round 3 (#8): the resting islet's rail. Driving straight in from the road crossed the lip and the resting islet
 * and went off its far rim into the cloud sea ("FELL TOO FAR") before the RIDE prompt could matter. Around every rim edge but
 * the two that face the lip (the way on and off), a timber rail stands just outside the resting islet's rim, so a walker or a
 * hover rider stops on the deck, inside the RIDE prompt.
 */
const RAIL = { thick: 0.22, height: 1 } as const;
const OUTWARD_OF: Readonly<Record<RisingIslet['edge'], readonly [number, number]>> = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] };
/** An entry's rail: per closed rim edge (the 12-gon's edge normal `a`, radians from +x toward +z), one box. */
export function railBoxes(entry: RisingIslet): { a: number; box: ReturnType<typeof boxDesc> }[] {
  const [ox, oz] = OUTWARD_OF[entry.edge], lip = Math.atan2(oz, ox), inner = apothem(ISLET_ISLE) + ISLET.gap, mid = inner + RAIL.thick / 2;
  const half = (inner + RAIL.thick) * Math.tan(Math.PI / 12), out: { a: number; box: ReturnType<typeof boxDesc> }[] = [];
  for (let k = 0; k < 12; k++) {
    const a = Math.PI / 12 + (k * Math.PI) / 6;
    if (Math.abs(Math.atan2(Math.sin(a - lip), Math.cos(a - lip))) < Math.PI / 6) continue; // faces the lip: open
    out.push({ a, box: boxDesc({ x: entry.rest.x + Math.cos(a) * mid, z: entry.rest.z + Math.sin(a) * mid, hw: RAIL.thick / 2, hd: half, rot: a, yBottom: 0, yTop: RAIL.height }, 'wood') });
  }
  return out;
}

export interface IsletRigRows { rigs: { tops: P[]; local: P[] }[]; rails: { a: number; box: ReturnType<typeof boxDesc> }[][] }

/** Fresh original chain anchors and rails, shared by the native bake and authored view readers. */
export function skyIsletRigRows(): IsletRigRows {
  return { rigs: RISING_ISLETS.map(isletRigAnchors), rails: RISING_ISLETS.map(railBoxes) };
}
