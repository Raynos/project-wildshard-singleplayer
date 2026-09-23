import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from '../player/Player';
import type { AnimalManager } from '../entities/AnimalManager';
import type { Animal } from '../entities/Animal';
import type { ThinkCtx } from '../entities/species/registry';
import type { Bow } from '../player/Bow';
import type { Interactable } from '../world/Cabin';
import type { KurganEntrance } from '../world/nalati/KurganField';
import { GOLDEN_KING, goldenKingBrain } from '../entities/species/goldenKing';
import { KURGAN_BALBAL } from '../entities/species/kurganBalbal';
import { KurganDungeon, DUNGEON, CH, COFFIN, PEDESTAL, NICHES, STREAMS, CHECKPOINT, DROMOS_SPAWN, DROMOS_END } from '../world/nalati/KurganDungeon';
import { Boss, type BossDef, type BossScript } from '../game/Boss';
import { BossBar } from '../ui/BossBar';
import { GoldenBow, goldenBowModel } from '../player/GoldenBow';

/**
 * The Golden King fight (plan row B13; design docs/design/nalati/elites-and-bosses.md §2 "The Golden King fight, step by
 * step"; mockups art/nalati-grasslands/round-2/5-bosses/). Two pieces:
 *
 *   GoldenKingFight — the `BossScript` (src/game/Boss.ts): the King's brain (`goldenKingBrain`, the species forwards its
 *     10 Hz tick here), his damage rule, the three phases and what each does to the room:
 *       I   "The King's Court" (100 → 60 %): he duels you on the open floor — the akinakes combo (14 / 14 / 22; the blade
 *           glints before each cut, the third's wide arc is painted on the floor) and the SUNBURST (sword up, gold spirals
 *           in, a gold ring races out across the floor from his feet — jump it: 25). Gold scale takes half from arrows,
 *           the face full (×2.5 headshot); every sabre / spear hit knocks plaques loose, and after six his chest takes
 *           arrows in full.
 *       II  "The Kurgan Wakes" (60 → 30 %): he staggers back to his coffin and kneels behind a dome of gold light
 *           (shielded — the bar shimmers). Two balbals step out of the wall niches, two more if you are slow; the dome
 *           holds while any stands. Sand pours through the ceiling where a gold shimmer marks it a second before, and
 *           drifts build (walking in sand halves your speed; the fallen beams and the coffin plinth are the high
 *           ground). The last balbal falls → the dome breaks, he is stunned 4 s, then fights until he kneels again.
 *       III "The Gold Burns" (30 → 0 %): he tears off his cloak — faster, a fourth strike, a DOUBLE sunburst. The
 *           looter's-hole light becomes a burning beam sweeping the floor on a gold line (15 to you; lure him through it:
 *           50 to him). His headdress glows: 200 hp of headshots knock it off and drop him to one knee for 3 s.
 *     Victory: he crumbles into a heap of gold plaques, the sand drains, the pedestal's shaft lights the Golden Bow.
 *
 *   KurganBoss — the glue `src/nalati/index.ts` wires: builds the interior (KurganDungeon), the doors (walk into the POI
 *     agent's dark passage in the mound → fade → the dromos; walk back out of the dromos → the mound's flank), hides the
 *     outdoor world and calms the steppe's animals while you are inside, the Boss + BossBar, the Golden Bow reward (and
 *     re-applies it at boot once owned), the dev hooks (`?boss=golden-king` starts at the chamber door; `&bossPhase=2|3`
 *     at that checkpoint; `window.__boss`).
 */

export const KING_DEF_PHASES = [
  { at: 1, caption: '', name: "The King's Court" },
  { at: 0.6, caption: 'PHASE II', name: 'The Kurgan Wakes' },
  { at: 0.3, caption: 'PHASE III', name: 'The Gold Burns' },
];

type Mode = 'coffin' | 'rising' | 'fight' | 'toCoffin' | 'shield' | 'stun' | 'kneel' | 'dead';
interface Ring { r: number; delay: number; active: boolean; hit: boolean; cx: number; cz: number }

const STRIKE_DMG = [14, 14, 22, 22], REACH = 3.0, SUNBURST_DMG = 25, RING_SPEED = 8.5, RING_MAX = 17;
const BEAM_R = 6.2, BEAM_HIT_R = 1.15, BEAM_DMG = 15, BEAM_TO_KING = 50, HEADDRESS_HP = 200;
const SHIELD_SPOT = { x: COFFIN.x, z: COFFIN.z + COFFIN.len / 2 + 0.7 };
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _h = new THREE.Vector3(), _focus = new THREE.Vector3();

export interface FightHost {
  player: Player;
  animals: AnimalManager;
  /** the player takes `dmg` from the King / a hazard (routed to animals.onCharge: main's health, flash, sound) */
  hurt: (dmg: number) => void;
  feed: (text: string) => void;
}

export class GoldenKingFight implements BossScript {
  king: Animal | null = null;
  mode: Mode = 'coffin';
  phase = 0;
  private invuln = false;
  private lockHp = 0;
  private modeT = 0;
  private comboLeft = 0; private comboCd = 1.5; private burstCd = 6;
  private glow = 0; private glint = 0;
  private plaques = 0; chestOpen = false;
  private headHp = HEADDRESS_HP; private lastHp = 0; private lastHeadHit = false;
  private balbals: { a: Animal; niche: number; deadT: number }[] = [];
  private waves = 0; private waveT = 0;
  private rings: Ring[] = [{ r: 0, delay: 0, active: false, hit: false, cx: 0, cz: 0 }, { r: 0, delay: 0, active: false, hit: false, cx: 0, cz: 0 }];
  private streams: { st: number; t: number }[] = STREAMS.map(() => ({ st: 0, t: 0 }));
  private streamT = 2;
  private beamOn = false; private beamA = -2.2; private beamDir = 1; private beamHitCd = 0; private beamKingCd = 0; private beamK = 0;
  private victoryT = -1;
  private readonly baseEmissive = 0.035;

