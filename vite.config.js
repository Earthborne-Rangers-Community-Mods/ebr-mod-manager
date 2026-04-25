import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { defineConfig } from "vite";
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
    alias: {
      '$lib': path.resolve('./src/lib'),
    },
  },
});
