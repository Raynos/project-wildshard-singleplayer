/**
 * The refused cell's look (SHARD-PLATFORM SF58 (12), G167 "B, falling back to A", `art/grid/round-18-refused-cell/board.jpg`).
 * A neighbour whose shard can't load keeps its closed soft wall (the wall still blocks entry; its panel names the reason)
 * and shows, per `refusedLook`:
 *
 * - **B, `frozen`**: its far view frozen grey (the far proxy's grey uniform) under a **static dome**: one translucent
 *   pale shell over the cell, a fresnel rim and a still stipple, no animation.
 * - **A, `void`** (no far view): the empty VR void inside the cell (the outer void's floor material over the cell square)
 *   and a **"SHARD UNAVAILABLE"** holo sign above it with the reason line and YOUR SAVE IS KEPT, turned toward the traveller.
 *
 * Nothing is built for a cell that loads: the per-step cost is one refusal read and one far-status read per neighbour, and
 * a change of look builds or disposes its few meshes once (the dome is one draw; the void floor and the sign two).
 */
import { BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, FrontSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, ShaderMaterial, SphereGeometry, type Object3D } from 'three';
import type { GridCell } from './assembly';
import type { LookScope } from './roadLayout';
import { refusalReason, refusedLook, type FarViewStatus, type RefusedLook, type ShardRefusal } from './refusal';
import { voidFloorMaterial } from './voidLook';
import { GAME_STRINGS } from '../strings';

/** A neighbour the look may dress: its cell, its shown name and its render root (at its origin in the home frame). */
export interface RefusedLookCell { readonly cell: GridCell; readonly name: string; readonly root: Object3D }
/** What the look reads each fixed step, and the far proxy's grey switch. */
export interface RefusedLookPorts {
  readonly refusal: (instance: string) => ShardRefusal | null;
  readonly far: (instance: string) => FarViewStatus;
  /** the traveller's feet in the home frame (the sign turns toward them) */
  readonly feet: () => { readonly x: number; readonly z: number };
  /** grey the cell's far proxy (B) or restore it */
  readonly grey: (instance: string, on: boolean) => void;
}
/** The readout: each dressed cell's look and reason. */
export interface RefusedLookState { readonly cells: readonly { readonly instance: string; readonly look: RefusedLook; readonly refusal: ShardRefusal }[] }

const DOME_SCALE = 1.18, DOME_HEIGHT = 0.42, SIGN_Y = 70, SIGN_W = 160, SIGN_H = 50;

const domeVertex = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const domeFragment = /* glsl */ `
uniform vec3 uColour;
varying vec3 vNormalW;
varying vec3 vWorld;
float hash(vec3 p) { return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 view = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - abs(dot(normalize(vNormalW), view)), 2.2);
  float stipple = hash(vWorld * 1.7) * 0.5 + hash(vWorld * 0.45) * 0.5; // still grain: no time uniform, the dome never moves
  float foot = 1.0 - smoothstep(0.0, 14.0, vWorld.y); // a brighter seam where the shell meets the ground
  float a = clamp(0.2 + rim * 0.45 + (stipple - 0.5) * 0.28 + foot * 0.2, 0.0, 0.8);
  gl_FragColor = vec4(uColour, a);
}`;

/** The dome: an upper hemisphere flattened to DOME_HEIGHT, over the cell centre (`half`: the cell's half size). */
function dome(half: number): Mesh {
  const geometry = new SphereGeometry(half * DOME_SCALE, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  geometry.scale(1, DOME_HEIGHT, 1);
  const material = new ShaderMaterial({ vertexShader: domeVertex, fragmentShader: domeFragment, transparent: true, depthWrite: false, side: FrontSide, fog: false,
    uniforms: { uColour: { value: new Color(0.86, 0.9, 0.95) } } });
  material.name = 'grid-refused-dome';
  const mesh = new Mesh(geometry, material);
  mesh.name = 'grid-refused-dome'; mesh.renderOrder = 1; mesh.castShadow = false; mesh.receiveShadow = false;
  return mesh;
}

/** The void inside the cell: one quad a hair over road level, the outer void's floor with this cell as its glowing rim. */
function voidFloor(cell: GridCell, home: GridCell, h: number): Mesh {
  const x = cell.origin.x - home.origin.x, z = cell.origin.z - home.origin.z, y = 0.05;
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([-h, y, -h, -h, y, h, h, y, h, h, y, -h]), 3)).setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, voidFloorMaterial(home, [x - h, x + h, z - h, z + h]));
  mesh.name = 'grid-refused-void'; mesh.castShadow = false; mesh.receiveShadow = false;
  return mesh;
}

