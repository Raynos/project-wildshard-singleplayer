import { expect, it } from 'vitest';
import { InstancedMesh, PerspectiveCamera, Scene, Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { Game } from '../src/engine/core/Game';
import { Events } from '../src/engine/events/events';
import { Impacts } from '../src/engine/fx/Impacts';
import { installRangedFeel, prepareRangedFeel } from '../src/engine/combat/view/rangedFeel';
import { sceneJobs } from '../src/engine/render/precompile';
import { CROSSBOW } from '../src/shards/pine-hollow/weapons/equipment';

function fixture() {
  const app = new App(), scope = app.engineScope.child('effects'), scene = new Scene(), camera = new PerspectiveCamera();
  const game: unknown = Object.create(Game.prototype);
  if (!(game instanceof Game)) throw new Error('Missing Game prototype');
  for (const [key, value] of Object.entries({ app, scene, rootScene: scene, camera, levelScope: scope, playerScope: scope,
    registrationScope: scope, faultSystems: new Map<string, object>(), anonymous: 0 })) Reflect.defineProperty(game, key, { value, writable: true });
  return { scope, scene, game, events: new Events() };
}

it('prepares the real empty coloured debris variant before listeners, with no duplicate resource on re-entry', () => {
  const f = fixture();
  try {
    const bind = prepareRangedFeel(f.game), impacts = Impacts.for(f.game);
    expect(impacts.mesh.count).toBe(0); expect(f.events.census().listeners).toBe(0);
    const clone = sceneJobs(f.scene, null).jobs.flatMap(job => job.root.children).find(object => object.name === 'impacts');
    expect(clone instanceof InstancedMesh).toBe(true);
    if (!(clone instanceof InstancedMesh)) throw new Error('Missing debris stand-in');
    expect(clone.instanceColor?.array).toEqual(impacts.mesh.instanceColor?.array);
    expect(clone.material).toBe(impacts.mesh.material);
    for (let visit = 0; visit < 2; visit++) {
      const entry = f.scope.child(`entry.${String(visit)}`);
      bind(f.events, entry, id => id === CROSSBOW.id ? CROSSBOW : undefined);
      expect(f.events.census().listeners).toBe(2);
      entry.dispose(); expect(f.events.census().listeners).toBe(0);
      expect(Impacts.for(f.game)).toBe(impacts);
      expect(f.scene.children.filter(object => object.name === 'impacts')).toEqual([impacts.mesh]);
    }
  } finally { f.scope.dispose(); }
});

it('delivers identical material bursts and seeded particle state for immediate and prepared listeners', () => {
  const immediate = fixture(), prepared = fixture();
  try {
    installRangedFeel(immediate.game, immediate.events, immediate.scope, id => id === CROSSBOW.id ? CROSSBOW : undefined);
    const bind = prepareRangedFeel(prepared.game);
    expect(prepared.events.census().listeners).toBe(0);
    bind(prepared.events, prepared.scope, id => id === CROSSBOW.id ? CROSSBOW : undefined);
    for (const f of [immediate, prepared]) {
      f.events.emit('weapon.impact', { id: CROSSBOW.id, surface: 'wood', point: new Vector3(1, 2, 3) });
      f.events.flush('update'); Impacts.for(f.game).update(1 / 60);
    }
    const a = Impacts.for(immediate.game).mesh, b = Impacts.for(prepared.game).mesh;
    expect(b.count).toBe(8); expect(b.count).toBe(a.count);
    expect(b.instanceMatrix.array).toEqual(a.instanceMatrix.array);
    expect(b.instanceColor?.array).toEqual(a.instanceColor?.array);
  } finally { immediate.scope.dispose(); prepared.scope.dispose(); }
});