  constructor(private readonly dungeon: KurganDungeon, private readonly host: FightHost) {
    goldenKingBrain.think = (a, c) => { if (a === this.king) this.think(a, c); };
    goldenKingBrain.damageMul = (a, hitPoint) => (a === this.king ? this.damageMul(a, hitPoint) : 1);
  }

  // ── BossScript ──
  get hpFrac(): number { return this.king ? Math.max(0, this.king.hp / this.king.maxHp) : 0; }
  get shielded(): boolean { return this.mode === 'shield' || this.mode === 'toCoffin'; }
  get dead(): boolean { return this.king !== null && !this.king.alive; }
  inArena(p: THREE.Vector3): boolean { return this.dungeon.inChamber(p) && p.z - DUNGEON.z < CH - 1.1; }
  seal(on: boolean): void { this.dungeon.setSealed(on); }
  clampHp(frac: number): void { if (this.king) { this.king.hp = Math.max(1, Math.round(this.king.maxHp * frac)); this.lockHp = this.king.hp; this.lastHp = this.king.hp; } }
  setInvulnerable(on: boolean): void { this.invuln = on; if (on && this.king) this.lockHp = this.king.hp; }
  rewardPoint(): THREE.Vector3 { return this.dungeon.world(PEDESTAL.x, PEDESTAL.h + 0.02, PEDESTAL.z); }
  respawnPoint(): { pos: THREE.Vector3; yaw: number } { return { pos: this.dungeon.world(CHECKPOINT.x, 0, CHECKPOINT.z), yaw: CHECKPOINT.yaw }; }

  reset(phase: number): void {
    const d = this.dungeon;
    this.phase = phase;
    let k = this.king;
    if (k === null || !k.alive) {
      if (k !== null) this.retire(k);
      d.world(COFFIN.x, 0, COFFIN.z, _v);
      k = this.host.animals.spawn(GOLDEN_KING, _v.x, _v.z, 0, 'king');
      k.herd = -1;
      this.king = k;
    }
    const at = KING_DEF_PHASES[phase]?.at ?? 1;
    k.hp = Math.round(k.maxHp * at); this.lastHp = k.hp; this.lockHp = k.hp;
    d.world(COFFIN.x, 0, COFFIN.z, _v);
    k.place(_v.x, _v.z, 0);
    k.cancelAttack(); k.setMotion(0, 0, 1); k.lookWeight = 0;
    const m = k.mem;
    m['pose'] = 0; m['rise'] = 0; m['lift'] = 0; m['kneel'] = 0; m['raise'] = 0; m['act'] = 0; m['strike'] = 0;
    m['cape'] = phase >= 2 ? 0 : 1; m['crown'] = 1;
    m['floorY'] = DUNGEON.y + COFFIN.plinthH + 0.12; m['floorS'] = m['floorY'] ?? 0; m['deadT'] = 0; m['init'] = 1;
    k.yOffset = (m['floorY'] ?? 0) - k.position.y;
    k.hidden = false; k.mesh.visible = true;
    m['noHeadBar'] = 1;                                // the wide boss bar instead (Combat.ts skips it)
    this.mode = 'coffin'; this.modeT = 0; this.invuln = false;
    this.comboLeft = 0; this.comboCd = 1.2; this.burstCd = 5 + Math.random() * 2;
    this.plaques = 0; this.chestOpen = false; this.headHp = HEADDRESS_HP; this.glow = 0; this.glint = 0;
    for (const b of this.balbals) this.retire(b.a);
    this.balbals = []; this.waves = 0; this.waveT = 0;
    for (let i = 0; i < NICHES.length; i++) d.setNicheStatue(i, true);
    for (const r of this.rings) r.active = false;
    for (const s of this.streams) { s.st = 0; s.t = 0; }
    this.streamT = 2; this.beamOn = false; this.beamK = 0; this.victoryT = -1;
    this.hideFx();
    d.clearSand();
    if (phase >= 2) this.prefillDrifts();
    d.setLid(0); d.setShaft(0, 0.38); d.setShaft(1, 0); d.showHeap(false);
    this.setEmissive(0.01);
  }

  intro(t: number, short: boolean): THREE.Vector3 {
    const k = this.king;
    const lid0 = short ? 0 : 0.25, lid1 = short ? 0.3 : 1.35, r0 = short ? 0.15 : 1.25, r1 = short ? 1.15 : 3.55;
    this.dungeon.setLid(THREE.MathUtils.clamp((t - lid0) / (lid1 - lid0), 0, 1));
    this.dungeon.setShaft(0, 0.38 + 0.45 * Math.sin(Math.min(1, t / (short ? 1.2 : 3.8)) * Math.PI));
    if (k) {
      this.mode = 'rising';
      k.mem['rise'] = THREE.MathUtils.clamp((t - r0) / (r1 - r0), 0, 1);
      this.setEmissive(0.01 + 0.2 * THREE.MathUtils.smoothstep(t, r1 - 0.8, r1) * (1 - THREE.MathUtils.smoothstep(t, r1, r1 + 0.6)));   // the gold wakes
      k.headWorld(_focus);
      return _focus;
    }
    return this.dungeon.world(COFFIN.x, 1.5, COFFIN.z, _focus);
  }

  begin(phase: number): void {
    const k = this.king;
    if (!k) return;
    this.dungeon.setLid(1);
    k.mem['pose'] = 1; k.mem['rise'] = 1;
    this.mode = 'fight'; this.modeT = 0;
    this.comboCd = 0.8; this.burstCd = 4 + Math.random() * 3;
    this.setEmissive(this.baseEmissive);
    if (phase === 1) {
      // the phase II checkpoint: straight to the coffin's foot, the dome up, the adds out
      this.dungeon.world(SHIELD_SPOT.x, 0, SHIELD_SPOT.z, _v);
      k.place(_v.x, _v.z, 0);
      this.enterShield();
    } else if (phase >= 2) {
      k.mem['cape'] = 0;
      this.beamOn = true; this.beamA = -2.2; this.beamDir = 1;
    }
  }

