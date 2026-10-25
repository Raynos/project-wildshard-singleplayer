import courseProgram from '../behaviour/practice.generated.json' with { type: 'json' };
import navigation from '../data/navigation.generated.json' with { type: 'json' };
import world from '../data/world.generated.json' with { type: 'json' };
import { nineProductFrom, type NineProductInputs } from './productDefinition';

const DEFAULT_MOVERS = { pages: 1 };

/** The retained file-reader boundary, replaced by owned source calls at the program switch. */
export function readNineProductInputs(): NineProductInputs { return { courseProgram, navigation, world }; }

/** Retained reader until the complete source entry supplies this invocation's owned results. */
export function nineProduct(movers: { readonly pages: number } = DEFAULT_MOVERS): ReturnType<typeof nineProductFrom> {
  return nineProductFrom(readNineProductInputs(), movers);
}

// oxlint-disable-next-line import/no-default-export -- Existing CLI declaration authority during source conversion.
export default nineProduct();
