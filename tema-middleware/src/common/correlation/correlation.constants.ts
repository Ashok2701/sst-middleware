/**
 * Header used to carry a correlation / request id across service boundaries.
 * Kept lowercase because Node normalises incoming header names to lowercase.
 */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/** Property name used to attach the resolved correlation id to the request. */
export const CORRELATION_ID_PROP = 'correlationId';
