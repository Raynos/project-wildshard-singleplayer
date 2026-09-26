// Dome B (E169, round-10-dome-b): the square's TRELLIS props, merged from the organic lab (src/dev/nd-lab/organic/
// props3d.ts, round-9-lab-organic): local TRELLIS.2 image → 3D (codex ref "one object on white" → trellis_batch.py →
// driftwood_post.py → meshopt), loaded through glb.ts (smooth normals, AO), colour-RAMPED to the style bible's washes and
// drawn by the Jiehua program as ONE InstancedMesh per prop:
//  - the guardian lions (石獅): the lab's post-top lion on every third post of the Well's balustrade and both ends of
//    the street's, and a pair scaled up on the pedestals before the paifang's centre bay (gate.ts builds the pedestals);
//  - glazed pots (boxwood, a cloud-pruned pine, jade, azalea) by the shrine, the gate and the stall;
//  - two red lantern trios in the banyan (the red paper glows).
// Dome B kept its own noodle-stall counter and mahjong tables (richer than the TRELLIS ones at dome B's cameras; the
// TRELLIS sets also bring stools that would double under the seated players).
import { type BufferGeometry, Float32BufferAttribute, InstancedMesh, Matrix4, Quaternion, type ShaderMaterial, Vector3 } from 'three';
import { type GlbOpt, loadGlb } from './hero/glb';
import { K } from './kit';
import { BANYAN, GATE, PLAZA, STREET, WELL, Y0 } from '../layout';

const ASSETS = '/assets/nine-dragon/lab/organic';

/** the wet granite of the balustrade, dark to light (the lab's ramp) */
const STONE_RAMP = [0x2f2f33, 0x45454a, 0x5b5b60, 0x6e6e73, 0x808086, 0x94949a];
const WOOD_RAMP = [0x2a1d14, 0x3f2b1d, 0x563a26, 0x6e4a30, 0x86603f, 0xa07a55];
const STEEL_RAMP = [0x3a3d44, 0x585d66, 0x7a808a, 0x9aa1ab, 0xb8bec6, 0xd2d6dc];
const HUES = { skin: 0xb07a52, red: 0xa8321f, blue: 0x2f4f8e, green: 0x3f6a4a };

/** which balustrade posts carry a lion (balustrade() leaves their lotus finial off): every third on the plaza run, the two ends of the street run */
export function lionOnPost(run: 'plaza' | 'street', i: number, n: number): boolean {
  return run === 'plaza' ? i % 3 === 1 : i === 0 || i === n;
}

/** the gate's lion pedestals (gate.ts `lionPedestal`): the two spots before the centre posts, pedestal top height */
export const GATE_LIONS = {
  spots: [GATE.posts[1] - 0.2 * GATE.s, GATE.posts[2] + 0.2 * GATE.s] as const,
  z: GATE.z + 2.3 * GATE.s,
  top: 0.96 * 0.95,
  scale: 2.4,
} as const;

interface PropSpec { name: string; opt: GlbOpt; glowRed?: number; at: Matrix4[] }

const place = (x: number, y: number, z: number, yaw: number, s = 1): Matrix4 =>
  new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw), new Vector3(s, s, s));

/** the balustrade's post tops (square.ts `balustrade`: n = round(len / 2.3) bays), with the lion rule */
function lionPosts(run: 'plaza' | 'street', at: number, a0: number, a1: number): Vector3[] {
  const len = a0 - a1, n = Math.max(1, Math.round(len / 2.3)), step = len / n;
  const out: Vector3[] = [];
  for (let i = 0; i <= n; i++) if (lionOnPost(run, i, n)) out.push(new Vector3(at, Y0 + 1.12, a0 - i * step));
  return out;
}

function specs(): PropSpec[] {
  // the model faces glTF +z; on the Well's balustrade (x ≈ 0.2) a quarter turn faces the plaza, a little more the spawn
  const lions = [...lionPosts('plaza', PLAZA.x0 + 0.2, PLAZA.z1, PLAZA.z0), ...lionPosts('street', STREET.x0 + 0.2, PLAZA.z0 - 0.1, WELL.z0)]
    .map((p) => place(p.x, p.y, p.z, Math.PI / 2 + 0.35, 1));
  // the gate's pair, facing the square, turned a little in toward the passage
  // (the gate's pair is off since A2 round 1: style-A and the A2 targets have none, and the pedestals blocked A2's left /
  // right views; to bring them back push `place(x, Y0 + GATE_LIONS.top, GATE_LIONS.z, ±0.2, GATE_LIONS.scale)` per spot
  // and set square.ts `lions: true`)
  return [
    { name: 'lion', opt: { kind: K.stone, line: 0, ao: 0.85, ramp: STONE_RAMP, hues: {} }, at: lions },
    {
      name: 'pots', opt: { kind: 0, line: 0, ao: 0.7, ramp: STEEL_RAMP, hues: { green: HUES.green, blue: HUES.blue, red: 0xc0392b, skin: 0x8a6a4a } },
      at: [
        place(BANYAN.x - 4.5, Y0, BANYAN.z + 2.3, 0.3), // west of the earth-god shrine
        place(GATE.posts[3] + 1.4, Y0, GATE.z + 1.7, -0.5), // east of the gate (the stall-corner pot read as a cobalt blob in domeb-2's foreground: reverted)
      ],
    },
    {
      name: 'lanterns', opt: { kind: 0, line: 0, ao: 0.5, ramp: WOOD_RAMP, hues: { red: 0xc8401f, skin: 0xc9a24a } }, glowRed: 2.6,
      at: [place(BANYAN.x - 2.4, Y0 + 5.2, BANYAN.z + 2.0, 0.8, 1.1), place(BANYAN.x + 2.2, Y0 + 5.6, BANYAN.z + 1.4, -0.7, 1.1)],
    },
  ];
}

/** red vertices glow: emit (aMisc.x) on the red hue class, so the paper lanterns light up like the procedural ones */
function glowRed(g: BufferGeometry, emit: number): void {
  const col = g.getAttribute('color'), misc = g.getAttribute('aMisc');
  const out = new Float32Array(misc.count * 4);
  for (let i = 0; i < misc.count; i++) {
    const r = col.getX(i), gg = col.getY(i), b = col.getZ(i);
    const red = r > 0.25 && r > gg * 2.2 && r > b * 2.2;
    out[i * 4] = red ? emit : misc.getX(i);
    out[i * 4 + 1] = misc.getY(i);
    out[i * 4 + 2] = misc.getZ(i);
    out[i * 4 + 3] = misc.getW(i);
  }
  g.setAttribute('aMisc', new Float32BufferAttribute(out, 4));
}

/** load every prop (a missing GLB is skipped with a warning): one InstancedMesh each, drawn with the Jiehua `mat` */
export async function loadSquareProps(mat: ShaderMaterial): Promise<InstancedMesh[]> {
  const out: InstancedMesh[] = [];
  await Promise.all(specs().map(async (s) => {
    if (s.at.length === 0) return;
    try {
      const g = await loadGlb(`${ASSETS}/${s.name}.glb`, s.opt);
      if (s.glowRed !== undefined) glowRed(g, s.glowRed);
      const im = new InstancedMesh(g, mat, s.at.length);
      s.at.forEach((m, i) => { im.setMatrixAt(i, m); });
      im.computeBoundingSphere();
      out.push(im);
    } catch (e: unknown) { console.warn(`nine-dragon: prop ${s.name} failed to load`, e); }
  }));
  return out;
}
