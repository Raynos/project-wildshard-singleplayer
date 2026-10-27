import { Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import spots from '../data/spotsRows.json' with { type: 'json' };
import { buildZiplineGeometry } from './lookout';
import { ZiplineCable } from './ziplineCable';

interface End { readonly x: number; readonly y: number; readonly z: number }
/** the zipline's rows as the runtime and the draw labels read them: each GLB's hash-named URL, then both layouts */
export interface ZiplineRows {
  readonly world: string; readonly trolley: string; readonly specimen: string; readonly parked: string;
  readonly layout: typeof spots.zipline; readonly specimenLayout: { readonly top: End; readonly bottom: End };
}
/** The zipline (GR7: the `driftwood-zipline` job's rows, blobs and hash-named public copies): its rows, its four GLBs by
 *  product name and their public URLs as aliases of those names. */
export interface DriftwoodZiplineBank {
  readonly rows: ZiplineRows;
  readonly blobs: ReadonlyMap<string, Uint8Array>;
  readonly byUrl: Readonly<Record<string, string>>;
}

let bank: DriftwoodZiplineBank | undefined;
/** Built once per build process from the authored spot rows; every reader treats it as read-only. */
export function driftwoodZiplineBank(): DriftwoodZiplineBank { bank ??= buildZiplineBank(); return bank; }

function buildZiplineBank(): DriftwoodZiplineBank {
  const layout = spots.zipline, specimenLayout = { top: { x: 0, y: 0, z: 0 }, bottom: { x: 13, y: -5, z: 3 } };
  const cable = (row: { top: End; bottom: End; sag?: number }): ZiplineCable => new ZiplineCable({ top: new Vector3(row.top.x, row.top.y, row.top.z),
    bottom: new Vector3(row.bottom.x, row.bottom.y, row.bottom.z), sag: row.sag ?? 1.6 });
  const world = buildZiplineGeometry(cable(layout)), specimenCable = cable(specimenLayout), specimen = buildZiplineGeometry(specimenCable);
  const at = new Vector3(), yaw = specimenCable.park(at);
  specimen.trolley.applyMatrix4(new Matrix4().compose(at, new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw), new Vector3(1, 1, 1)));
  const material = new MeshStandardMaterial({ vertexColors: true }), files: Record<string, string> = {};
  const blobs = new Map<string, Uint8Array>(), byUrl: Record<string, string> = {};
  try {
    for (const [name, geometry] of Object.entries({ world: world.rig, trolley: world.trolley, specimen: specimen.rig, parked: specimen.trolley })) {
      const customAttributes = Object.fromEntries(Object.keys(geometry.attributes).filter(key => !['position', 'normal', 'color', 'uv'].includes(key)).map(key => [`_${key.toUpperCase()}`, key]));
      const bytes = staticGlb([{ geometry, material, customAttributes }], `zipline-${name}`);
      const url = `/assets/driftwood-isle/baked/zipline-${hashImmutableBytes(bytes)}.glb`, file = `models/zipline/${name}.glb`;
      blobs.set(file, bytes); byUrl[url] = file; files[name] = url;
      geometry.dispose();
    }
  } finally { material.dispose(); }
  const { world: w = '', trolley = '', specimen: s = '', parked = '' } = files;
  return { rows: { world: w, trolley, specimen: s, parked, layout, specimenLayout }, blobs, byUrl };
}