  enterPhase(phase: number): void {
    this.phase = phase;
    const k = this.king;
    if (!k) return;
    k.cancelAttack(); this.comboLeft = 0; this.dungeon.arc.mesh.visible = false;
    if (phase === 1) {
      k.mem['act'] = 3; k.startAttack(1.3);
      this.host.feed('The kurgan wakes — the King falls back to his coffin');
      this.mode = 'toCoffin'; this.modeT = -1.3;
      this.streamT = 2.5;
    } else if (phase === 2) {
      k.mem['act'] = 4; k.startAttack(1.4);
      this.mode = 'fight'; this.modeT = 0;
      this.dungeon.dome.mesh.visible = false;
      for (const s of this.streams) if (s.st !== 0) { s.st = 0; s.t = 0; }
      this.beamOn = true; this.beamA = -2.2; this.beamDir = 1; this.beamK = 0;
      this.headHp = HEADDRESS_HP;
      this.host.feed('The King tears off his cloak — the gold burns');
      this.comboCd = 1.6; this.burstCd = 3.5;
    }
  }

  victory(): void {
    this.mode = 'dead'; this.victoryT = 0;
    this.beamOn = false;
    for (const r of this.rings) r.active = false;
    for (const s of this.streams) { s.st = 0; s.t = 0; }
    for (const b of this.balbals) this.retire(b.a);
    this.balbals = [];
    this.dungeon.dome.mesh.visible = false; this.dungeon.arc.mesh.visible = false;
    this.dungeon.setShaft(0, 0.35); this.dungeon.setShaft(1, 1.4);
  }

  // ── the King's brain (10 Hz) ──
  private think(a: Animal, c: ThinkCtx): void {
    const m = a.mem, d = this.dungeon;
    // the floor under him: the coffin's inside while he is in it, else the chamber floor (plinth, drifts, beams)
    const lx = a.position.x - DUNGEON.x, lz = a.position.z - DUNGEON.z;
    const inCoffin = Math.abs(lx - COFFIN.x) < COFFIN.wid / 2 - 0.05 && Math.abs(lz - COFFIN.z) < COFFIN.len / 2 - 0.05;
    m['floorY'] = inCoffin ? DUNGEON.y + COFFIN.plinthH + 0.12 : d.floorHeightAt(a.position.x, a.position.z) ?? DUNGEON.y;
    a.lookTarget.copy(c.player); a.lookWeight = this.mode === 'coffin' ? 0 : 1;
    const dx = c.player.x - a.position.x, dz = c.player.z - a.position.z, dist = Math.hypot(dx, dz), toPlayer = Math.atan2(dx, dz);
    this.comboCd -= c.dt; this.burstCd -= c.dt;
    switch (this.mode) {
      case 'coffin': case 'rising': case 'dead': a.setMotion(a.yaw, 0, 1); break;
      case 'fight': this.fightTick(a, dist, toPlayer); break;
      case 'toCoffin': {
        if (a.attackPhase >= 0 && a.attackPhase < 1) { a.setMotion(toPlayer, 0, 2); break; }
        if (a.attackPhase >= 1) a.cancelAttack();
        d.world(SHIELD_SPOT.x, 0, SHIELD_SPOT.z, _v);
        const hx = _v.x - a.position.x, hz = _v.z - a.position.z, hd = Math.hypot(hx, hz);
        if (hd < 0.5) this.enterShield();
        else a.setMotion(Math.atan2(hx, hz), 2.4, 4);
        break;
      }
      case 'shield': case 'stun': case 'kneel': a.setMotion(this.mode === 'shield' ? 0 : toPlayer, 0, 1.5); break;
      default: break;
    }
    // stay in the chamber
    const lim = CH - 0.9;
    a.position.x = THREE.MathUtils.clamp(a.position.x, DUNGEON.x - lim, DUNGEON.x + lim);
    a.position.z = THREE.MathUtils.clamp(a.position.z, DUNGEON.z - lim, DUNGEON.z + lim);
  }

  private fightTick(a: Animal, dist: number, toPlayer: number): void {
    const m = a.mem, p3 = this.phase >= 2;
    const act = m['act'] ?? 0, atk = a.attackPhase;
    if (atk >= 0) {
      // committed: turn slowly through the wind-up, not at all through the cut
      a.setMotion(toPlayer, 0, atk < 0.45 ? 1.8 : 0.2);
      if (act === 1) {
        const i = m['strike'] ?? 0;
        if (atk >= 0.62 && m['hitDone'] !== 1) {
          m['hitDone'] = 1;
          this.dungeon.arc.mesh.visible = false;
          let off = toPlayer - a.yaw; off = Math.atan2(Math.sin(off), Math.cos(off));
          const wide = i >= 2;
          const pl = this.host.player.position;
          if (dist <= REACH * (wide ? 1.1 : 1) && Math.abs(off) < (wide ? 1.35 : 0.95) && pl.y < a.position.y + 2.6) {
            this.host.hurt(STRIKE_DMG[i] ?? 14);
            this.shove(a, wide ? 5 : 3);
          }
        }
        if (atk >= 1) {
          a.cancelAttack();
          if (this.comboLeft > 0 && dist < REACH + 2.5) this.startStrike(a, i + 1);
          else { this.comboLeft = 0; this.comboCd = p3 ? 1.1 : 1.8; m['act'] = 0; }
        }
      } else if (act === 2) {
        this.glow = Math.min(1, atk / 0.72);
        if (atk >= 0.72 && m['hitDone'] !== 1) { m['hitDone'] = 1; this.fireRings(a, p3 ? 2 : 1); }
        if (atk >= 1) { a.cancelAttack(); m['act'] = 0; this.burstCd = p3 ? 6.5 + Math.random() * 2 : 9 + Math.random() * 3; this.comboCd = Math.max(this.comboCd, 0.6); }
      } else if (atk >= 1) {
        // the roar / the torn cloak
        if (act === 4) m['cape'] = 0;
        a.cancelAttack(); m['act'] = 0;
      } else if (act === 4 && atk > 0.45) m['cape'] = Math.max(0, 1 - (atk - 0.45) * 4);
      return;
    }
    if (this.burstCd <= 0 && dist < 13 && dist > 2.2) {
      m['act'] = 2; m['hitDone'] = 0; a.startAttack(p3 ? 2.0 : 2.4);
      return;
    }
    if (dist <= REACH + 0.2 && this.comboCd <= 0) {
      this.comboLeft = p3 ? 4 : 3;
      this.startStrike(a, 0);
      return;
    }
    a.setMotion(toPlayer, dist > 2.3 ? (p3 ? 2.6 : 1.75) : 0, 2.8);
  }

