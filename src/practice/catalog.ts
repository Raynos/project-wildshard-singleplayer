/** One shared Model Explorer family card for the three training-dummy armor variants. */
import * as THREE from 'three';
import { registerModel } from '../explore/registry';
import { buildTrainingDummy, DUMMY_VARIANTS, TRAINING_DUMMY_HEIGHT, type DummyVariant } from './TrainingDummy';
import { loadTrainingDummy } from './TrainingDummyAssets';

export function registerTrainingDummyModel(): void {
  const group = new THREE.Group();
  const cache = new Map<DummyVariant, THREE.Group>();
  const loading = new THREE.Mesh(new THREE.BoxGeometry(0.58, TRAINING_DUMMY_HEIGHT, 0.34), new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.22, wireframe: true, depthWrite: false }));
  loading.position.y = TRAINING_DUMMY_HEIGHT / 2;
  let current: DummyVariant = 'wood';
  const fetchVariant = async (id: DummyVariant): Promise<void> => {
    let specimen: THREE.Group;
    try { specimen = (await loadTrainingDummy(id)).root; }
    catch (error) {
      console.warn(`[practice] Model Explorer could not load ${id}; using procedural fallback`, error);
      specimen = buildTrainingDummy(id).root;
    }
    cache.set(id, specimen);
    if (current !== id) return;
    group.clear(); group.add(specimen);
    document.dispatchEvent(new CustomEvent('ws:model-ready', { detail: { id: 'training-dummy' } }));
  };
  const rebuild = (variant?: string): void => {
    const id = DUMMY_VARIANTS.find((v) => v.id === variant)?.id ?? current;
    current = id;
    const specimen = cache.get(id);
    group.clear(); group.add(specimen ?? loading);
    if (specimen) return;
    void fetchVariant(id);
  };
  registerModel({
    id: 'training-dummy', name: 'Training dummy', category: 'props', file: 'public/assets/practice/dummies/', live: false,
    object: () => { if (group.children.length === 0) rebuild('wood'); return group; },
    variants: DUMMY_VARIANTS.map((v) => ({ id: v.id, label: v.label })), rebuild, worldView: false,
  });
}
