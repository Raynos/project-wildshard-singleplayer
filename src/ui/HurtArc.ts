import './styles/combat.css';

/**
 * HurtArc — the "you were hit FROM THERE" indicator (DOM in `#hud`, styled in `src/ui/styles/combat.css`, prefix
 * `ws-combat-hurt`): a red tapered arc on a ring around the crosshair, turned toward the attacker and kept turned as
 * you look around (re-aimed every frame from the camera yaw), fading over LIFE s. A hit from dead ahead lights the top
 * of the ring, from behind the bottom. Pooled (SLOTS arcs, the oldest recycled), no per-frame allocations.
 *
 *   const hurtArc = new HurtArc();
 *   hurtArc.hit(attacker.position.x, attacker.position.z, player.position, player.yaw, damage);   // on every hit taken
 *   game.onUpdate((dt) => hurtArc.update(dt, player.position, player.yaw));
 *
 * The hurt sound itself is `Audio.hurt(strength, pan)` (src/audio/Audio.ts, B3).
 */

const SLOTS = 4;
const LIFE = 1.3;      // s an arc stays up (full for the first HOLD, then fades)
const HOLD = 0.35;

interface Slot { el: HTMLElement; x: number; z: number; t: number; strength: number; active: boolean }

export class HurtArc {
  private layer: HTMLElement;
  private slots: Slot[] = [];

  constructor() {
    this.layer = document.createElement('div');
    this.layer.className = 'ws-combat-hurt';
    for (let i = 0; i < SLOTS; i++) {
      const el = document.createElement('i');
      el.className = 'ws-combat-hurt-arc';
      this.layer.append(el);
      this.slots.push({ el, x: 0, z: 0, t: 0, strength: 0, active: false });
    }
    const hud = document.getElementById('hud');
    if (hud) hud.prepend(this.layer); else document.body.append(this.layer);
  }

  /** a hit from world (x, z); `damage` sizes the arc (8 → a thin one, 18+ → a thick one) */
  hit(x: number, z: number, player: { x: number; z: number }, yaw: number, damage: number): void {
    let s = this.slots.find((k) => !k.active);
    if (s === undefined) for (const k of this.slots) if (s === undefined || k.t > s.t) s = k; // recycle the oldest
    if (s === undefined) return;
    s.x = x; s.z = z; s.t = 0; s.active = true;
    s.strength = Math.min(1, 0.45 + damage / 30);
    s.el.style.setProperty('--ws-hurt-w', `${Math.round(34 + 40 * s.strength)}deg`);
    s.el.classList.add('show');
    this.aim(s, player, yaw);
  }

  update(dt: number, player: { x: number; z: number }, yaw: number): void {
    for (const s of this.slots) {
      if (!s.active) continue;
      s.t += dt;
      if (s.t >= LIFE) { s.active = false; s.el.classList.remove('show'); continue; }
      this.aim(s, player, yaw);
    }
  }

  /** turn the arc toward the attacker: 0 = ahead (top), +90° = to the right */
  private aim(s: Slot, player: { x: number; z: number }, yaw: number): void {
    const dx = s.x - player.x, dz = s.z - player.z;
    // forward (-sin yaw, -cos yaw), right (cos yaw, -sin yaw) — Player.ts
    const fwd = -dx * Math.sin(yaw) - dz * Math.cos(yaw), right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const deg = Math.atan2(right, fwd) * 180 / Math.PI;
    const k = s.t < HOLD ? 1 : 1 - (s.t - HOLD) / (LIFE - HOLD);
    s.el.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    s.el.style.opacity = (k * (0.55 + 0.45 * s.strength)).toFixed(3);
  }
}

/** how each killer kills you (species id → verb); anything else is "Killed by …" */
const VERB: Record<string, string> = {
  boar: 'Gored by', bear: 'Mauled by', crab: 'Snapped up by', monkey: 'Mobbed by', sailor: 'Cut down by', deer: 'Trampled by', elk: 'Trampled by',
  // Nalati (NALATI-MERGE F3)
  wolf: 'Torn down by', kokbori: 'Torn down by', leopard: 'Mauled by', eagle: 'Stooped on by', horse: 'Trampled by', argymaq: 'Trampled by',
  'ghost-rider': 'Ridden down by', 'golden-king': 'Cut down by', 'storm-titan': 'Struck down by',
};

/** who (or what) hurt you last: an animal (`Animal.kind` / `Animal.label`), or a cause with no attacker ("Struck by lightning") */
export type Killer = { kind: string; label: string } | { cause: string };

/** where this shard puts you back (the death toast's tail) */
export function respawnWhere(def: { slug: string; ocean?: unknown }): string {
  if (def.ocean !== undefined) return 'washed back to the pier';
  if (def.slug === 'nalati-grasslands') return 'respawning on the north road';
  return 'respawning at the south gate';
}

/**
 * The death toast (B2): who killed you and where you come back — "Snapped up by a big reef crab — washed back to the
 * pier" on an ocean shard, "Gored by a boar — respawning at the south gate" in the forest, "Struck by lightning —
 * respawning on the north road" on Nalati; a fall (no attacker) is "Fell too far". `killer` = the last thing that hurt
 * you, null for a fall; `where` = `respawnWhere(chunk)`.
 */
export function deathLine(killer: Killer | null, where: string): string {
  if (killer === null) return `Fell too far — ${where}`;
  if ('cause' in killer) return `${killer.cause} — ${where}`;
  const name = killer.label.trim() === '' ? killer.kind : killer.label.toLowerCase();
  const article = /^(the |a |an )/.test(name) ? '' : /^[aeiou]/.test(name) ? 'an ' : 'a ';
  return `${VERB[killer.kind] ?? 'Killed by'} ${article}${name} — ${where}`;
}
