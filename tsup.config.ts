import { defineConfig } from 'tsup'

export default defineConfig([
  // CLI 构建配置
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    target: 'node18',
    outDir: 'dist',
    dts: false,
    sourcemap: true,
    clean: true,
    shims: false,
    splitting: false,
    bundle: true,
    minify: false,
    external: [],
    banner: {
      js: '#!/usr/bin/env node'
    }
  },
  // 库构建配置
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node18',
    outDir: 'dist',
    dts: true,
    sourcemap: true,
    clean: false,
    shims: false,
    splitting: false,
    bundle: true,
    minify: false,
    external: []
  }
])