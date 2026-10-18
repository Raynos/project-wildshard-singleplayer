/** Shared specimen defaults and variants. Authoring never imports the model card's runtime renderer. */
export interface SpecimenProfile<P extends object> {
  readonly defaults: P;
  readonly variants: readonly { readonly id: string; readonly label: string; readonly params: Partial<P> }[];
}