  private startStrike(a: Animal, i: number): void {
    const m = a.mem;
    m['act'] = 1; m['strike'] = i; m['hitDone'] = 0;
    this.comboLeft--;
    a.startAttack(this.phase >= 2 ? 0.78 : 0.95);
    this.glint = 1;                                   // the blade glints before each cut
    if (i >= 2) {                                     // the wide one: its arc is painted on the floor
      const arc = this.dungeon.arc;
      arc.mesh.visible = true;
      arc.mesh.position.set(a.position.x - DUNGEON.x, (a.mem['floorY'] ?? DUNGEON.y) - DUNGEON.y + 0.04, a.position.z - DUNGEON.z);
      arc.mesh.rotation.y = a.yaw - Math.PI / 2;
      arc.mesh.scale.setScalar(REACH * 1.15);
    }
  }

  private enterShield(): void {
    const k = this.king;
    if (!k) return;
    this.mode = 'shield'; this.modeT = 0;
    k.cancelAttack(); k.mem['act'] = 0; k.yaw = 0; k.setMotion(0, 0, 3);
    k.mem['kneel'] = 1; k.mem['raise'] = 1;
    this.lockHp = k.hp;
    this.dungeon.dome.mesh.visible = true;
    this.spawnWave();
  }

  private spawnWave(): void {
    // niches alternate pairs: the near pair first, then the far pair
    const pair = this.waves % 2 === 0 ? [0, 1] : [2, 3];
    for (const i of pair) {
      const n = NICHES[i];
      if (!n) continue;
      const sx = Math.sign(n.x);
      this.dungeon.world(n.x + sx * 0.55, 0, n.z, _v);
      const a = this.host.animals.spawn(KURGAN_BALBAL, _v.x, _v.z, n.yaw, 'warrior');
      a.herd = -1;
      const m = a.mem;
      m['floorY'] = DUNGEON.y; m['emergeT'] = 1.9;
      m['minX'] = DUNGEON.x - CH + 0.9; m['maxX'] = DUNGEON.x + CH - 0.9; m['minZ'] = DUNGEON.z - CH + 0.9; m['maxZ'] = DUNGEON.z + CH - 0.9;
      a.yOffset = DUNGEON.y - a.position.y;
      this.dungeon.setNicheStatue(i, false);
      this.balbals.push({ a, niche: i, deadT: 0 });
    }
    this.waves++; this.waveT = 0;
  }

  private damageMul(a: Animal, hitPoint: THREE.Vector3): number {
    if (this.invuln || this.mode === 'shield' || this.mode === 'toCoffin' || this.mode === 'coffin' || this.mode === 'rising') return 0;
    a.headWorld(_h);
    const soft = this.mode === 'stun' || this.mode === 'kneel' ? 1.25 : 1;
    if (_h.distanceTo(hitPoint) < 0.16 * a.scale + 0.14) { this.lastHeadHit = true; return soft; }
    const pl = this.host.player.position;
    const melee = Math.hypot(hitPoint.x - pl.x, hitPoint.z - pl.z) < 3.8;
    if (melee) {
      this.plaques++;
      if (this.plaques === 6 && !this.chestOpen) { this.chestOpen = true; this.host.feed('Gold plaques torn loose — his chest is bare'); }
      return soft;
    }
    return (this.chestOpen ? 1 : 0.5) * soft;
  }

