import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Le décor 3D (Three.js) est un chunk chargé à la demande.
  build: { chunkSizeWarningLimit: 700 },
  test: {
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.js'],
      reporter: ['text', 'html'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
