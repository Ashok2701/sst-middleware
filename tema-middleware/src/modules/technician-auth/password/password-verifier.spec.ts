import { PlaintextPasswordVerifier } from './password-verifier';

describe('PlaintextPasswordVerifier (temporary dev)', () => {
  const verifier = new PlaintextPasswordVerifier();

  it('accepts a matching password', async () => {
    expect(await verifier.verify('hunter2', 'hunter2')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    expect(await verifier.verify('wrong', 'hunter2')).toBe(false);
  });

  it('rejects when there is no stored value', async () => {
    expect(await verifier.verify('anything', undefined)).toBe(false);
    expect(await verifier.verify('anything', '')).toBe(false);
  });

  it('is length-safe (different lengths never match)', async () => {
    expect(await verifier.verify('short', 'muchlongerpassword')).toBe(false);
  });
});
