import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";
import path from "node:path";

export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      strategy: ['baseLocale'],
    }),
    sveltekit(),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    // Process CSS so `?raw` imports of .css resolve to their real text in tests
    // (vitest otherwise stubs CSS modules to empty, even with the ?raw query).
    css: true,
    alias: {
      '$lib': path.resolve('./src/lib'),
    },
  },
  server: {
    proxy: {
      '/github-api': {
        target: 'https://api.github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github-api/, ''),
        followRedirects: true,
      },
    },
  },
});
