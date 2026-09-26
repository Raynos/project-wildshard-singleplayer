/** Fei Zhua in the partial shard: LOCK a visible brass dragon ring, JUMP to fire, then zip through Rapier's player capsule. */
import {
  CylinderGeometry, Mesh, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3,
} from 'three';
import type { ShardTraversalContext } from '../../ChunkDef';
import { castSegment, floorBelow, lineOfSight } from '../../../physics/query';
import { WELL, Y0 } from '../layout';
import { nineDragonWorld, setGrappleGuardOpen } from '../index';
import { RIM } from '../world/well-plan';

const MAX_RANGE = 38;
const ZIP_SPEED = 22;
const FIRE_TIME = 0.27;
const _up = new Vector3(0, 1, 0);

interface Target { hook: Vector3; landing: Vector3; crossesWell: boolean }

/** A hook beyond the Well rail is visible to the claw if the rail is the only obstruction. */
function hookVisible(ctx: ShardTraversalContext, hook: Vector3): boolean {
  const eye = ctx.game.camera.position;
  if (lineOfSight(ctx.physics, eye, hook, 1.1, ctx.player.motor.collider)) return true;
  const hit = castSegment(ctx.physics, eye, hook, ['WORLD'], ctx.player.motor.collider);
  if (hit === null || Math.abs(hit.point.z - RIM.z0) > 0.45 || hit.point.x < WELL.x0 || hit.point.x > WELL.x1) return false;
  const id: unknown = typeof hit.owner === 'object' && hit.owner !== null ? Reflect.get(hit.owner, 'id') : null;
  if (id !== 'nds-floors' && id !== 'nds-grapple-guard') return false;
  const past = new Vector3(hit.point.x, hit.point.y, hit.point.z).add(hook.clone().sub(eye).normalize().multiplyScalar(1.1));
  return lineOfSight(ctx.physics, past, hook, 1.1, ctx.player.motor.collider);
}

/** The actual floor near a ring, approached from the player's side. No floor means no safe zip target. */
function landingFor(ctx: ShardTraversalContext, hook: Vector3): Vector3 | null {
  const toward = ctx.player.position.clone().sub(hook).setY(0);
  if (toward.lengthSq() < 0.01) return null;
  toward.normalize();
  const side = new Vector3(-toward.z, 0, toward.x);
  const fromY = hook.y + 2;
  for (const back of [1.2, 2, 2.8, 4, 6]) {
    for (const sideStep of [0, -2, 2, -4, 4]) {
      const p = hook.clone().addScaledVector(toward, back).addScaledVector(side, sideStep);
      const floor = floorBelow(ctx.physics, p.x, p.z, fromY, 12, ctx.player.motor.collider);
      if (floor !== undefined && floor >= hook.y - 9 && floor <= hook.y + 1.8) return new Vector3(p.x, floor + 0.12, p.z);
    }
  }
  return null;
}

function nearest(ctx: ShardTraversalContext, hooks: readonly Vector3[]): Target | null {
  const camera = ctx.game.camera;
  camera.updateMatrixWorld(true);
  const eye = camera.position;
  let chosen: Target | null = null, score = Infinity;
  for (const hook of hooks) {
    const d = eye.distanceTo(hook);
    if (d < 2.5 || d > MAX_RANGE) continue;
    const p = hook.clone().project(camera);
    if (p.z < -1 || p.z > 1 || Math.abs(p.x) > 0.52 || Math.abs(p.y) > 0.68) continue;
    if (!hookVisible(ctx, hook)) continue;
    const landing = landingFor(ctx, hook);
    if (landing === null) continue;
    const s = p.x * p.x + p.y * p.y * 0.55 + d * 0.0008;
    if (s < score) {
      chosen = { hook, landing, crossesWell: ctx.player.position.z > RIM.z0 && landing.z < RIM.z0 && ctx.player.position.x >= WELL.x0 && ctx.player.position.x <= WELL.x1 && ctx.player.position.y >= Y0 - 1 };
      score = s;
    }
  }
  return chosen;
}

function makeTracer(ctx: ShardTraversalContext) {
  const halo = new Mesh(new CylinderGeometry(0.035, 0.035, 1, 6), new MeshBasicMaterial({ color: 0x46d8ff, transparent: true, opacity: 0.25, depthWrite: false }));
  const core = new Mesh(new CylinderGeometry(0.009, 0.009, 1, 6), new MeshBasicMaterial({ color: 0xc6f8ff, depthWrite: false }));
  const claw = new Mesh(new SphereGeometry(0.14, 8, 6), new MeshBasicMaterial({ color: 0xd7a546 }));
  halo.visible = core.visible = claw.visible = false;
  ctx.game.scene.add(halo, core, claw);
  const q = new Quaternion(), mid = new Vector3(), delta = new Vector3();
  return {
    draw(start: Vector3, end: Vector3, flying: boolean): void {
      delta.subVectors(end, start);
      const len = delta.length();
      if (len < 0.01) return;
      q.setFromUnitVectors(_up, delta.clone().divideScalar(len));
      mid.copy(start).add(end).multiplyScalar(0.5);
      for (const mesh of [halo, core]) { mesh.visible = true; mesh.position.copy(mid); mesh.quaternion.copy(q); mesh.scale.set(1, len, 1); }
      claw.visible = flying; claw.position.copy(end);
    },
    hide(): void { halo.visible = core.visible = claw.visible = false; },
  };
}

