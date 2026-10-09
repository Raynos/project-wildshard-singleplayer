// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the admitted native template assets.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { SaveStore } from '../src/engine/saves/store';
import { loadRapier } from '../src/engine/physics/rapier';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { GridAssembly } from '../src/game/grid/assembly';
import { GridCellEvents } from '../src/game/grid/boot';
import { GridRegionDurability } from '../src/game/grid/durability';
import { copyPrompts, enteredCopy } from '../src/game/grid/copyPrompts';
import { enteredRuntime, pickInFrame } from '../src/game/grid/enteredInteract';
import { minimapOverlay, roadRects } from '../src/game/grid/minimapBlend';
import { createShardfileSim } from '../src/game/shardfile/simulation';
import source from '../src/shards/_template/shard.config';
import { MemoryStorage } from './setup';

// template-prompts (E435): a template copy in the grid offers the standalone template's declared interactions, from its own
// regional simulation, in its own frame; a runtime cell keeps its own prompts; a crossing offers neither twice.
describe('template copy prompts in the grid (template-prompts)', () => {
  it('a copy offers the hut door in its frame; USE runs the door scene on the copy\'s own lane and the quest moves', async () => {
    const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
    const assets = new Map(source.files.map((file) => [file.hash, readFileSync(`src/shards/_template/assets/${file.hash}`)]));
    const durability = new GridRegionDurability(new SaveStore({ local: new MemoryStorage(), session: null }), { id: 'template-1', shard: source.identity.slug }, source, []);
    const sim = createShardfileSim(source, assets, { rapier, quest: durability.quest, playerBody: false, groundResolution: 257 });
    try {
      // the live host lends the traveller's motor to the entered region (the page's one capsule)
      sim.host.attachPlayerMotor(new CharacterMotor(sim.host.physics, { radius: 0.35, height: 1.8, step: 0.3,
        maxClimbDeg: 45, snap: 0.2, group: 'PLAYER', blockedBy: ['WORLD', 'PLAYER', 'CREATURE'], owner: sim.host.player.id }));
      const prompts = copyPrompts(source, sim);
      expect(prompts.map((p) => p.label)).toEqual(source.targets.interactions.map((row) => row.label));
      // template-1 sits a cell north of the home: the page camera carries the render origin (0, 0, 555), the prompt is frame-local
      const offset = { x: 0, y: 0, z: 555 }, camera = new Vector3(0, 1.7, 555 - 6.4);
      sim.host.step();
      const door = pickInFrame(prompts, camera, offset, sim.host.physics, new Vector3());
      expect(door?.label).toBe('Open hut door');
      expect(pickInFrame(prompts, camera, { x: 0, y: 0, z: 0 }, sim.host.physics, new Vector3())).toBeUndefined(); // without the frame: a cell away
      const lane = sim.lane; if (lane === undefined) throw new Error('Missing the template copy\'s lane');
      const open = () => lane.world.view(sim.host.player.id).shared['template.door.open'];
      expect(open()).toBe(0); expect(sim.colliders.get('template.door')?.active()).toBe(true);
      door?.onInteract(); sim.host.step();
      expect(open()).toBe(1); expect(sim.colliders.get('template.door')?.active()).toBe(false);
      door?.onInteract(); sim.host.step();
      expect(open()).toBe(0); expect(sim.colliders.get('template.door')?.active()).toBe(true);
      // the quest step: the region's player stands where the live host copies the traveller's feet
      const quest = sim.quest.quests[0];
      expect(quest?.current?.id).toBe('hut');
      sim.host.player.position.set(0, 0, -7); sim.host.step();
      expect(quest?.current?.id).toBe('blob');
    } finally { sim.dispose(); }
  });

  it('scans one cell: the entered copy, else the entered runtime, else nothing (road, a seam, an unadmitted copy)', () => {
    const copies = new Set(['template-1']), admitted = (id: string) => copies.has(id);
    const runtime = (current: string | null, feetCell: string | null) => enteredRuntime({ hybrid: { instance: 'sky', ready: true }, current, feetCell });
    // in the copy: its prompts, and no runtime's
    expect(enteredCopy({ current: 'template-1', feetCell: 'template-1' }, admitted)).toBe('template-1');
    expect(runtime('template-1', 'template-1')).toBeNull();
    // in the runtime cell: its own, and no copy's
    expect(enteredCopy({ current: 'sky', feetCell: 'sky' }, admitted)).toBeNull();
    expect(runtime('sky', 'sky')).toBe('sky');
    // a crossing between them: the motor frame and the feet disagree, so neither (no duplicate at the seam)
    expect(enteredCopy({ current: 'template-1', feetCell: 'sky' }, admitted)).toBeNull();
    expect(runtime('template-1', 'sky')).toBeNull();
    expect(enteredCopy({ current: 'sky', feetCell: 'template-1' }, admitted)).toBeNull();
    expect(runtime('sky', 'template-1')).toBeNull();
    // the road, and a copy whose region was disposed (it left the residency)
    expect(enteredCopy({ current: null, feetCell: null }, admitted)).toBeNull();
    copies.delete('template-1');
    expect(enteredCopy({ current: 'template-1', feetCell: 'template-1' }, admitted)).toBeNull();
  });

  it('the minimap names a neighbour only across the road inside its disc, never pinned to the rim like a title', () => {
    const assembly = new GridAssembly({ developer: false, devserver: false });
    const home = assembly.cells.find((cell) => cell.slug === 'driftwood-isle'), copy = assembly.cells.find((cell) => cell.instance === 'template-1');
    if (home === undefined || copy === undefined) throw new Error('Missing the public grid\'s home or template-1');
    const cells = new GridCellEvents(); cells.enter({ instance: copy.instance, slug: copy.slug });
    const rects = roadRects(assembly, home);
    const seen = new Set<string>();
    for (let lz = -245; lz <= 245; lz += 5) {
      const feet = { x: copy.origin.x, z: copy.origin.z + lz };
      const overlay = minimapOverlay({ assembly, home, cells, worldFeet: () => feet, image: () => null, name: (cell) => cell.instance }, rects);
      for (const label of overlay.labels) {
        seen.add(label.text);
        expect(Math.hypot(label.x + home.origin.x - feet.x, label.z + home.origin.z - feet.z)).toBeLessThanOrEqual(101);
      }
    }
    expect(seen).toContain('driftwood-isle'); // at the south road, across it
  });
});
