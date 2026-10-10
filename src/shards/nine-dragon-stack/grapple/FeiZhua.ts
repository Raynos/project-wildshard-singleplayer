/**
 * Fei Zhua in the partial shard: LOCK a visible brass dragon ring, JUMP to fire, then zip through Rapier's player capsule.
 *
 * E286 (Jake: "I can't seem to use a grappling hook … no dedicated HUD button"; his pick: keep the baseline HUD, make LOCK
 * say so): every hook in reach (2.5–38 m, in sight, with a floor to land on) wears a small ◇ marker wherever it is on
 * screen; the one nearest the centre wears the "◇ DRAGON HOOK" chip and turns the touch LOCK disc into GRAPPLE (gold,
 * pulsing), a locked one makes it LOCKED and JUMP reads ZIP (the grapple input context). The aim, the line and the zip
 * view are the SDK's grapple view (@wildshard/sdk/tools/grappleAim) on data/grapple.ts's row; this file hands it the law
 * (grapple/sim.ts), the Well's course, the crossing's fact and the cues.
 *
 * E307: the hooks and the Well's rules are a course (course.ts). The fragment's is sim.ts's `wellCourse`; a playground
 * hands in its own while it is open (setGrappleCourse) and gets the same verbs, markers, rope and FX on its own hooks.
 */
import type { EquipContext } from '@wildshard/engine/combat/Equipment';
import { Tool } from '@wildshard/engine/combat/Tool';
import type { ShardContext } from '@wildshard/game/shard/context';
import { installGrappleAim } from '@wildshard/sdk/tools/grappleAim';
import { FEI_ZHUA_ROW } from './row';
import { GRAPPLE_CONTEXT } from './context';
import { ndRuntime } from '../runtime/state';
import { RIM } from '../world/wellBounds';
import type { GrappleCourse, GrapplePorts } from './course';
import { FIRE_TIME, GrappleSim, type GrappleTarget, hookVisible, landingFor, MAX_RANGE, MIN_RANGE, NONE, REEL_TIME, type Side, targetFor, WIN_X, WIN_Y, wellCourse } from './sim';
import { grappleCue } from '../runtime/audio/cues';
import { traverseFeats, type NineFacts } from '../world/feats';
import { FEI_ZHUA_AIM } from '../data/grapple';

export class FeiZhua extends Tool {
  readonly id = 'tool.fei-zhua' as const;
  readonly slot = 'offhand' as const;
  readonly actions = ['lock', 'jump'] as const;
  holster = 0;
  enabled = true;
  private readonly shard: ShardContext;
  private readonly course: GrappleCourse | undefined;
  private readonly fact: NineFacts;
  private courseSetter: ((course: GrappleCourse | null) => void) | undefined;
  /** `fact`: where the Well crossing's gameplay fact goes (world/feats.ts; the page's bound ledger) */
  constructor(shard: ShardContext, course?: GrappleCourse, fact: NineFacts = () => { /* no ledger */ }) { super(FEI_ZHUA_ROW); this.shard = shard; this.course = course; this.fact = fact; }
  override install(equip: EquipContext): void {
    super.install(equip);
    const host = this.shard.app.equipmentHost;
    if (host === null) throw new Error('Fei Zhua needs the equipment scene ports');
    // the fragment's own course (grapple/sim.ts wellCourse): its dragon hooks, read once at install, and the Well's safety cap
    const fragment = this.course ?? wellCourse(ndRuntime().world.ctx.hooks, RIM.z0, (open) => { ndRuntime().guardOpen = open; });
    // the law's ports: the page's physics and Player (read live, as the Tool always did)
    const ports: GrapplePorts = { get physics() { return host.physics; }, get body() { return host.player; } };
    const fact = this.fact;
    this.courseSetter = installGrappleAim<GrappleCourse, GrappleTarget, Side, GrappleSim>(host, this.shard, equip.scope, FEI_ZHUA_AIM, {
      fragment,
      law: (course, events) => new GrappleSim(ports, course, events),
      visible: (course, eye, hook) => hookVisible(ports, course, eye, hook),
      landing: (from, hook, out) => landingFor(ports, from, hook, out),
      none: NONE,
      target: (course, hook, landing, side) => targetFor(ports, course, hook, landing, side),
      traverse: (sim, dt) => traverseFeats(sim, dt, fact),
      cue: (cue) => { grappleCue(`grapple.${cue}`); },
      context: GRAPPLE_CONTEXT,
      reach: { min: MIN_RANGE, max: MAX_RANGE, winX: WIN_X, winY: WIN_Y },
      timing: { fire: FIRE_TIME, reel: REEL_TIME },
      enabled: () => this.enabled,
    });
  }
  setGrappleCourse(course: GrappleCourse | null): void { this.courseSetter?.(course); }
  override update(_dt: number, _t: number): void { /* Owned systems retain their original phases. */ }
}
