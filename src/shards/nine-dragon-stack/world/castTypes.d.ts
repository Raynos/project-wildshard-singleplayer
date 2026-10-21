import type { PracticeScene } from '@wildshard/format/practiceCourseRows';
import type { FixedRows as FixedKit } from '../runtime/productSections.generated';

/** The course producer validates the public presentation schema separately. */
export interface FixedRows extends Omit<FixedKit, 'practice'> {
  readonly practice: Omit<FixedKit['practice'], 'presentation'> & { readonly presentation: PracticeScene };
}