  // ── per frame ──
  update(dt: number, t: number, fighting: boolean): void {
    const k = this.king, d = this.dungeon;
    void t;
    if (k) {
      // shield / beat: nothing gets through (Animal.applyDamage deals ≥ 1 — undo it)
      if ((this.invuln || this.mode === 'shield' || this.mode === 'toCoffin') && k.alive && k.hp < this.lockHp) k.hp = this.lockHp;
      // the headdress (phase III): headshots wear it down; off, he drops to one knee
      if (this.lastHeadHit) {
        const lost = this.lastHp - k.hp;
        if (lost > 0 && k.alive && this.mode !== 'dead' && this.phase >= 2 && (k.mem['crown'] ?? 1) > 0) {
          this.headHp -= lost;
          if (this.headHp <= 0) { k.mem['crown'] = 0; this.mode = 'kneel'; this.modeT = 0; k.cancelAttack(); k.mem['act'] = 0; k.mem['kneel'] = 1; this.host.feed('The headdress falls — the King kneels'); }
        }
        this.lastHeadHit = false;
      }
      this.lastHp = k.hp;
      // glow: the resting gold, the glint before a cut, the sunburst's charge, the phase III fire
      this.glint = Math.max(0, this.glint - dt * 3);
      if ((k.mem['act'] ?? 0) !== 2) this.glow = Math.max(0, this.glow - dt * 2);
      const burn = this.phase >= 2 && this.mode !== 'dead' ? 0.07 + 0.04 * Math.sin(t * 6) : 0;
      if (this.mode !== 'coffin' && this.mode !== 'rising') this.setEmissive(this.baseEmissive + 0.22 * this.glint + 0.45 * this.glow + burn);
      // the sunburst's tell: a ring of light tightening at his feet while he charges
      const tell = this.rings[1];
      if (tell && !tell.active && (k.mem['act'] ?? 0) === 2 && k.attackPhase >= 0 && k.attackPhase < 0.72) {
        const ring = d.rings[1];
        if (ring) {
          ring.mesh.visible = true;
          ring.mesh.position.set(k.position.x - DUNGEON.x, (k.mem['floorS'] ?? DUNGEON.y) - DUNGEON.y + 0.05, k.position.z - DUNGEON.z);
          ring.mesh.scale.setScalar(2.4 - 1.6 * (k.attackPhase / 0.72));
          ring.mat.uniforms.uAlpha.value = 0.4 + 0.6 * (k.attackPhase / 0.72);
        }
      } else if (tell && !tell.active) { const ring = d.rings[1]; if (ring) ring.mesh.visible = false; }
      // mode timers
      this.modeT += dt;
      if (this.mode === 'dead') { /* the crumble below */ } else if (this.mode === 'stun' && this.modeT > 4) { this.mode = 'fight'; this.modeT = 0; k.mem['kneel'] = 0; k.mem['raise'] = 0; this.comboCd = 0.8; }
      else if (this.mode === 'kneel' && this.modeT > 3) { this.mode = 'fight'; this.modeT = 0; k.mem['kneel'] = 0; this.comboCd = 0.6; }
      if (this.mode === 'shield') d.dome.mesh.position.set(k.position.x - DUNGEON.x, (k.mem['floorS'] ?? DUNGEON.y) - DUNGEON.y, k.position.z - DUNGEON.z);
      d.dome.mesh.scale.setScalar(1.75);
      d.dome.mat.uniforms.uAlpha.value = 0.9;
      // phase II: fight a while after the stun, then back to the coffin for another pair
      if (this.phase === 1 && this.mode === 'fight' && this.modeT > 16) { this.mode = 'toCoffin'; this.modeT = 0; }
    }
    if (fighting || this.mode === 'dead') {
      this.updateRings(dt);
      this.updateBalbals(dt);
      this.updateStreams(dt);
      this.updateBeam(dt);
    }
    // the crumble: hide him, the heap of plaques where he fell, the drifts drain away
    if (this.victoryT >= 0 && k) {
      this.victoryT += dt;
      if (this.victoryT > 1.6 && !k.hidden) {
        d.showHeap(true, k.position.x - DUNGEON.x, k.position.z - DUNGEON.z);
        this.retire(k);
      }
      d.drainSand(dt, 0.3);
    }
  }

  private fireRings(a: Animal, n: number): void {
    for (let i = 0; i < n; i++) {
      const r = this.rings[i];
      if (!r) continue;
      r.active = true; r.hit = false; r.r = 0.8; r.delay = i * 0.95;
      r.cx = a.position.x; r.cz = a.position.z;
    }
    this.host.feed(n > 1 ? 'SUNBURST ×2 — jump, land, jump' : 'SUNBURST — jump it');
  }

