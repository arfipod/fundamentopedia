import { describe, expect, it } from 'vitest';
import { buildIndexes } from '../src/data/indexer';
import type { ProfileRoot } from '../src/types';

const profile = {
  gics_tree: [
    {
      level: 'sector',
      code: '10',
      name_es: 'Energy',
      children: [{ level: 'industry_group', code: '1010', name_es: 'Energy Equipment' }],
    },
  ],
} as unknown as ProfileRoot;

describe('buildIndexes', () => {
  it('indexes nodes by code and path', () => {
    const idx = buildIndexes(profile);
    expect(idx.byCodeTreeNode.get('10')?.name_es).toBe('Energy');
    expect(idx.pathCodesByCode.get('1010')).toEqual(['10', '1010']);
    expect(idx.searchItems).toHaveLength(2);
  });
});
