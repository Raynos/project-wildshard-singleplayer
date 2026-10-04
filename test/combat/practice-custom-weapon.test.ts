// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { Group, Vector3 } from 'three';
import { Scope } from '#engine-internal/app/scope';
import { Events } from '#engine-internal/events/events';
import { CombatPipeline, type Actor, type DamageDealt } from '#engine-internal/combat/pipeline';
import { Weapon, type WeaponState } from '#engine-internal/combat/Weapon';
import { TrainingTarget } from '#engine-internal/practice/TrainingArena';
import { practiceActor } from '#engine-internal/practice/targets';
import { melee } from '#engine-internal/combat/blocks/melee';

/** No kit weapon, creature list or dummy-specific branch: selection and damage use the public ports. */
class CustomWeapon extends Weapon {
  override readonly model = new Group();
  override readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  override enabled = true; override holster = 0; override adsHeld = false; override aimInfo = null;
  private readonly contact: ReturnType<typeof melee>;
  constructor(private readonly combat: CombatPipeline) {
    super({ id: 'weapon.test-custom', legacySlot: 'sword',
      ui: { name: 'Custom', icon: 'sword', touch: 'melee', melee: true, lockOn: true, tracers: false, swapIcon: '' },
      meta: { name: 'Custom', icon: 'sword', category: 'weapon', blurb: '' } });
    this.contact = melee(combat); this.blocks.melee = this.contact;
  }
  override tryFire(): void {
    for (const target of this.combat.targets()) {
      if (!target.hittable) continue;
      this.contact.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.test-custom', 'dmg.melee'],
        target: target.actor, amount: 50, point: target.position.clone().add(new Vector3(0, 1, 0)),
        dir: new Vector3(0, 0, -1), stagger: 0.8, weaponId: this.row.id });
    }
  }
  override update(): void { /* Single deterministic contact. */ }
}

describe('custom weapons share creature and practice combat targets', () => {
  it.each([['wood', 41], ['straw-cloth', 50], ['wood-steel', 31]] as const)('%s dummy takes damage, displays armour-adjusted numbers and reacts', (variant, damage) => {
    const events = new Events(), scope = new Scope('custom-weapon'), combat = new CombatPipeline(events, scope);
    const target = new TrainingTarget(variant, 0, 900, 0, 0, 0, document.createElement('div'), 1);
    const hurt = vi.fn(), reaction = vi.spyOn(target.motion, 'hit'), stagger = vi.spyOn(target, 'stagger');
    target.onDamage = (amount, point) => { hurt(amount, point); };
    const actor = practiceActor(target, 'practice.test');
    const port = combat.targetPort(actor, target);
    combat.registerTargets(scope, () => [port], () => true);
    const dealt: DamageDealt[] = [];
    events.on('damage.dealt', (value) => { dealt.push(value); }, scope);
    const weapon = new CustomWeapon(combat); weapon.install({ scope, events }); weapon.tryFire(); events.flush('update');
    expect(combat.target(target)).toBe(port);
    expect(hurt).toHaveBeenCalledWith(damage, new Vector3(0, 901, 0));
    expect(reaction).toHaveBeenCalledOnce(); expect(stagger).toHaveBeenCalledWith(new Vector3(0, 0, -1), 0.8);
    expect(dealt).toHaveLength(1); expect(dealt[0]?.req.target).toBe(actor); expect(dealt[0]?.killed).toBe(false);
    weapon.tryFire(); expect(hurt).toHaveBeenCalledTimes(2); expect(actor.alive).toBe(true);
    expect(port.hurt({ source: 'env', sourceTags: ['actor.player', 'dmg.melee'], amount: 50,
      point: new Vector3(0, 901, 0), dir: new Vector3(0, 0, -1) })?.req.target).toBe(actor);
    expect(hurt).toHaveBeenCalledTimes(3);
    scope.dispose(); expect(combat.targets()).toEqual([]); expect(combat.target(target)).toBeNull();
  });

  it('isolates the open arena, restores creature queries on exit, and drops disposed sources', () => {
    const events = new Events(), scope = new Scope('world'), room = scope.child('practice'), combat = new CombatPipeline(events, scope);
    const world = new TrainingTarget('wood', 0, 0, 0, 0, 0, document.createElement('div'), 1);
    const dummy = new TrainingTarget('wood', 0, 900, 0, 0, 0, document.createElement('div'), 2);
    const apply = vi.fn(() => false);
    const actor: Actor = { id: 'creature.test', tags: ['actor.creature'], state: [], alive: true,
      attributes: { health: 100, maxHealth: 100 }, applyDamage: apply };
    let open = false, available = true;
    const creature = combat.targetPort(actor, world, undefined, () => available);
    const practice = combat.targetPort(practiceActor(dummy, 'practice.test'), dummy);
    combat.registerTargets(scope, () => [creature]); combat.registerTargets(room, () => [practice], () => open);
    const weapon = new CustomWeapon(combat); weapon.tryFire(); expect(apply).toHaveBeenCalledOnce();
    open = true; expect(combat.targets()).toEqual([practice]); expect(combat.target(world)).toBeNull();
    weapon.tryFire(); expect(apply).toHaveBeenCalledOnce();
    open = false; expect(combat.targets()).toEqual([creature]);
    available = false;
    expect(creature.hittable).toBe(false);
    expect(creature.hurt({ source: 'env', sourceTags: [], amount: 50, point: world.position, dir: new Vector3() })).toBeNull();
    room.dispose(); scope.dispose(); expect(combat.targets()).toEqual([]);
  });
});