  private updateRings(dt: number): void {
    const pl = this.host.player.position;
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i], vis = this.dungeon.rings[i];
      if (!r || !vis || !r.active) continue;
      if (r.delay > 0) { r.delay -= dt; if (i === 1) vis.mesh.visible = false; continue; }
      r.r += RING_SPEED * dt;
      const floorY = this.dungeon.floorHeightAt(pl.x, pl.z) ?? DUNGEON.y;
      const dp = Math.hypot(pl.x - r.cx, pl.z - r.cz);
      if (!r.hit && Math.abs(dp - r.r) < 0.5 && pl.y - floorY < 0.4) {
        r.hit = true;
        this.host.hurt(SUNBURST_DMG);
        this.host.player.dash((pl.x - r.cx) / Math.max(0.1, dp) * 9, (pl.z - r.cz) / Math.max(0.1, dp) * 9, 0.18);
      }
      vis.mesh.visible = true;
      vis.mesh.position.set(r.cx - DUNGEON.x, 0.06, r.cz - DUNGEON.z);
      vis.mesh.scale.setScalar(r.r);
      vis.mat.uniforms.uAlpha.value = 1.4 * (1 - THREE.MathUtils.smoothstep(r.r, RING_MAX * 0.7, RING_MAX));
      if (r.r >= RING_MAX) { r.active = false; vis.mesh.visible = false; }
    }
  }

  private updateBalbals(dt: number): void {
    const k = this.king;
    let alive = 0;
    for (const b of this.balbals) {
      if (b.a.alive) { alive++; continue; }
      b.deadT += dt;
      if (b.deadT > 2.4 && !b.a.hidden) this.retire(b.a);
    }
    if (this.mode === 'shield' && k) {
      this.waveT += dt;
      // slow? two more step out
      if (this.waves % 2 === 1 && this.waveT > 25 && alive > 0) this.spawnWave();
      if (alive === 0 && this.balbals.length > 0 && this.balbals.every((b) => !b.a.alive)) {
        // the last one fell: the dome breaks, he is stunned 4 s
        this.dungeon.dome.mesh.visible = false;
        this.mode = 'stun'; this.modeT = 0;
        k.mem['raise'] = 0; k.mem['kneel'] = 1;
        this.balbals = this.balbals.filter((b) => !b.a.hidden);
        this.host.feed('The dome breaks — the King is stunned');
      }
    }
  }

  private updateStreams(dt: number): void {
    const d = this.dungeon;
    const pouring = this.phase === 1 && this.mode !== 'dead';
    if (pouring) {
      this.streamT -= dt;
      if (this.streamT <= 0) {
        this.streamT = 3.2 + Math.random() * 1.6;
        const free = this.streams.map((s, i) => (s.st === 0 ? i : -1)).filter((i) => i >= 0);
        const pick = free[Math.floor(Math.random() * free.length)];
        const s = pick !== undefined ? this.streams[pick] : undefined;
        if (s) { s.st = 1; s.t = 0; }
      }
    }
    for (let i = 0; i < this.streams.length; i++) {
      const s = this.streams[i], vis = d.streams[i];
      if (!s || !vis) continue;
      if (s.st === 0) { vis.mesh.visible = false; vis.tell.visible = false; continue; }
      s.t += dt;
      if (s.st === 1) {
        // the tell: a gold shimmer on the floor a second before the sand comes
        vis.tell.visible = true; vis.tellMat.uniforms.uAlpha.value = Math.min(1, s.t * 2) * 0.9;
        vis.tell.position.y = d.sandAt(vis.x, vis.z) + 0.05;
        if (s.t > 1.0) { s.st = 2; s.t = 0; }
      } else {
        vis.tell.visible = false;
        vis.mesh.visible = true;
        const k = Math.min(1, s.t * 3) * (1 - THREE.MathUtils.smoothstep(s.t, 5.2, 6));
        vis.mat.uniforms.uAlpha.value = k;
        d.addSand(vis.x, vis.z, 2.4, 0.2 * dt * k, 0.95);
        // standing under it: the sand beats down on you
        const pl = this.host.player.position;
        if (Math.hypot(pl.x - DUNGEON.x - vis.x, pl.z - DUNGEON.z - vis.z) < 0.55 && Math.random() < dt * 2) this.host.hurt(4);
        if (s.t > 6 || !pouring) { s.st = 0; s.t = 0; }
      }
    }
  }

  private updateBeam(dt: number): void {
    const d = this.dungeon, b = d.beam;
    this.beamK += ((this.beamOn && this.mode !== 'dead' ? 1 : 0) - this.beamK) * Math.min(1, dt * 1.2);
    if (this.beamK < 0.01) { b.mesh.visible = false; b.line.visible = false; return; }
    // the contact point sweeps a slow arc round the room's centre and back
    this.beamA += this.beamDir * 0.24 * dt;
    if (this.beamA > 2.4 || this.beamA < -2.4) this.beamDir *= -1;
    const cx = Math.sin(this.beamA) * BEAM_R, cz = Math.cos(this.beamA) * BEAM_R * 0.85 - 0.5;
    const top = _w.set(COFFIN.x + 0.3, 6.2, COFFIN.z + 0.1);
    _v.set(cx, 0, cz);
    const len = _v.distanceTo(top);
    b.mesh.visible = true;
    b.mesh.position.copy(_v);
    b.mesh.scale.set(1, len, 1);
    b.mesh.quaternion.setFromUnitVectors(_h.set(0, 1, 0), top.sub(_v).normalize());
    b.mat.uniforms.uAlpha.value = 0.7 * this.beamK;
    // the path line ahead of it: a gold arc on the floor
    b.line.visible = true;
    b.line.rotation.y = this.beamDir > 0 ? this.beamA - Math.PI / 2 : this.beamA - Math.PI / 2 - Math.PI * 0.6;
    b.line.scale.set(BEAM_R / 6, 1, BEAM_R * 0.85 / 6);
    b.line.position.set(0, 0.05, -0.5);
    b.lineMat.uniforms.uAlpha.value = 0.55 * this.beamK;
    // it burns: you (15, once a second) and him (50 when you lure him through it)
    const pl = this.host.player.position;
    this.beamHitCd -= dt; this.beamKingCd -= dt;
    if (this.beamHitCd <= 0 && Math.hypot(pl.x - DUNGEON.x - cx, pl.z - DUNGEON.z - cz) < BEAM_HIT_R) { this.beamHitCd = 1; this.host.hurt(BEAM_DMG); }
    const k = this.king;
    if (k && k.alive && this.beamKingCd <= 0 && !this.invuln && Math.hypot(k.position.x - DUNGEON.x - cx, k.position.z - DUNGEON.z - cz) < BEAM_HIT_R + 0.3) {
      this.beamKingCd = 3;
      k.headWorld(_h);
      k.applyDamage(BEAM_TO_KING, _h, _w.set(0, -1, 0));
      this.host.feed('The sun beam sears the King');
    }
  }

  private prefillDrifts(): void {
    for (const [x, z, r] of [[-5.2, 3.4, 2.6], [4.8, 4.6, 2.4], [-3.6, -5, 2.2], [5.6, -3.2, 2.5], [1.8, 6.6, 2.0]] as const) this.dungeon.addSand(x, z, r, 0.6, 0.8);
  }

  private hideFx(): void {
    const d = this.dungeon;
    for (const r of d.rings) r.mesh.visible = false;
    for (const s of d.streams) { s.mesh.visible = false; s.tell.visible = false; }
    d.beam.mesh.visible = false; d.beam.line.visible = false; d.dome.mesh.visible = false; d.arc.mesh.visible = false;
  }

  private shove(a: Animal, speed: number): void {
    const pl = this.host.player.position, dx = pl.x - a.position.x, dz = pl.z - a.position.z, l = Math.max(0.1, Math.hypot(dx, dz));
    this.host.player.dash(dx / l * speed, dz / l * speed, 0.15);
  }

  /** out of the fight for good: hidden, out of the animals list (the minimap, the harvest prompt, the aim assist) */
  private retire(a: Animal): void {
    a.hidden = true; a.mesh.visible = false;
    a.position.y = -9999;
    const list = this.host.animals.animals, i = list.indexOf(a);
    if (i !== -1) list.splice(i, 1);
    a.mesh.removeFromParent();
  }

  private setEmissive(k: number): void {
    const king = this.king;
    if (!king) return;
    const mats = Array.isArray(king.mesh.material) ? king.mesh.material : [king.mesh.material];
    for (const m of mats) if (m instanceof THREE.MeshLambertMaterial) { m.emissive.setRGB(1.0, 0.62, 0.16); m.emissiveIntensity = k; }
  }

  /** park / unpark every fight animal (the player left / came back): out of the lists the HUD and the minimap read */
  setPresent(on: boolean): void {
    const list = this.host.animals.animals;
    const mine: Animal[] = [];
    if (this.king) mine.push(this.king);
    for (const b of this.balbals) mine.push(b.a);
    for (const a of mine) {
      const i = list.indexOf(a);
      if (on && i === -1 && !a.hidden) { list.push(a); this.host.animals.group.add(a.mesh); }
      if (!on && i !== -1) { list.splice(i, 1); a.mesh.removeFromParent(); }
    }
  }

  /** dev: kill him now (screenshots of the victory) */
  devKill(): void { const k = this.king; if (k?.alive === true) { this.invuln = false; this.mode = 'fight'; k.headWorld(_h); k.applyDamage(k.hp + 10, _h, _w.set(0, 0, -1)); } }
}

