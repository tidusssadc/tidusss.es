/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly YOUTUBE_API_KEY?: string;
  readonly YOUTUBE_CHANNEL_ID?: string;
  readonly RIOT_API_KEY?: string;
  readonly RIOT_GAME_NAME?: string;
  readonly RIOT_TAG_LINE?: string;
  readonly RIOT_PLATFORM_ROUTE?: string;
  readonly RIOT_REGIONAL_ROUTE?: string;
  readonly TWITCH_CLIENT_ID?: string;
  readonly TWITCH_CLIENT_SECRET?: string;
  readonly TWITCH_USER_LOGIN?: string;
  /**
   * Definida en `astro.config.mjs` vía Vite `define`. `false` en el build
   * de producción (Cloudflare Pages, `CF_PAGES_BRANCH === 'main'`) → el
   * modo de QA visual de /competitivo se elimina del bundle. `true` en
   * previews de rama y builds locales.
   */
  readonly QA_FIXTURE_ALLOWED: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
