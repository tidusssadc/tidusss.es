/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly YOUTUBE_API_KEY?: string;
  readonly RIOT_API_KEY?: string;
  readonly RIOT_GAME_NAME?: string;
  readonly RIOT_TAG_LINE?: string;
  readonly RIOT_PLATFORM_ROUTE?: string;
  readonly RIOT_REGIONAL_ROUTE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