/** The holo sign's face: SHARD UNAVAILABLE, the name · reason line, YOUR SAVE IS KEPT (all text, drawn once). */
function signTexture(lines: { readonly title: string; readonly line: string; readonly kept: string }): CanvasTexture {
  const el = document.createElement('canvas'); el.width = 1024; el.height = 320;
  const g = el.getContext('2d');
  if (g !== null) {
    g.fillStyle = 'rgba(6, 26, 40, 0.84)'; g.fillRect(0, 0, 1024, 320);
    g.strokeStyle = '#38e6ff'; g.lineWidth = 6; g.strokeRect(4, 4, 1016, 312);
    g.fillStyle = 'rgba(56, 230, 255, 0.9)'; for (const [cx, cy] of [[4, 4], [1020, 4], [4, 316], [1020, 316]] as const) g.fillRect(cx - 10, cy - 10, 20, 20);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const fit = (text: string, y: number, font: string, colour: string, spacing: number): void => {
      g.font = font; g.fillStyle = colour; g.letterSpacing = `${spacing}px`;
      const w = g.measureText(text).width; g.save(); g.translate(512, y); g.scale(Math.min(1, 940 / Math.max(1, w)), 1); g.fillText(text, 0, 0); g.restore();
    };
    fit(lines.title, 112, '600 84px "Helvetica Neue", Arial, sans-serif', '#e8fbff', 10);
    fit(lines.line, 204, '500 44px "Helvetica Neue", Arial, sans-serif', '#7fe9ff', 6);
    fit(lines.kept, 266, '500 34px "Helvetica Neue", Arial, sans-serif', 'rgba(200, 236, 248, 0.82)', 5);
  }
  const texture = new CanvasTexture(el); texture.colorSpace = SRGBColorSpace;
  return texture;
}

function sign(name: string, refusal: ShardRefusal): Mesh {
  const s = GAME_STRINGS.unavailable;
  const material = new MeshBasicMaterial({ map: signTexture({ title: s.sign, line: s.line(name, refusalReason(refusal)), kept: GAME_STRINGS.upgrade.saveKept }),
    transparent: true, depthWrite: false, toneMapped: false, fog: false, side: DoubleSide });
  const mesh = new Mesh(new PlaneGeometry(SIGN_W, SIGN_H), material);
  mesh.name = 'grid-refused-sign'; mesh.position.set(0, SIGN_Y, 0); mesh.renderOrder = 3;
  return mesh;
}

interface Dressed { look: RefusedLook; refusal: ShardRefusal; group: Group; sign: Mesh | null; dispose: () => void }

/** Dress refused neighbours; `step` runs each fixed step. Everything is disposed with the scope. */
export function installRefusedLook(input: { readonly cells: readonly RefusedLookCell[]; readonly home: GridCell; readonly half: number; readonly ports: RefusedLookPorts; readonly scope: LookScope }): { step: () => void; state: () => RefusedLookState } {
  const { cells, home, half, ports, scope } = input, dressed = new Map<string, Dressed>();
  const undress = (instance: string): void => {
    const was = dressed.get(instance); if (was === undefined) return;
    dressed.delete(instance); was.dispose(); if (was.look === 'frozen') ports.grey(instance, false);
  };
  const dress = (entry: RefusedLookCell, look: RefusedLook, refusal: ShardRefusal): void => {
    const group = new Group(); group.name = `grid-refused:${entry.cell.instance}`;
    const meshes: Mesh[] = [];
    let shown: Mesh | null = null;
    if (look === 'frozen') { meshes.push(dome(half)); ports.grey(entry.cell.instance, true); }
    else { meshes.push(voidFloor(entry.cell, home, half)); shown = sign(entry.name, refusal); meshes.push(shown); }
    for (const mesh of meshes) { mesh.matrixAutoUpdate = mesh === shown; mesh.updateMatrix(); group.add(mesh); }
    entry.root.add(group);
    dressed.set(entry.cell.instance, { look, refusal, group, sign: shown, dispose: () => {
      group.removeFromParent();
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        const material = mesh.material;
        if (material instanceof MeshBasicMaterial) material.map?.dispose();
        if (material instanceof MeshBasicMaterial || material instanceof ShaderMaterial) material.dispose();
      }
    } });
  };
  const step = (): void => {
    const feet = ports.feet();
    for (const entry of cells) {
      const id = entry.cell.instance, refusal = ports.refusal(id), look = refusedLook(refusal, ports.far(id)), was = dressed.get(id);
      if (refusal === null || look === null) { undress(id); continue; }
      if (was === undefined || was.look !== look || was.refusal !== refusal) { undress(id); dress(entry, look, refusal); }
      const shown = dressed.get(id)?.sign;
      // the sign turns about its vertical axis toward the traveller (the cell root holds no rotation)
      if (shown !== null && shown !== undefined) shown.rotation.y = Math.atan2(feet.x - entry.root.position.x, feet.z - entry.root.position.z);
    }
  };
  scope.onDispose(() => { for (const id of dressed.keys()) undress(id); });
  return { step, state: () => ({ cells: [...dressed].map(([instance, d]) => ({ instance, look: d.look, refusal: d.refusal })) }) };
}
