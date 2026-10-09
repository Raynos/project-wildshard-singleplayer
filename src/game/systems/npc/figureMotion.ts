import * as THREE from 'three';
import type { NpcFigureFrame } from './figureRig';

interface Wave { offset: number; amplitude: number; frequency: number; clock: 'phase' | 'time'; cosine?: boolean }
export interface NpcFigureMotionProfile {
  orbit?: { x: number; z: number; radius: number; speed: number; stopDistance: number; lift: number; frequency: number };
  idleHead?: { distance: number; yaw: number; pitch: number };
  idleArm?: { distance: number; x: Wave; z?: Wave };
}
export interface NpcFigureState {
  feet: THREE.Vector3; headWorld: THREE.Vector3; talking: boolean; yaw: number; idleYaw: number;
  headYaw: number; headPitch: number; armX: number; armZ: number; glanceT: number; glance: number; phase: number; ring: number;
}
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (a: number, b: number, k: number, dt: number): number => a + (b - a) * (1 - Math.exp(-k * dt));
function wave(w: Wave, phase: number, time: number): number {
  const a = (w.clock === 'phase' ? phase : time) * w.frequency;
  return w.offset + (w.cosine === true ? Math.cos(a) : Math.sin(a)) * w.amplitude;
}

/** A root/head/arm figure's idle, focus, talking and authored secondary motion. */
export function stepNpcFigure(p: NpcFigureState, frame: NpcFigureFrame, profile: NpcFigureMotionProfile,
  dt: number, t: number, player: THREE.Vector3, floorAt: (x: number, z: number) => number): boolean {
  p.phase += dt;
  const dx = player.x - p.feet.x, dz = player.z - p.feet.z, d = Math.hypot(dx, dz), toYou = Math.atan2(dx, dz);
  let moved = false;
  const orbit = profile.orbit;
  if (orbit) {
    if (d >= orbit.stopDistance && !p.talking) {
      p.ring += dt * orbit.speed;
      const x = orbit.x + Math.cos(p.ring) * orbit.radius, z = orbit.z + Math.sin(p.ring) * orbit.radius;
      p.feet.set(x, floorAt(x, z) + Math.abs(Math.sin(p.phase * orbit.frequency)) * orbit.lift, z);
      p.idleYaw = Math.atan2(-Math.sin(p.ring), Math.cos(p.ring));
      moved = true;
    } else p.feet.y = damp(p.feet.y, floorAt(p.feet.x, p.feet.z), 10, dt);
  }
  const face = p.talking || d < 7 ? toYou : p.idleYaw;
  p.yaw += wrap(face - p.yaw) * (1 - Math.exp(-(p.talking ? 5 : 2.5) * dt));
  p.glanceT -= dt;
  if (p.glanceT < 0) { p.glanceT = 2.5 + ((p.phase * 7.3) % 3); p.glance = Math.sin(p.phase * 3.1) * 0.9; }
  let hy = p.glance * 0.6, hp = 0;
  if (d < 12 || p.talking) {
    hy = Math.max(-1.2, Math.min(1.2, wrap(toYou - p.yaw)));
    hp = -Math.atan2(player.y + 1.6 - (p.feet.y + frame.neck.y), Math.max(0.5, d)) * 0.6;
  }
  if (p.talking) hp += Math.sin(t * 5.2) * 0.06;
  if (profile.idleHead && !p.talking && d > profile.idleHead.distance) { hy = profile.idleHead.yaw; hp = profile.idleHead.pitch; }
  p.headYaw = damp(p.headYaw, hy, 4, dt); p.headPitch = damp(p.headPitch, hp, 4, dt);
  let ax = Math.sin(p.phase * 1.1) * 0.04, az = -0.05;
  if (p.talking) { ax = -0.55 - Math.max(0, Math.sin(t * 2.3)) * 0.45; az = -0.25 + Math.sin(t * 1.7) * 0.15; }
  else if (profile.idleArm && d > profile.idleArm.distance) {
    ax = wave(profile.idleArm.x, p.phase, t);
    if (profile.idleArm.z) az = wave(profile.idleArm.z, p.phase, t);
  }
  p.armX = damp(p.armX, ax, 6, dt); p.armZ = damp(p.armZ, az, 6, dt);
  return moved;
}

/** Matrices stay reusable; the caller chooses a skinned rig or procedural pieces. */
export function npcFigurePose(): (p: NpcFigureState, frame: NpcFigureFrame, write: (body: THREE.Matrix4, head: THREE.Matrix4, arm: THREE.Matrix4) => void, pivots?: Pick<NpcFigureFrame, 'neck' | 'shoulder'>) => void {
  const body = new THREE.Matrix4(), head = new THREE.Matrix4(), arm = new THREE.Matrix4();
  const q = new THREE.Quaternion(), hq = new THREE.Quaternion(), aq = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  return (p, frame, write, pivots = frame) => {
    body.compose(p.feet, q.setFromEuler(e.set(0, p.yaw, 0)), s.set(1, 1 + Math.sin(p.phase * 1.3) * 0.012, 1));
    hq.setFromEuler(e.set(p.headPitch, p.headYaw, 0, 'YXZ'));
    aq.setFromEuler(e.set(p.armX, 0, p.armZ));
    s.set(1, 1, 1);
    head.compose(pivots.neck, hq, s).premultiply(body);
    arm.compose(pivots.shoulder, aq, s).premultiply(body);
    write(body, head, arm);
    p.headWorld.copy(frame.neck).applyMatrix4(body); p.headWorld.y += 0.12;
  };
}
