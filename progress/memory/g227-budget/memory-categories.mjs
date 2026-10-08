// Compatibility entry for the native audit; the shared passive implementation lives with the soak tools.
import { memoryCategories as passiveMemoryCategories } from '../../../scripts/soak/memory-categories.mjs';

export function memoryCategories(inspector, wait) {
  return passiveMemoryCategories(inspector, wait);
}