// ─────────────────────────────── the glue ───────────────────────────────

/** scene-root objects that stay on inside: the sky (the looter's hole shows it) and effects near the player */
const KEEP = /sky|planet|cloud|kurgan|projectile|arrow|arc|pickup|streak|csm|light/i;
function isTiny(o: THREE.Object3D): boolean {
  // a group of a few nodes near the dungeon (weapon effects, pickups): leave it alone
  const dx = o.position.x - DUNGEON.x, dy = o.position.y - DUNGEON.y, dz = o.position.z - DUNGEON.z;
  return dx * dx + dy * dy + dz * dz < 40 * 40;
}


export interface KurganPlay {
  animals: AnimalManager;
  setWeaponsEnabled: (on: boolean) => void;
  bow: Bow | null;
  refill: () => void;
  interactables: Interactable[];
  toast: (text: string) => void;
  feed: (text: string) => void;
  music?: (event: 'intro' | 'phase' | 'victory' | 'death' | 'pickup', intensity?: number) => void;
  pickupHum?: (inside: boolean) => void;
  trophy?: () => void;
  params: URLSearchParams;
}

export interface KurganCtx { game: Game; sky: Sky; player: Player; entrance: KurganEntrance | null }

export class KurganBoss {
  readonly dungeon = new KurganDungeon();
  readonly spareLight = new THREE.PointLight(0xffc860, 0, 1, 2);
  ui: BossBar | null = null;
  fight: GoldenKingFight | null = null;
  boss: Boss | null = null;
  golden: GoldenBow | null = null;
  /** the player is inside (the dromos or the chamber) */
  inside = false;
  private play: KurganPlay | null = null;
  private hidden: THREE.Object3D[] = [];
  private fadeT = -1;
  private calmWas = false;
  private locked = false; private slow = false;
  private skipKeys = false; private skipTouch = false;

  constructor(private readonly ctx: KurganCtx) {}

  /** the interior + the spare light (boot, before the precompile) */
  build(): this {
    this.dungeon.build();
    this.ctx.game.scene.add(this.dungeon.group);
    this.ctx.player.colliders.push(...this.dungeon.colliders);
    this.ctx.player.platforms.push(this.dungeon.floorHeightAt);
    this.spareLight.position.set(DUNGEON.x, DUNGEON.y - 30, DUNGEON.z);
    this.ctx.game.scene.add(this.spareLight);
    return this;
  }

  /** once the animals, weapons and HUD exist (main.ts → nalati.bindPlay) */
  bind(play: KurganPlay): void {
    this.play = play;
    const { game, sky, player } = this.ctx;
    const god = play.params.has('bossGod');               // dev: the King's blows and the hazards do no damage (screenshots)
    // build the adds' model now, not mid-fight (a prewarm: a broken add rig must not take the whole boot down)
    try { play.animals.factory.model(KURGAN_BALBAL, 'warrior'); } catch (e) { console.warn('[kurgan] the balbal adds did not build', e); }
    if (god) {
      const hit = play.animals.onCharge;
      play.animals.onCharge = (a, dmg) => { if (a.kind !== GOLDEN_KING && a.kind !== KURGAN_BALBAL) hit?.(a, dmg); };
    }
    this.golden = new GoldenBow({ scene: game.scene, sky, camera: game.camera, raycast: (o, d, max) => play.animals.raycast(o, d, max) });
    this.ui = new BossBar();
    this.fight = new GoldenKingFight(this.dungeon, {
      player, animals: play.animals,
      hurt: (dmg) => { const k = this.fight?.king; if (k) play.animals.onCharge?.(k, dmg); },
      feed: play.feed,
    });
    const def: BossDef = {
      id: 'golden-king', name: 'THE GOLDEN KING', title: 'LORD OF THE GREAT KURGAN', retryTitle: 'THE KING ENDURES',
      phases: KING_DEF_PHASES, intro: 4.2, introShort: 1.4,
      reward: {
        tier: 'LEGENDARY', name: 'THE GOLDEN BOW', flavour: 'Bow of the Saka King', prompt: 'TAKE THE GOLDEN BOW',
        model: () => goldenBowModel(sky),
        grant: () => { if (play.bow && this.golden) this.golden.apply(play.bow); },
        ...(play.trophy ? { trophy: play.trophy } : {}),
      },
    };
    this.boss = new Boss(def, this.fight, {
      scene: game.scene, player, camera: game.camera, renderer: game.renderer, spareLight: this.spareLight,
      lockInput: (on) => { this.locked = on; play.setWeaponsEnabled(!on); this.applyMove(); },
      respawn: (pos, yaw) => { player.position.copy(pos); player.velocity.set(0, 0, 0); player.yaw = yaw; player.pitch = 0; play.refill(); },
      addInteractable: (it) => { play.interactables.push(it); },
      removeInteractable: (it) => { const i = play.interactables.indexOf(it); if (i !== -1) play.interactables.splice(i, 1); },
      skipHeld: () => this.skipKeys || this.skipTouch || player.keys.has('Space') || player.keys.has('KeyE') || player.keys.has('Enter'),
      toast: play.toast, feed: play.feed,
      ...(play.music ? { music: play.music } : {}),
      ...(play.pickupHum ? { pickupHum: play.pickupHum } : {}),
    }, this.ui, 'nalati-grasslands');
    // the King starts outside every list until you walk in; the reward, once won, is yours at every boot
    this.fight.reset(0);
    this.fight.setPresent(false);
    if (this.boss.rewardTaken && play.bow) this.golden.apply(play.bow);
    window.addEventListener('pointerdown', () => { this.skipTouch = true; });
    window.addEventListener('pointerup', () => { this.skipTouch = false; });
    window.addEventListener('pointercancel', () => { this.skipTouch = false; });
    game.onUpdate((dt) => this.golden?.update(dt));
    // dev: `?boss=golden-king` — start at the chamber door; `&bossPhase=2|3` at that checkpoint
    if (play.params.get('boss') === 'golden-king') {
      const ph = Number(play.params.get('bossPhase') ?? '1');
      this.enter(true, 13.2);
      if (ph > 1) this.boss.devStartAt(ph - 1);
    }
    (window as unknown as { __boss: unknown }).__boss = this;
  }

