import { generateXdrn, parseXdrnSequence } from './xdrn-generator';

describe('xdrn-generator', () => {
  it('formats as RT-{SITE}-{0001}', () => {
    expect(generateXdrn('USA01', 1)).toBe('RT-USA01-0001');
    expect(generateXdrn('CAN02', 42)).toBe('RT-CAN02-0042');
    expect(generateXdrn('S1', 12345)).toBe('RT-S1-12345');
  });

  it('supports a custom prefix', () => {
    expect(generateXdrn('USA01', 7, 'RX')).toBe('RX-USA01-0007');
  });

  it('rejects invalid site or sequence', () => {
    expect(() => generateXdrn('', 1)).toThrow();
    expect(() => generateXdrn('US 01', 1)).toThrow();
    expect(() => generateXdrn('USA01', 0)).toThrow();
    expect(() => generateXdrn('USA01', -1)).toThrow();
    expect(() => generateXdrn('USA01', 1.5)).toThrow();
  });

  it('parses the sequence back out', () => {
    expect(parseXdrnSequence('RT-USA01-0042')).toBe(42);
    expect(parseXdrnSequence('nope')).toBeUndefined();
  });
});
