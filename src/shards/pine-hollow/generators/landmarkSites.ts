/** C1 author-only landmark sites; the page retains native models, interaction and collider registration. */
import { LOOKOUT, BEAVER_DAM, CREEK, BEAR_CAVE, STANDING_STONES, KINGS_CLEARING, HAMLET_SITES, POND, SPURS } from '../data/layout';
import { ZIP_YAW } from './timberPlacement';
import { PineSeedStream } from './seedStream';

interface LandmarkPose { x: number; y: number; z: number; yaw: number; scale: number; pitch: number; roll: number }
interface LandmarkSites {
  contractBoardSite: { x: number; z: number; yaw: number };
  waystoneSites: Record<'pond' | 'ridge' | 'den', { x: number; z: number; yaw: number }>;
  stones: { kind: string; places: LandmarkPose[] }[];
  waystones: LandmarkPose[]; dam: LandmarkPose[]; canoe: LandmarkPose[]; board: LandmarkPose[];
  arch: LandmarkPose; archGround: number;
}

export function pineLandmarkSites(heightAt: (x: number, z: number) => number): LandmarkSites {
  const faceYaw = (x: number, z: number, tx: number, tz: number): number => Math.atan2(tx - x, tz - z);
  const lodge = HAMLET_SITES.lodge, yaw = lodge.rot, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const contractBoardSite = { x: lodge.x + fx * 7.5 + rx * 4.2, z: lodge.z + fz * 7.5 + rz * 4.2, yaw: yaw + Math.PI };
  const pondPoint = (SPURS['pond'] ?? [])[2] ?? [-60, 98], px = pondPoint[0] - 3.2, pz = pondPoint[1] + 5.5;
  const c = Math.cos(ZIP_YAW), s = Math.sin(ZIP_YAW), ridgeX = LOOKOUT.x + 6 * c + 1.6 * s, ridgeZ = LOOKOUT.z - 6 * s + 1.6 * c;
  const caveFx = -Math.sin(BEAR_CAVE.rot), caveFz = -Math.cos(BEAR_CAVE.rot), denX = BEAR_CAVE.x + caveFx * 4.5 + caveFz * 3.4, denZ = BEAR_CAVE.z + caveFz * 4.5 - caveFx * 3.4;
  const trail = (SPURS['lookout'] ?? [])[3] ?? [76, 196];
  const waystoneSites = { pond: { x: px, z: pz, yaw: faceYaw(px, pz, pondPoint[0], pondPoint[1]) },
    ridge: { x: ridgeX, z: ridgeZ, yaw: faceYaw(ridgeX, ridgeZ, trail[0], trail[1]) },
    den: { x: denX, z: denZ, yaw: faceYaw(denX, denZ, denX + caveFx, denZ + caveFz) } };
  const pose = (x: number, y: number, z: number, turn: number, scale = 1, pitch = 0, roll = 0): LandmarkPose => ({ x, y, z, yaw: turn, scale, pitch, roll });
  const rng = new PineSeedStream(1337 + 907), kinds = ['stone-a', 'stone-c', 'stone-b'] as const;
  const stones = new Map<string, ReturnType<typeof pose>[]>();
  for (const [i, [x, z]] of STANDING_STONES.entries()) {
    const kind = kinds[i % 3] ?? 'stone-a', list = stones.get(kind) ?? [];
    list.push(pose(x, heightAt(x, z) - 0.5, z, faceYaw(x, z, KINGS_CLEARING.x, KINGS_CLEARING.z) + rng.range(-0.25, 0.25), rng.range(1.35, 1.6), rng.range(-0.06, 0.06), rng.range(-0.07, 0.07)));
    stones.set(kind, list);
  }
  const waystones = Object.values(waystoneSites).map(site => pose(site.x, heightAt(site.x, site.z), site.z, site.yaw));
  const d0 = CREEK[BEAVER_DAM.at - 1], d1 = CREEK[BEAVER_DAM.at + 1], flow = d0 && d1 ? Math.atan2(d1[0] - d0[0], d1[1] - d0[1]) : 0;
  const dam = [pose(BEAVER_DAM.x, heightAt(BEAVER_DAM.x, BEAVER_DAM.z) - 0.45, BEAVER_DAM.z, flow)];
  const cx = -67.8, cz = 119, bow = Math.max(heightAt(cx - 2.3, cz), POND.level), stern = Math.max(heightAt(cx + 2.3, cz), POND.level);
  const canoe = [pose(cx, (bow + stern) / 2 - 0.05, cz, -Math.PI / 2, 1, Math.atan2(stern - bow, 4.6) * 0.85)];
  const board = [pose(contractBoardSite.x, heightAt(contractBoardSite.x, contractBoardSite.z) - 0.1, contractBoardSite.z, contractBoardSite.yaw)];
  const archGround = heightAt(BEAR_CAVE.x, BEAR_CAVE.z), arch = pose(BEAR_CAVE.x - caveFx * 1.2, archGround - 0.45, BEAR_CAVE.z - caveFz * 1.2, BEAR_CAVE.rot + Math.PI, 1.4);
  return { contractBoardSite, waystoneSites, stones: [...stones].map(([kind, places]) => ({ kind, places })), waystones, dam, canoe, board, arch, archGround };
}
