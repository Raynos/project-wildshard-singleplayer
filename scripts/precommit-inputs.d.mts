export function precommitInputs(root?: string): void;
/** Run official cheap producers only when one of their admitted outputs is absent. */
export function prepareMissingCheapInputs(root?: string): Promise<void>;
