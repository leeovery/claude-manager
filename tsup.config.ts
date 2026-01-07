import { defineConfig } from 'tsup';

export default defineConfig([
  // Library exports
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'node18',
  },
  // CLI (needs shebang)
  {
    entry: {
      cli: 'src/cli.ts',
    },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    target: 'node18',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
