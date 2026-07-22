import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://tidusss.es',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
