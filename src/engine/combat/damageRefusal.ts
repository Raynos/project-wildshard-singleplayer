/** @internal Expected pre-commit refusal of a damage transaction, not a simulation fault.
 * Throw only while actor health, death state and resources remain unchanged.
 * Ordinary hits may retry; terminal environmental falls do not consume this signal. */
export class DamageRefusalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DamageRefusalError';
  }
}
