import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Parent directories may have a PostCSS/Tailwind config; this package is not a CSS app.
  css: {
    postcss: {
      plugins: [],
    },
  },
});
