/** Candidate-only read endpoint; never supplies state setters or renderer callbacks. */
import { firstUseEvidence } from '../tent-shadow-diagnostic/first-use.mjs';
export function installFirstUseReader() {
 Reflect.set(window,'__readPublic4TentFirstUse',()=>firstUseEvidence(Reflect.get(window,'__practiceDemo').game));
}