  /** a death: in the fight → back at the checkpoint (true); else not ours */
  onPlayerDeath(): boolean { return this.boss?.onPlayerDeath() ?? false; }

  private applyMove(): void {
    const want = this.locked ? 0 : this.slow ? 0.5 : 1;
    if (this.ctx.player.moveScale !== want) this.ctx.player.moveScale = want;
  }

  /** into the dromos (from the mound's door, or `?boss=`) */
  private enter(immediate = false, atZ = DROMOS_SPAWN.z): void {
    const { player, game } = this.ctx;
    const play = this.play;
    if (!play || !this.boss || !this.fight) return;
    const go = () => {
      this.dungeon.world(DROMOS_SPAWN.x, 0, atZ, player.position);
      player.velocity.set(0, 0, 0); player.yaw = DROMOS_SPAWN.yaw; player.pitch = 0;
      this.inside = true; this.dungeon.inside = true;
      this.dungeon.setVisible(true);
      // the outdoor world goes dark (sealed interior: nothing out there can be seen) — everything at the scene root
      // but the interior, the animals, the camera (the viewmodel), the lights and the sky
      this.hidden = [];
      for (const o of game.scene.children) {
        if (!o.visible || o === this.dungeon.group || o === play.animals.group || o === game.camera || o instanceof THREE.Light || KEEP.test(o.name) || o.type === 'Points' || isTiny(o)) continue;
        o.visible = false; this.hidden.push(o);
      }
      this.calmWas = play.animals.calm; play.animals.calm = true;
      this.fight?.setPresent(true);
      this.boss?.arm();
    };
    if (immediate) { go(); return; }
    this.ui?.fade(true, 220); this.fadeT = 0.24;
    this.pending = go;
  }
  private pending: (() => void) | null = null;

  /** back out onto the mound's flank */
  private exit(teleport: boolean): void {
    const { player } = this.ctx;
    const play = this.play;
    const go = () => {
      if (teleport) {
        const e = this.ctx.entrance;
        if (e) {
          const fx = -Math.sin(e.facing), fz = -Math.cos(e.facing);
          player.position.set(e.x + fx * 2.4, e.y, e.z + fz * 2.4);
          player.yaw = e.facing; player.pitch = 0; player.velocity.set(0, 0, 0);
        }
      }
      this.inside = false; this.dungeon.inside = false;
      this.dungeon.setVisible(false);
      for (const o of this.hidden) o.visible = true;
      this.hidden = [];
      if (play) play.animals.calm = this.calmWas;
      this.boss?.disarm();
      this.fight?.setPresent(false);
      this.slow = false; this.locked = false; this.applyMove();
    };
    if (!teleport) { go(); return; }
    this.ui?.fade(true, 220); this.fadeT = 0.24;
    this.pending = go;
  }

  update(dt: number, t: number): void {
    const p = this.ctx.player.position;
    // the door fades: black → move → back
    if (this.fadeT >= 0) {
      this.fadeT -= dt;
      if (this.fadeT < 0) { const go = this.pending; this.pending = null; go?.(); this.ui?.fade(false, 420); }
      return;
    }
    if (!this.inside) {
      const e = this.ctx.entrance;
      if (e && this.boss) {
        const fx = -Math.sin(e.facing), fz = -Math.cos(e.facing);
        const dx = p.x - e.x, dz = p.z - e.z, lz = -(dx * fx + dz * fz), lx = dx * fz - dz * fx;
        if (lz > 0.8 && lz < 3 && Math.abs(lx) < 1.3 && Math.abs(p.y - e.y) < 1.5) this.enter();
      }
      return;
    }
    // inside
    if (!this.dungeon.inVolume(p)) { this.exit(false); return; }         // respawned elsewhere (a death outside the fight)
    const lz = p.z - DUNGEON.z;
    if (lz > DROMOS_END - 0.7 && this.boss?.engaged !== true) { this.exit(true); return; }
    // never below the dungeon floor: a drift that rises > 0.5 m under you in one step (a shove into a mound) is a platform
    // the Player refuses, and the terrain is 100 m down — lift the feet back onto the floor the same frame
    const fl = this.dungeon.floorHeightAt(p.x, p.z);
    if (fl !== undefined && p.y < fl - 0.02 && p.y > fl - 4) { p.y = fl; if (this.ctx.player.velocity.y < 0) this.ctx.player.velocity.y = 0; }
    // sand drifts slow you (the plinth, the beams and the pedestal step are the high ground)
    const lx = p.x - DUNGEON.x;
    const sand = this.dungeon.inChamber(p) ? this.dungeon.sandAt(lx, lz) : 0;
    const floor = this.dungeon.floorHeightAt(p.x, p.z) ?? DUNGEON.y;
    const onSand = sand > 0.12 && Math.abs(floor - (DUNGEON.y + sand)) < 0.05;
    if (onSand !== this.slow) { this.slow = onSand; this.applyMove(); }
    this.boss?.update(dt, t);
    this.dungeon.update(dt, t);
  }
}

/** the wiring's one call (src/nalati/index.ts): the interior built at boot, the fight bound later by main.ts */
export function wireKurgan(ctx: KurganCtx): KurganBoss { return new KurganBoss(ctx).build(); }
