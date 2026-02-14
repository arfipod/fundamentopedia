import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/data/**/*.ts', 'src/i18n/translate.ts', 'src/ui/utils.ts'],
    },
  },
});
