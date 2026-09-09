import { cached } from './cache';
import type { DataDragonItemIndex } from './timeline-types';

const FALLBACK_VERSION = '15.14.1';

export const getDataDragonVersion = async () =>
  (
    await cached(
      'riot:ddragon:version',
      6 * 60 * 60_000,
      24 * 60 * 60_000,
      async () => {
        const response = await fetch(
          'https://ddragon.leagueoflegends.com/api/versions.json',
        );
        if (!response.ok) return FALLBACK_VERSION;
        const versions = (await response.json()) as string[];
        return versions[0] || FALLBACK_VERSION;
      },
    )
  ).value;

interface DataDragonItemJsonEntry {
  name?: string;
  gold?: { total?: number; purchasable?: boolean };
  into?: string[];
  tags?: string[];
}
interface DataDragonItemJson {
  data?: Record<string, DataDragonItemJsonEntry>;
}

/**
 * `item.json` de Data Dragon — no es la API de Riot con rate limit (es un
 * CDN estático por parche, igual que las imágenes de campeones/objetos),
 * así que esta llamada nunca cuenta contra el coste Riot documentado en
 * este sprint. Cacheada 24h: el catálogo de objetos solo cambia con cada
 * parche. Se usa para decidir qué compras del Timeline son "objetos
 * completados" (ver `timeline-normalize.ts`, `isCompletedItem`) y para
 * mostrar su nombre real — nunca un nombre inventado.
 */
export const getDataDragonItems = async (
  version: string,
): Promise<DataDragonItemIndex> =>
  (
    await cached(
      `riot:ddragon:items:${version}`,
      24 * 60 * 60_000,
      7 * 24 * 60 * 60_000,
      async () => {
        const response = await fetch(
          `https://ddragon.leagueoflegends.com/cdn/${version}/data/es_ES/item.json`,
        );
        if (!response.ok) return {} as DataDragonItemIndex;
        const payload = (await response.json()) as DataDragonItemJson;
        const index: DataDragonItemIndex = {};
        for (const [id, entry] of Object.entries(payload.data ?? {})) {
          if (!entry.name) continue;
          index[id] = {
            name: entry.name,
            goldTotal: entry.gold?.total ?? 0,
            purchasable: entry.gold?.purchasable ?? false,
            buildsInto: entry.into ?? [],
            tags: entry.tags ?? [],
          };
        }
        return index;
      },
    )
  ).value;

export const dataDragonUrls = (version: string) => ({
  profileIcon: (id: number) =>
    `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${id}.png`,
  champion: (name: string) =>
    `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${name}.png`,
  /** No depende de la versión: Data Dragon sirve el arte de carga sin prefijo de parche. */
  championLoading: (name: string, skinNumber = 0) =>
    `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${name}_${skinNumber}.jpg`,
  item: (id: number) =>
    `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`,
  summonerSpell: (name: string) =>
    `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${name}.png`,
});
