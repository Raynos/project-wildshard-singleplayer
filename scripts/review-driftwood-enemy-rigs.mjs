#!/usr/bin/env node
/** Actual authored geometry + skeleton + numeric poses, CPU-skinned for an independent visual review.
 * Run: node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/review-driftwood-enemy-rigs.mjs
 * This is deliberately not a Model Explorer capture or a claim of gameplay/runtime acceptance.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Bone, Vector3, Matrix4, Color } from 'three';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms.ts';
import { buildBrinePuffer, buildConchDuelist, buildSplinterMantis } from '../src/shards/driftwood-isle/generators/driftwoodRegularBodies.ts';
import { BRINE_PUFFER_CLIPS, CONCH_DUELIST_CLIPS, SPLINTER_MANTIS_CLIPS } from '../src/shards/driftwood-isle/generators/driftwoodRegularClips.ts';
import { buildBellback, buildTideRootColossus } from '../src/shards/driftwood-isle/generators/tidalGiantsBodies.ts';
import { BELLBACK_CLIPS, TIDE_ROOT_COLOSSUS_CLIPS } from '../src/shards/driftwood-isle/generators/tidalGiantsClips.ts';

const output = resolve(process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? 'tmp/driftwood-rig-review');
const W = 1080, H = 1900, TOP = 145, ROW = 332, PANEL = 330;
const rows = [
  { name: 'Brine Puffer', build: buildBrinePuffer, clips: BRINE_PUFFER_CLIPS,
    stages: [{ name: 'Rest · front', mem: { 'puffer-st': 0 }, yaw: .15 }, { name: 'Inflated tell · 0.85 s', mem: { 'puffer-st': 1, 'puffer-clock': .85 }, yaw: .55 }, { name: 'Deflated punish · 1.4 s', mem: { 'puffer-st': 1, 'puffer-clock': 1.4 }, yaw: -.6 }] },
  { name: 'Conch Duelist', build: buildConchDuelist, clips: CONCH_DUELIST_CLIPS,
    stages: [{ name: 'Rest · front', mem: { 'conch-st': 0 }, yaw: .15 }, { name: 'Shell brace · 0.5 s', mem: { 'conch-st': 1, 'conch-clock': .5 }, yaw: -.55 }, { name: 'Counter thrust · 0.52 s', mem: { 'conch-st': 3, 'conch-clock': .52 }, yaw: .70 }] },
  { name: 'Splinter Mantis', build: buildSplinterMantis, clips: SPLINTER_MANTIS_CLIPS,
    stages: [{ name: 'Rest · front', mem: { 'mantis-st': 0, 'mantis-beat': 1 }, yaw: .15 }, { name: 'First crouch · 0.65 s', mem: { 'mantis-st': 1, 'mantis-clock': .65, 'mantis-beat': 1 }, yaw: .55 }, { name: 'Second lunge · 0.7 s', mem: { 'mantis-st': 3, 'mantis-clock': .7, 'mantis-beat': 2 }, yaw: -.65 }] },
  { name: 'Bellback · elite', build: buildBellback, clips: BELLBACK_CLIPS,
    stages: [{ name: 'Rest · front', mem: { 'tg-state': 0 }, yaw: .15 }, { name: 'Raised-clapper tell · 1.05 s', mem: { 'tg-state': 1, 'tg-clock': 1.05 }, yaw: .55 }, { name: 'Outer echo · 0.9 s', mem: { 'tg-state': 2, 'tg-clock': .9 }, yaw: -.65 }] },
  { name: 'Tide-Root Colossus · boss', build: buildTideRootColossus, clips: TIDE_ROOT_COLOSSUS_CLIPS,
    stages: [{ name: 'Rest · front', mem: { 'tg-state': 0 }, yaw: .15 }, { name: 'Left-root windup · 0.7 s', mem: { 'tg-state': 1, 'tg-clock': .7 }, yaw: .55 }, { name: 'Overhead slam · 1.2 s', mem: { 'tg-state': 3, 'tg-clock': 1.2, 'tg-exposed': 0 }, yaw: -.65 }] },
];
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
  '<rect width="1080" height="1900" fill="#111d29"/>',
  '<text x="42" y="53" font-family="sans-serif" font-size="30" font-weight="bold" fill="#f7ead5">DRIFTWOOD · FIVE AUTHORED RIGS</text>',
  '<text x="42" y="89" font-family="sans-serif" font-size="20" fill="#becbd4">SVG software projection · actual geometry, skin weights and numeric poses</text>',
  '<text x="42" y="119" font-family="sans-serif" font-size="18" fill="#e6bb76">Not a runtime capture. No gameplay, mobile-performance or acceptance claim.</text>'];

function posedTriangles(row, stage) {
  const body = row.build(), bones = body.bones.map(() => new Bone());
  const names = new Map(body.bones.map((def, i) => [def.name, i]));
  for (let i = 0; i < body.bones.length; i++) {
    const def = body.bones[i], bone = bones[i];bone.name = def.name;bone.position.set(...def.pos);
    if (def.parent !== null) {
      const parentIndex = names.get(def.parent);if (parentIndex === undefined) throw new Error('Missing parent');
      bone.position.sub(new Vector3(...body.bones[parentIndex].pos));bones[parentIndex].add(bone);
    }
  }
  const roots = bones.filter(bone => bone.parent === null);for (const root of roots) root.updateMatrixWorld(true);
  const inverses = bones.map(bone => bone.matrixWorld.clone().invert());
  const mem = { ...stage.mem }, position = new Vector3();
  const context = { bones: Object.fromEntries(bones.map(bone => [bone.name, bone])), dims: body.dims, dt: 1 / 60, t: 1, seed: .7,
    scale: 1, speed: 0, strafe: 0, phase: .2, state: 'attack', alive: true, deathT: -1, flinch: 0, brace: 0, attack: -1,
    lookTarget: new Vector3(0, 0, 2), lookWeight: 1, position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } };
  numericCreaturePose(row.clips)(context);for (const root of roots) root.updateMatrixWorld(true);
  const transforms = bones.map((bone, i) => new Matrix4().multiplyMatrices(bone.matrixWorld, inverses[i]));
  const light = new Vector3(-.5, 1, .7).normalize(), pitch = .23, yaw = stage.yaw;
  const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const up = new Vector3(-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw) * Math.sin(pitch));
  const view = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const triangles = [];
  for (const geometry of [...body.furParts, ...body.hardParts, ...body.eyeParts]) {
    const pos = geometry.getAttribute('position'), indices = geometry.getAttribute('skinIndex'), weights = geometry.getAttribute('skinWeight'), colors = geometry.getAttribute('color');
    const vertices = [];
    for (let i = 0; i < pos.count; i++) {
      const source = new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)), vertex = new Vector3();
      for (let j = 0; j < 4; j++) { const weight = weights.getComponent(i, j);if (weight === 0) continue;
        const matrix = transforms[indices.getComponent(i, j)];if (matrix === undefined) throw new Error('Unbound skin joint');
        vertex.addScaledVector(source.clone().applyMatrix4(matrix), weight);
      }
      vertices.push(vertex);
    }
    const count = geometry.index?.count ?? pos.count;
    for (let i = 0; i < count; i += 3) {
      const ids = [0, 1, 2].map(j => geometry.index?.getX(i + j) ?? i + j), points = ids.map(j => vertices[j]);
      const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
      if (normal.dot(view) <= 0) continue;
      const tint = new Color().setRGB(colors.getX(ids[0]), colors.getY(ids[0]), colors.getZ(ids[0]));
      tint.multiplyScalar(.64 + .36 * Math.max(0, normal.dot(light)));
      triangles.push({ points: points.map(point => [point.dot(right), point.dot(up)]), depth: points.reduce((n, point) => n + point.dot(view), 0) / 3, color: `#${tint.getHexString()}` });
    }
    geometry.dispose();
  }
  return triangles.sort((a, b) => a.depth - b.depth);
}
for (let ri = 0; ri < rows.length; ri++) {
  const row = rows[ri], y = TOP + ri * ROW;
  svg.push(`<rect x="28" y="${y}" width="1024" height="${ROW - 12}" rx="14" fill="${ri % 2 ? '#1c2e3c' : '#182734'}"/>`,
    `<text x="46" y="${y + 30}" font-family="sans-serif" font-size="22" font-weight="bold" fill="#f2d9aa">${escape(row.name)}</text>`);
  const rendered = row.stages.map(stage => posedTriangles(row, stage));
  const boxes = rendered.map(triangles => { const points = triangles.flatMap(triangle => triangle.points);return { minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])), minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])) }; });
  const scale = Math.min(...boxes.map(box => Math.min((PANEL - 35) / (box.maxX - box.minX), 220 / (box.maxY - box.minY))));
  for (let ci = 0; ci < row.stages.length; ci++) {
    const cx = 45 + PANEL * ci + PANEL / 2, cy = y + 267, box = boxes[ci];
    const shiftX = (box.minX + box.maxX) / 2;
    svg.push(`<ellipse cx="${cx}" cy="${cy + 2}" rx="${PANEL * .31}" ry="10" fill="#0b1520"/>`);
    for (const triangle of rendered[ci]) {
      const points = triangle.points.map(p => `${(cx + (p[0] - shiftX) * scale).toFixed(2)},${(cy - (p[1] - box.minY) * scale).toFixed(2)}`).join(' ');
      svg.push(`<polygon points="${points}" fill="${triangle.color}"/>`);
    }
    svg.push(`<text x="${cx}" y="${y + 300}" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#c8d6dd">${escape(row.stages[ci].name)}</text>`);
  }
}
svg.push('<text x="42" y="1850" font-family="sans-serif" font-size="17" fill="#9eb2c0">Same scale within each row. Cameras vary to inspect the actual three-dimensional silhouette.</text>',
  '<text x="42" y="1878" font-family="sans-serif" font-size="16" fill="#9eb2c0">Approximate CPU shading. Runtime materials, gameplay and disposal require separate proof.</text>', '</svg>');
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'rig-contact-sheet.svg'), svg.join('\n'));
writeFileSync(resolve(output, 'rig-contact-sheet.json'), JSON.stringify({ kind: 'authored-rig-source-review', runtimeCapture: false, width: W, height: H,
  rows: rows.map(row => ({ name: row.name, poses: row.stages.map(stage => ({ label: stage.name, memory: stage.mem, cameraYaw: stage.yaw })) })) }, null, 2));
console.info(`Wrote source-only rig contact sheet to ${output}`);
