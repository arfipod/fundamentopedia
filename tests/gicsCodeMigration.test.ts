import { describe, expect, it } from 'vitest';
import { closestKnownGicsCode, migrateAndResolveGicsCode } from '../src/data/gicsCodeMigration';

describe('gicsCodeMigration', () => {
  it('maps explicit legacy codes to official replacements', () => {
    const knownCodes = new Set(['20202030', '20304030', '255030', '25503030', '602010', '60201010']);
    expect(migrateAndResolveGicsCode('45102020', knownCodes)).toBe('20202030');
    expect(migrateAndResolveGicsCode('20304020', knownCodes)).toBe('20304030');
    expect(migrateAndResolveGicsCode('255020', knownCodes)).toBe('255030');
    expect(migrateAndResolveGicsCode('25502020', knownCodes)).toBe('25503030');
    expect(migrateAndResolveGicsCode('601020', knownCodes)).toBe('602010');
    expect(migrateAndResolveGicsCode('60102010', knownCodes)).toBe('60201010');
  });

  it('falls back to closest parent by dropping two digits', () => {
    const knownCodes = new Set(['25', '2550', '255030']);
    expect(closestKnownGicsCode('25503077', knownCodes)).toBe('255030');
    expect(closestKnownGicsCode('25509999', knownCodes)).toBe('2550');
    expect(closestKnownGicsCode('25999999', knownCodes)).toBe('25');
  });
});