export function installFeiZhua(ctx: ShardTraversalContext): void {
  const hooks = nineDragonWorld()?.ctx.hooks ?? [];
  const tracer = makeTracer(ctx);
  const marker = document.createElement('div');
  marker.className = 'ws-dragon-hook';
  marker.textContent = '◇ DRAGON HOOK';
  Object.assign(marker.style, {
    position: 'fixed', zIndex: '25', display: 'none', pointerEvents: 'none',
    padding: '6px 9px', border: '1px solid #d7a546', background: '#0d1b26dd', color: '#ffcf70',
    font: '700 10px monospace', letterSpacing: '1.5px', whiteSpace: 'nowrap',
    transform: 'translate(-50%, -50%)',
  });
  document.getElementById('hud')?.append(marker);

  let target: Target | null = null;
  let phase: 'idle' | 'fire' | 'lift' | 'zip' = 'idle';
  let clock = 0, blocked = 0, liftY = 0;
  const end = new Vector3(), want = new Vector3(), before = new Vector3();
  const release = (): void => {
    phase = 'idle'; target = null; clock = blocked = 0;
    tracer.hide(); marker.style.display = 'none';
    setGrappleGuardOpen(false);
    ctx.arms?.playLeft?.('idle'); ctx.arms?.setClawVisible?.(true);
  };

  const priorToggle = ctx.lock.onTryToggle;
  ctx.lock.onTryToggle = () => {
    if (!ctx.enabled()) return priorToggle?.() ?? false;
    if (target !== null) { release(); return true; }
    const pick = nearest(ctx, hooks);
    if (pick === null) return priorToggle?.() ?? false;
    ctx.lock.unlock();
    target = pick;
    ctx.arms?.playLeft?.('grapple_aim');
    ctx.toast('DRAGON HOOK LOCKED · JUMP TO ZIP');
    return true;
  };

  const priorJump = ctx.player.onJumpRequest;
  ctx.player.onJumpRequest = () => {
    if (priorJump?.() === true) return true;
    if (!ctx.enabled() || target === null) return false;
    if (phase !== 'idle') return true;
    phase = 'fire'; clock = 0;
    if (target.crossesWell) { setGrappleGuardOpen(true); liftY = ctx.player.position.y + 3.5; }
    ctx.arms?.playLeft?.('grapple_fire');
    ctx.arms?.setClawVisible?.(false);
    return true;
  };

  const priorStep = ctx.player.traversalStep;
  ctx.player.traversalStep = (dt) => {
    if (priorStep?.(dt) === true) return true;
    if (!ctx.enabled() || phase === 'idle' || target === null) return false;
    clock += dt;
    const p = ctx.player;
    if (phase === 'fire') {
      p.velocity.set(0, 0, 0);
      if (clock >= FIRE_TIME) { phase = target.crossesWell ? 'lift' : 'zip'; clock = 0; p.onGround = false; ctx.arms?.playLeft?.('grapple_hold'); }
      return true;
    }
    if (phase === 'lift') {
      const rise = Math.min(18 * dt, Math.max(0, liftY - p.position.y));
      before.copy(p.position);
      p.motor.move(p.position, want.set(0, rise, 0), true);
      p.velocity.subVectors(p.position, before).divideScalar(dt);
      p.onGround = false;
      if (p.position.y >= liftY - 0.2) { phase = 'zip'; clock = 0; }
      else if (clock > 0.5) { release(); }
      return true;
    }
    end.copy(target.landing);
    want.subVectors(end, p.position);
    const remaining = want.length();
    if (remaining < 0.25) { p.velocity.set(0, -0.5, 0); release(); return false; }
    want.multiplyScalar(Math.min(ZIP_SPEED * dt, remaining) / remaining);
    before.copy(p.position);
    p.motor.move(p.position, want, true);
    const moved = p.position.distanceTo(before);
    p.velocity.subVectors(p.position, before).divideScalar(dt);
    p.onGround = false;
    blocked = moved < want.length() * 0.15 ? blocked + dt : 0;
    if (blocked > 0.22 || clock > 2.5) { p.velocity.set(0, -0.5, 0); release(); }
    return true;
  };

  const muzzle = new Vector3(), tip = new Vector3(), ndc = new Vector3();
  ctx.game.onUpdate(() => {
    if (!ctx.enabled()) { if (target !== null) release(); return; }
    const candidate = target ?? nearest(ctx, hooks);
    if (candidate === null) { marker.style.display = 'none'; return; }
    ndc.copy(candidate.hook).project(ctx.game.camera);
    marker.style.display = ndc.z < -1 || ndc.z > 1 ? 'none' : 'block';
    marker.style.left = `${(ndc.x + 1) * innerWidth / 2}px`;
    marker.style.top = `${(1 - ndc.y) * innerHeight / 2}px`;
    marker.style.borderColor = target === null ? '#8fe3ff' : '#d7a546';
    marker.style.color = target === null ? '#8fe3ff' : '#ffcf70';
    if (phase === 'idle' || target === null) { tracer.hide(); return; }
    muzzle.set(-0.2, -0.23, -0.55).applyQuaternion(ctx.game.camera.quaternion).add(ctx.game.camera.position);
    tip.copy(target.hook);
    if (phase === 'fire') tip.lerp(muzzle, Math.max(0, 1 - clock / FIRE_TIME));
    tracer.draw(muzzle, tip, phase === 'fire');
  }, 'fei-zhua');
}
