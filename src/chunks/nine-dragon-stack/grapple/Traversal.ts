/** Fei Zhua in the partial shard: LOCK a visible brass dragon ring, JUMP to fire, then zip through Rapier's player capsule. */
import {
  AdditiveBlending, Color, DoubleSide, Mesh, MeshBasicMaterial, RingGeometry, SphereGeometry, Vector2, Vector3,
} from 'three';
import type { ShardTraversalContext } from '../../ChunkDef';
import { castSegment, floorBelow, lineOfSight } from '../../../physics/query';
import { WELL, Y0 } from '../layout';
import { nineDragonWorld, setGrappleGuardOpen } from '../index';
import { RIM } from '../world/well-plan';
import { Filament, Rope } from './line';
import { Flash, Sparks } from './fx';

const MAX_RANGE = 38;
const ZIP_SPEED = 22;
const FIRE_TIME = 0.27;
const BITE_TIME = 0.10;
const REEL_TIME = 0.48;

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
  // Lab P9's fixed-step rope and screen-width ribbon replace the straight world-space cylinders.
  const rope = new Rope(24);
  const line = new Filament(rope.n);
  line.mesh.name = 'fei-zhua:filament';
  const claw = new Mesh(new SphereGeometry(0.14, 8, 6), new MeshBasicMaterial({ color: 0xd7a546 }));
  claw.name = 'fei-zhua:flying-claw';
  line.mesh.visible = claw.visible = false;
  ctx.game.scene.add(line.mesh, claw);
  const res = new Vector2();
  return {
    reset(start: Vector3): void { rope.reset(start, start); },
    step(dt: number, start: Vector3, end: Vector3, slack: number): void {
      rope.slack = slack;
      // Two fixed substeps keep the line responsive without the lab's 240 Hz capture cost.
      for (let i = 0; i < 2; i++) rope.step(dt / 2, start, end);
    },
    draw(end: Vector3, flying: boolean, pulse: number, time: number): void {
      if (!rope.active) return;
      line.u.uRes.value.copy(ctx.game.renderer.getDrawingBufferSize(res));
      line.u.uPulse.value = pulse;
      line.u.uTime.value = time;
      line.u.uI.value = 1.1;
      line.update(rope);
      line.mesh.visible = true;
      claw.visible = flying; claw.position.copy(end);
    },
    hide(): void { rope.off(); line.mesh.visible = claw.visible = false; },
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

  type Phase = 'idle' | 'fire' | 'bite' | 'lift' | 'zip' | 'vault' | 'settle' | 'miss' | 'reel' | 'dock';
  let target: Target | null = null;
  let armedMiss = false;
  let phase: Phase = 'idle';
  let clock = 0, blocked = 0, liftY = 0, time = 0;
  let muzzleAge = Infinity, biteAge = Infinity, dockAge = Infinity;
  const end = new Vector3(), want = new Vector3(), before = new Vector3();
  const muzzle = new Vector3(), tip = new Vector3(), ndc = new Vector3(), missEnd = new Vector3();
  const screen = new Vector2();
  const muzzleFlash = new Flash(new Color(0xa8f5ff));
  const biteFlash = new Flash(new Color(0xffc76a));
  const dockFlash = new Flash(new Color(0xffd891));
  const sparks = new Sparks(24);
  muzzleFlash.mesh.name = 'fei-zhua:muzzle-flash';
  biteFlash.mesh.name = 'fei-zhua:bite-flash';
  dockFlash.mesh.name = 'fei-zhua:dock-flash';
  sparks.mesh.name = 'fei-zhua:bite-sparks';
  const lockHalo = new Mesh(new RingGeometry(0.18, 0.25, 24), new MeshBasicMaterial({
    color: 0xffcc62, transparent: true, opacity: 0.72, depthWrite: false, side: DoubleSide, blending: AdditiveBlending,
  }));
  lockHalo.name = 'fei-zhua:lock-halo';
  lockHalo.visible = false;
  ctx.game.scene.add(lockHalo);
  ctx.game.scene.add(muzzleFlash.mesh, biteFlash.mesh, dockFlash.mesh, sparks.mesh);
  const tipAt = (): void => {
    muzzle.set(-0.2, -0.23, -0.55).applyQuaternion(ctx.game.camera.quaternion).add(ctx.game.camera.position);
    const goal = target?.hook ?? missEnd;
    if (phase === 'fire') tip.copy(muzzle).lerp(goal, Math.min(1, clock / FIRE_TIME) ** 0.8);
    else if (phase === 'reel') {
      const u = Math.min(1, clock / REEL_TIME);
      const ease = u * u * (3 - 2 * u);
      tip.copy(missEnd).lerp(muzzle, ease);
      tip.y -= Math.sin(Math.PI * u) * 1.2;
    } else if (phase === 'dock') tip.copy(muzzle);
    else tip.copy(goal);
  };
  const release = (): void => {
    phase = 'idle'; target = null; armedMiss = false; clock = blocked = 0;
    tracer.hide(); marker.style.display = 'none';
    lockHalo.visible = muzzleFlash.mesh.visible = biteFlash.mesh.visible = dockFlash.mesh.visible = sparks.mesh.visible = false;
    setGrappleGuardOpen(false);
    ctx.arms?.playLeft?.('idle'); ctx.arms?.setClawVisible?.(true);
  };

  const priorToggle = ctx.lock.onTryToggle;
  ctx.lock.onTryToggle = () => {
    if (!ctx.enabled()) return priorToggle?.() ?? false;
    // Once a crossing starts the safety guard must stay open until a safe landing or bailout.
    if (phase !== 'idle' && phase !== 'miss' && phase !== 'reel' && phase !== 'dock') return true;
    if (target !== null || armedMiss) { release(); return true; }
    const pick = nearest(ctx, hooks);
    if (pick === null) {
      if (priorToggle?.() === true) return true;
      armedMiss = true;
      ctx.arms?.playLeft?.('grapple_aim');
      ctx.toast('FEI ZHUA READY · JUMP TO FIRE');
      return true;
    }
    ctx.lock.unlock();
    target = pick;
    ctx.arms?.playLeft?.('grapple_aim');
    ctx.toast('DRAGON HOOK LOCKED · JUMP TO ZIP');
    return true;
  };

  const priorJump = ctx.player.onJumpRequest;
  ctx.player.onJumpRequest = () => {
    if (priorJump?.() === true) return true;
    if (!ctx.enabled() || (target === null && !armedMiss)) return false;
    if (phase !== 'idle') return true;
    phase = 'fire'; clock = 0; muzzleAge = 0;
    tipAt();
    if (target === null) {
      ctx.game.camera.getWorldDirection(want);
      missEnd.copy(ctx.game.camera.position).addScaledVector(want, 19);
      missEnd.y -= 1.2;
    } else if (target.crossesWell) { setGrappleGuardOpen(true); liftY = ctx.player.position.y + 3.5; }
    tracer.reset(muzzle);
    ctx.arms?.playLeft?.('grapple_fire');
    ctx.arms?.setClawVisible?.(false);
    return true;
  };

  const priorStep = ctx.player.traversalStep;
  ctx.player.traversalStep = (dt) => {
    if (priorStep?.(dt) === true) return true;
    if (!ctx.enabled() || phase === 'idle') return false;
    clock += dt;
    const p = ctx.player;
    if (phase === 'fire') {
      p.velocity.set(0, 0, 0);
      if (clock >= FIRE_TIME) {
        clock = 0;
        if (target === null) { phase = 'miss'; ctx.toast('FEI ZHUA MISSED · REELING'); }
        else { phase = 'bite'; biteAge = 0; ctx.arms?.playLeft?.('grapple_hold'); }
      }
      return true;
    }
    if (phase === 'miss') { if (clock >= 0.16) { phase = 'reel'; clock = 0; } return false; }
    if (phase === 'reel') { if (clock >= REEL_TIME) { phase = 'dock'; clock = 0; dockAge = 0; } return false; }
    if (phase === 'dock') { if (clock >= 0.12) release(); return false; }
    if (target === null) { release(); return false; }
    if (phase === 'bite') {
      p.velocity.set(0, 0, 0);
      if (clock >= BITE_TIME) { phase = target.crossesWell ? 'lift' : 'zip'; clock = 0; p.onGround = false; }
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
    if (phase === 'vault') {
      // A short motor-driven pop clears the hook's lip; Rapier still owns collision.
      before.copy(p.position);
      p.motor.move(p.position, want.set(0, 0.7 * dt, 0), true);
      p.velocity.subVectors(p.position, before).divideScalar(dt);
      if (clock >= 0.14) { phase = 'settle'; clock = 0; }
      return true;
    }
    if (phase === 'settle') {
      p.velocity.set(0, -0.5, 0);
      if (clock >= 0.10) { release(); return false; }
      return true;
    }
    end.copy(target.landing);
    want.subVectors(end, p.position);
    const remaining = want.length();
    if (remaining < 0.25) { phase = 'vault'; clock = 0; p.velocity.set(0, 0, 0); return true; }
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

  ctx.game.onFixed('post', (dt) => {
    if (phase === 'idle') return;
    time += dt;
    muzzleAge += dt; biteAge += dt; dockAge += dt;
    tipAt();
    const slack = phase === 'fire' ? 1.14 : phase === 'reel' ? 1.20 : 1.005;
    tracer.step(dt, muzzle, tip, slack);
  }, 'fei-zhua.rope');

  ctx.game.onUpdate(() => {
    if (!ctx.enabled()) { if (target !== null || armedMiss || phase !== 'idle') release(); return; }
    const candidate = target ?? nearest(ctx, hooks);
    if (candidate === null) marker.style.display = 'none';
    else {
      ndc.copy(candidate.hook).project(ctx.game.camera);
      marker.style.display = ndc.z < -1 || ndc.z > 1 ? 'none' : 'block';
      marker.style.left = `${(ndc.x + 1) * innerWidth / 2}px`;
      marker.style.top = `${(1 - ndc.y) * innerHeight / 2}px`;
      marker.style.borderColor = target === null ? '#8fe3ff' : '#d7a546';
      marker.style.color = target === null ? '#8fe3ff' : '#ffcf70';
      marker.textContent = target === null ? '◇ DRAGON HOOK' : '◆ LOCKED · JUMP';
    }
    lockHalo.visible = target !== null;
    if (target !== null) {
      lockHalo.position.copy(target.hook);
      lockHalo.lookAt(ctx.game.camera.position);
      const flare = biteAge < 0.22 ? 0.5 * (1 - biteAge / 0.22) : 0;
      lockHalo.scale.setScalar(1 + Math.sin(time * 10) * 0.08 + flare);
    }
    if (phase === 'idle') return;
    tipAt();
    tracer.draw(tip, phase === 'fire' || phase === 'miss' || phase === 'reel', biteAge < 0.4 ? 1 - biteAge / 0.4 : -1, time);
    ctx.game.renderer.getDrawingBufferSize(screen);
    sparks.u.uRes.value.copy(screen);
    muzzleFlash.mesh.position.copy(muzzle);
    muzzleFlash.set(muzzleAge / 0.13, 0.34, 0);
    biteFlash.mesh.position.copy(target?.hook ?? missEnd);
    biteFlash.set(biteAge / 0.24, 0.75, time * 5);
    dockFlash.mesh.position.copy(muzzle);
    dockFlash.set(dockAge / 0.12, 0.2, 0);
    sparks.update(biteAge, target?.hook ?? missEnd, want.set(0, 1, 0), 0.55);
  }, 'fei-zhua');
}
