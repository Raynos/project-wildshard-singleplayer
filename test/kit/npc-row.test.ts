import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { NpcRig } from '../../src/game/systems/npc/npcRig';

describe('NPC row lifecycle', () => {
  it('freezes distant poses and culls companions before updating', () => {
    const group = new Group(), companion = new Group(), update = vi.fn();
    const rig = new NpcRig({ id: 'counter', idle: 'counter', near: 85, rig: { skeleton: 'counter.pivots', clips: [], sockets: [] },
      model: () => ({ group, update }), visible: (_model, near) => { companion.visible = near; },
    }, undefined);
    rig.update(1, 10, new Vector3(85, 0, 0));
    expect(companion.visible).toBe(false);
    expect(update).not.toHaveBeenCalled();
    rig.update(1, 11, new Vector3(84, 0, 0));
    expect(companion.visible).toBe(true);
    expect(update).toHaveBeenCalledOnce();
    rig.dispose();
    rig.update(1, 12, new Vector3());
    expect(update).toHaveBeenCalledOnce();
  });

  it('disposes a late face instead of attaching it to an evicted NPC', async () => {
    const head = new Mesh(new BoxGeometry()), face = new BoxGeometry();
    const dispose = vi.spyOn(face, 'dispose');
    let resolveFace: ((geometry: BoxGeometry) => void) | undefined;
    const load = new Promise<BoxGeometry>((resolve) => { resolveFace = resolve; });
    const rig = new NpcRig({ id: 'speaker', idle: 'fire-tend', near: Infinity, rig: { skeleton: 'speaker.pivots', clips: [], sockets: [] },
      model: () => ({ group: new Group(), update: vi.fn(), head }),
      face: { load: () => load, target: (model) => model.head },
    }, undefined);
    rig.dispose();
    resolveFace?.(face);
    await load;
    expect(dispose).toHaveBeenCalledOnce();
    expect(head.geometry).not.toBe(face);
  });
});
