import { describe, expect, it } from 'vitest';
import { closestKnownGicsCode, resolveGicsCode } from '../src/data/gicsCodeResolver';

describe('gicsCodeResolver', () => {
  it('maps known alias codes to canonical replacements', () => {
    const knownCodes = new Set(['20202030', '20304030', '255030', '25503030', '602010', '60201010']);
    expect(resolveGicsCode('45102020', knownCodes)).toBe('20202030');
    expect(resolveGicsCode('20304020', knownCodes)).toBe('20304030');
    expect(resolveGicsCode('255020', knownCodes)).toBe('255030');
    expect(resolveGicsCode('25502020', knownCodes)).toBe('25503030');
    expect(resolveGicsCode('601020', knownCodes)).toBe('602010');
    expect(resolveGicsCode('60102010', knownCodes)).toBe('60201010');
  });

  it('falls back to closest parent by dropping two digits', () => {
    const knownCodes = new Set(['25', '2550', '255030']);
    expect(closestKnownGicsCode('25503077', knownCodes)).toBe('255030');
    expect(closestKnownGicsCode('25509999', knownCodes)).toBe('2550');
    expect(closestKnownGicsCode('25999999', knownCodes)).toBe('25');
  });
});
