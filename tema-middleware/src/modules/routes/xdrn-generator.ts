/**
 * Pure XDRN generator (Phase 3.6). Format: `RT-{SITE}-{0001}` using the
 * applicable Sage X3 site + a sequential number, zero-padded to 4 digits.
 *
 * This is pure logic only - it does NOT read counters or persist anything.
 * Persisting generated routes to Sage tables is intentionally out of scope
 * until Sage's document/sequence engine handling is confirmed.
 */
const SITE_RE = /^[A-Za-z0-9_]+$/;

export function generateXdrn(
  site: string,
  sequence: number,
  prefix = 'RT',
  padWidth = 4,
): string {
  if (!site || !SITE_RE.test(site)) {
    throw new Error('Invalid site for XDRN generation');
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('XDRN sequence must be a positive integer');
  }
  return `${prefix}-${site}-${String(sequence).padStart(padWidth, '0')}`;
}

/** Extracts the numeric sequence from an XDRN of the form PREFIX-SITE-NNNN. */
export function parseXdrnSequence(xdrn: string): number | undefined {
  const m = /-(\d+)$/.exec(xdrn ?? '');
  return m ? Number(m[1]) : undefined;
}
