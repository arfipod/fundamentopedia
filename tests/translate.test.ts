import { describe, expect, it } from 'vitest';
import { translate } from '../src/i18n/translate';

describe('translate', () => {
  it('uses fallback in english', () => {
    expect(translate('en', { k: 'v' }, 'k', 'fallback')).toBe('fallback');
  });

  it('uses locale value in spanish', () => {
    expect(translate('es', { k: 'valor' }, 'k', 'fallback')).toBe('valor');
  });

  it('falls back when key is missing', () => {
    expect(translate('es', {}, 'k', 'fallback')).toBe('fallback');
  });
});
