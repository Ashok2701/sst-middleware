/**
 * Bi-directional mapper between a TEMA canonical model and an external model.
 *
 * Keeps external field names/shapes out of TEMA business code. Implementations
 * should throw an IntegrationError(TRANSFORMATION_ERROR) on unmappable input.
 */
export interface Mapper<TCanonical, TExternal> {
  toExternal(canonical: TCanonical): TExternal;
  toCanonical(external: TExternal): TCanonical;
}
