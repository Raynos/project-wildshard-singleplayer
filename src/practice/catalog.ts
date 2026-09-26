/** One shared Model Explorer family card for the three training-dummy armor variants. */
import * as THREE from 'three';
import { registerModel } from '../explore/registry';
import { buildTrainingDummy, DUMMY_VARIANTS, type DummyVariant } from './TrainingDummy';

export function registerTrainingDummyModel(): void {
  const group = new THREE.Group();
  const cache = new Map<DummyVariant, THREE.Group>();
  let current: DummyVariant = 'wood';
  const rebuild = (variant?: string): void => {
    const id = DUMMY_VARIANTS.find((v) => v.id === variant)?.id ?? current;
    current = id;
    let specimen = cache.get(id);
    if (!specimen) { specimen = buildTrainingDummy(id).root; cache.set(id, specimen); }
    group.clear(); group.add(specimen);
  };
  registerModel({
    id: 'training-dummy', name: 'Training dummy', category: 'props', file: 'src/practice/TrainingDummy.ts', live: false,
    object: () => { if (group.children.length === 0) rebuild('wood'); return group; },
    variants: DUMMY_VARIANTS.map((v) => ({ id: v.id, label: v.label })), rebuild, worldView: false,
  });
}
