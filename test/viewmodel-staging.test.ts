import { expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { bindConstructionEnvironment, constructionOwner, withOwner } from '../src/engine/app/ownership';
import { Scope } from '../src/engine/app/scope';
import { ViewmodelRoot } from '../src/engine/render/viewmodel';

const model = (): Group => { const group = new Group(); group.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial())); return group; };

it('a sliced build\'s model made after an await joins its construction\'s hidden stage, not the live root', async () => {
  const page = new Scope('page'), resident = page.child('resident'), root = new ViewmodelRoot();
  const stage = root.stage(resident);
  const leave = bindConstructionEnvironment(resident, () => () => undefined);
  try {
    expect(constructionOwner()).toBe(resident);
    const first = model(), later = model(), road = model();
    withOwner(resident, () => { root.add(first); });
    await Promise.resolve(); // an unwrapped continuation: the ambient owner is no longer the resident's
    root.add(later);
    // the page's own callback suspends the construction frame and keeps its live mount
    withOwner(page, () => { expect(constructionOwner()).toBe(null); root.add(road); });
    expect(first.parent).toBe(stage); expect(later.parent).toBe(stage); expect(road.parent).toBe(root);
    expect(stage.visible).toBe(false);
  } finally { leave(); }
  expect(constructionOwner()).toBe(null);
  const after = model(); root.add(after);
  expect(after.parent).toBe(root);
  page.dispose();
});
