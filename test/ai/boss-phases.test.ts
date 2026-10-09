import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Boss, type BossDef, type BossHost, type BossPhaseDef } from '../../src/game/Boss';
import type { BossScript } from '../../src/engine/ai/BossBrain';
import type { BossBar } from '../../src/engine/ui/BossBar';
import { captainPhase } from '../../src/shards/driftwood-isle/species/captainPolicy';
import { KING_PHASE_AT } from '../../src/shards/pine-hollow/combat/combatMath';
import { fakeWorld } from '../fake/world';
import { legacyDouble } from '../fake/FakeGame';
import { legacyConstants } from '../fake/legacySource';

const rows = [
  { id: 'golden-king', file: 'src/shards/nalati-grasslands/combat/goldenKing.ts', key: 'KING_DEF_PHASES' },
  { id: 'storm-titan', file: 'src/shards/nalati-grasslands/combat/stormTitan.ts', key: 'TITAN_PHASES' },
  { id: 'antler-king', file: 'src/shards/pine-hollow/data/antlerKing.ts', key: 'ANTLER_KING_PHASES' },
];
describe('actual boss phase data and the shared checkpoint machine', () => {
  it.each(rows)('$id clamps each transition and death resumes the reached phase', ({ id, file, key }) => {
    const phases = legacyConstants(file, [key], { KING_PHASE_AT })[key] as BossPhaseDef[];
    expect(phases.map((p) => p.at)).toEqual([1, 0.6, 0.3]);
    const f = fakeWorld(); let hp = 1, inside = true;
    const script: BossScript = {
      inArena: () => inside, reset: vi.fn((): void => undefined), seal: vi.fn((): void => undefined), intro: () => new THREE.Vector3(0, 1, -3),
      begin: vi.fn((): void => undefined), enterPhase: vi.fn((): void => undefined), update: vi.fn((): void => undefined), get hpFrac(): number { return hp; },
      shielded: false, dead: false, clampHp: vi.fn((frac: number): void => { hp = frac; }),
      setInvulnerable: vi.fn((): void => undefined), victory: vi.fn((): void => undefined), rewardPoint: () => new THREE.Vector3(),
      respawnPoint: () => ({ pos: new THREE.Vector3(1, 0, 2), yaw: 0.7 }),
    };
    const host: BossHost = { scene: f.game.scene, player: f.player, camera: f.game.camera,
      lockInput: vi.fn((): void => undefined), respawn: vi.fn((): void => undefined), addInteractable: vi.fn((): void => undefined), removeInteractable: vi.fn((): void => undefined), skipHeld: () => false };
    const ui = legacyDouble<BossBar>({ update: vi.fn((): void => undefined), hideBar: vi.fn((): void => undefined), hideNameCard: vi.fn((): void => undefined), hideReward: vi.fn((): void => undefined),
      showRetry: vi.fn((): void => undefined), showNameCard: vi.fn((): void => undefined), setSkip: vi.fn((): void => undefined), showBar: vi.fn((): void => undefined), setHp: vi.fn((): void => undefined), setShield: vi.fn((): void => undefined), setPhase: vi.fn((): void => undefined) });
    const def: BossDef = { id: `c1-${id}`, name: id, title: id, phases, retryTitle: 'ENDURES', intro: 0.1, introShort: 0.05,
      reward: { tier: 'LEGENDARY', name: id, flavour: id, prompt: id, model: () => new THREE.Group(), grant: vi.fn((): void => undefined) } };
    const boss = new Boss(def, script, host, ui, 'pine-hollow');
    f.game.onUpdate((dt, t) => { boss.update(dt, t); }, 'boss', true);
    const advance = (n: number): void => { for (let i = 0; i < n; i++) f.game.advance(1 / 60); expect(f.game.dead).toBe(false); };
    expect(boss.onPlayerDeath()).toBe(false); boss.arm(); advance(12); expect(boss.state).toBe('fight');
    hp = 0.1; advance(1);
    expect(boss.phase).toBe(1); expect(boss.checkpoint).toBe(1); expect(hp).toBe(0.6); expect(boss.state).toBe('beat');
    advance(89); expect(boss.state).toBe('beat'); advance(2); expect(boss.state).toBe('fight');
    hp = 0.29; advance(1); expect(boss.phase).toBe(2); expect(hp).toBe(0.3);
    expect(script.enterPhase).toHaveBeenNthCalledWith(1, 1); expect(script.enterPhase).toHaveBeenNthCalledWith(2, 2);
    expect(boss.onPlayerDeath()).toBe(true); expect(boss.checkpoint).toBe(2); expect(boss.attempts).toBe(2);
    expect(script.reset).toHaveBeenLastCalledWith(2); expect(host.respawn).toHaveBeenCalledWith(new THREE.Vector3(1, 0, 2), 0.7);
    advance(10); expect(script.begin).toHaveBeenLastCalledWith(2);
    inside = false; boss.disarm(); expect(boss.checkpoint).toBe(0); expect(boss.onPlayerDeath()).toBe(false);
  });
  it.each([[1, 1], [0.660001, 1], [0.66, 2], [0.330001, 2], [0.33, 3], [0, 3]])('captain at hp fraction %s is phase %s', (frac, phase) => {
    expect(captainPhase(frac * 320, 320)).toBe(phase);
  });
});
