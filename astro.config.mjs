import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

/**
 * Modo de QA visual del rediseño de /competitivo (rama design/competitive-v3).
 *
 * Solo se INCLUYE en el bundle cuando el build NO es el de producción.
 * Cloudflare Pages expone `CF_PAGES_BRANCH` durante el build: en el deploy
 * de producción vale `main` (rama por defecto del repo) → `false` → el
 * activador queda como `if (false) { … }` y rollup elimina por completo el
 * fixture del `dist` de producción. En cualquier preview de rama, o en un
 * build local, vale `true` — pero aun así el fixture NO se activa salvo
 * con `?qa=competitive-v3` y en un host que no sea `tidusss.es`
 * (ver `src/lib/dev/competitive-qa.ts`). Triple candado.
 */
const QA_FIXTURE_ALLOWED = globalThis.process?.env?.CF_PAGES_BRANCH !== 'main';

export default defineConfig({
  site: 'https://tidusss.es',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.QA_FIXTURE_ALLOWED': JSON.stringify(QA_FIXTURE_ALLOWED),
    },
  },
});
